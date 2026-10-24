/**
 * Browser half of `decompose:capture` (ADR-109): run journeys against the
 * live app and record what it does.
 *
 * Each journey runs in a fresh browser context with the page clock frozen, so
 * dates the app renders are the same on every run. Network activity is read
 * over CDP rather than Playwright's request events because CDP carries the
 * JavaScript call stack that sent each request, async parents included — the
 * `initiator` signal. In replay mode, API requests are answered from a
 * previous bundle's recorded responses, which is what makes two captures of
 * the same journeys identical.
 */

import { launchBrowser, type ChromiumLike } from '../design/dom-capture';
import { ValidationError } from '@seans-mfe/contracts';
import { initiatorFiles, type CdpStackTrace } from './attribution';
import { relativeUrl, responseKey, type JourneyRun, type RawRequest, type RawStep, type RecordedResponse } from './bundle';
import type { Journey, JourneyStep } from './journeys';
import { probeElements, type ProbeResult } from './page-probe';
import { assembleRegions, normalizeSourcePath } from './regions';

export interface CaptureOptions {
  url: string;
  journeys: Journey[];
  /** Explore by following in-app links for up to this many steps, as an extra `explore` journey. */
  explore: number;
  viewport: { width: number; height: number };
  /** The frozen page clock, ISO-8601. */
  clock: string;
  /** Quiet time with no request in flight before a step counts as settled. */
  settleMs: number;
  /** Recorded responses to answer API requests with (replay). */
  replay?: Record<string, RecordedResponse>;
  /** Directory source paths are made relative to; defaults to cutting at `/src/`. */
  sourceRoot?: string;
}

export interface CaptureOutcome {
  runs: JourneyRun[];
  /** Requests a replay had no recording for, as `METHOD url`. */
  replayMisses: string[];
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (params: never) => void): void;
}

interface PageLike {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, opts?: { timeout?: number }): Promise<void>;
  press(selector: string, key: string, opts?: { timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  evaluate<T>(fn: string): Promise<T>;
  screenshot(opts?: { type?: 'png' }): Promise<Buffer>;
  on(event: 'console', handler: (msg: { type(): string; text(): string }) => void): void;
  on(event: 'pageerror', handler: (err: Error) => void): void;
  on(event: 'framenavigated', handler: (frame: { url(): string; parentFrame(): unknown }) => void): void;
  mainFrame(): unknown;
  clock: { setFixedTime(time: Date): Promise<void> };
}

interface ContextLike {
  newPage(): Promise<PageLike>;
  newCDPSession(page: PageLike): Promise<CdpSession>;
  close(): Promise<void>;
}

interface BrowserWithContexts {
  newContext(opts: { viewport: { width: number; height: number } }): Promise<ContextLike>;
  close(): Promise<void>;
}

const API_TYPES = new Set(['XHR', 'Fetch']);
const STEP_TIMEOUT = 15_000;

async function importChromium(): Promise<ChromiumLike> {
  try {
    const pw = await import('playwright');
    return pw.chromium as ChromiumLike;
  } catch {
    throw new ValidationError(
      'decompose:capture needs Playwright to run the app. Install it with `npm i -D playwright` (and `npx playwright install chromium`).',
      'playwright',
      'required'
    );
  }
}

function parseBody(text: string, mimeType: string): unknown {
  if (/json/i.test(mimeType)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/** A link-following journey: the app's in-page links, breadth-first, one click each. */
async function exploreSteps(page: PageLike, budget: number, visited: Set<string>): Promise<JourneyStep[]> {
  const links = await page.evaluate<Array<{ href: string; path: string }>>(
    `Array.from(document.querySelectorAll('a[href]'))
      .filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map((a) => ({ href: a.getAttribute('href'), path: new URL(a.href, location.href) }))
      .filter((l) => l.path.origin === location.origin)
      .map((l) => ({ href: l.href, path: l.path.pathname + l.path.search }))`
  );
  const steps: JourneyStep[] = [];
  for (const link of links) {
    if (steps.length >= budget) break;
    if (visited.has(link.path)) continue;
    visited.add(link.path);
    steps.push({ click: `a[href=${JSON.stringify(link.href)}] >> nth=0` });
  }
  return steps;
}

/** Run every journey (and exploration) and return what was observed. */
export async function captureEvidence(options: CaptureOptions, chromium?: ChromiumLike): Promise<CaptureOutcome> {
  const browser = (await launchBrowser(chromium ?? (await importChromium()))) as unknown as BrowserWithContexts;
  const replayMisses = new Set<string>();
  const runs: JourneyRun[] = [];
  const plan: Array<{ journey: Journey; explore: boolean }> = options.journeys.map((journey) => ({
    journey,
    explore: false,
  }));
  if (options.explore > 0) {
    plan.push({ journey: { name: 'explore', steps: [{ goto: relativeUrl(options.url, options.url) }] }, explore: true });
  }

  try {
    for (const item of plan) {
      runs.push(await runJourney(browser, item.journey, item.explore, options, replayMisses));
    }
  } finally {
    await browser.close();
  }
  return { runs, replayMisses: [...replayMisses].sort() };
}

async function runJourney(
  browser: BrowserWithContexts,
  journey: Journey,
  explore: boolean,
  options: CaptureOptions,
  replayMisses: Set<string>
): Promise<JourneyRun> {
  const context = await browser.newContext({ viewport: options.viewport });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(options.clock));

    const cdp = await context.newCDPSession(page);
    await cdp.send('Debugger.enable');
    // Async parents carry the stack across awaits and promise chains (useEffect → client → axios).
    await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 });
    await cdp.send('Debugger.setSkipAllPauses', { skip: true });
    await cdp.send('Network.enable');

    if (options.replay) {
      // Intercept API calls only. Playwright's catch-all route turns on interception for every
      // request, and Chromium then skips the favicon fetch: a live 404 a replay would hide.
      const recorded = options.replay;
      await cdp.send('Fetch.enable', {
        patterns: [
          { urlPattern: '*', resourceType: 'XHR', requestStage: 'Request' },
          { urlPattern: '*', resourceType: 'Fetch', requestStage: 'Request' },
        ],
      });
      cdp.on('Fetch.requestPaused', (e: { requestId: string; request: { method: string; url: string } }) => {
        const key = responseKey(e.request.method, relativeUrl(e.request.url, options.url));
        const hit = recorded[key];
        if (!hit) replayMisses.add(key);
        const body = hit ? (typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body)) : '{"error":"not recorded"}';
        void cdp
          .send('Fetch.fulfillRequest', {
            requestId: e.requestId,
            responseCode: hit ? hit.status : 404,
            responseHeaders: [{ name: 'Content-Type', value: hit ? hit.mimeType : 'application/json' }],
            body: Buffer.from(body, 'utf8').toString('base64'),
          })
          .catch(() => undefined);
      });
    }

    let current = 0;
    const requests: RawRequest[] = [];
    const byId = new Map<string, RawRequest>();
    const inFlight = new Set<string>();
    let lastActivity = Date.now();
    const pending: Array<Promise<void>> = [];

    cdp.on('Network.requestWillBeSent', (e: {
      requestId: string;
      type?: string;
      request: { method: string; url: string };
      initiator?: { stack?: CdpStackTrace };
    }) => {
      if (!e.type || !API_TYPES.has(e.type)) return;
      const req: RawRequest = {
        step: current,
        method: e.request.method,
        url: e.request.url,
        initiator: initiatorFiles(e.initiator?.stack, options.sourceRoot),
      };
      requests.push(req);
      byId.set(e.requestId, req);
      inFlight.add(e.requestId);
      lastActivity = Date.now();
    });
    cdp.on('Network.responseReceived', (e: { requestId: string; response: { status: number; mimeType: string } }) => {
      const req = byId.get(e.requestId);
      if (!req) return;
      req.status = e.response.status;
      req.mimeType = e.response.mimeType;
    });
    cdp.on('Network.loadingFinished', (e: { requestId: string }) => {
      const req = byId.get(e.requestId);
      if (!req) return;
      pending.push(
        cdp
          .send('Network.getResponseBody', { requestId: e.requestId })
          .then((res) => {
            const { body, base64Encoded } = res as { body: string; base64Encoded: boolean };
            const text = base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
            req.body = parseBody(text, req.mimeType ?? '');
          })
          .catch(() => undefined)
          .finally(() => {
            inFlight.delete(e.requestId);
            lastActivity = Date.now();
          })
      );
    });
    cdp.on('Network.loadingFailed', (e: { requestId: string; errorText: string }) => {
      const req = byId.get(e.requestId);
      if (!req) return;
      req.failure = e.errorText;
      inFlight.delete(e.requestId);
      lastActivity = Date.now();
    });

    const consoleLog: RawStep['console'][] = [];
    const errors: string[][] = [];
    const navigations: string[][] = [];
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') (consoleLog[current] ??= []).push({ type, text: msg.text() });
    });
    page.on('pageerror', (err) => (errors[current] ??= []).push(err.message));
    let lastUrl = '';
    page.on('framenavigated', (frame) => {
      if (frame.parentFrame()) return;
      // A full load reports the same URL more than once; record changes only.
      const url = relativeUrl(frame.url(), options.url);
      if (url === lastUrl) return;
      lastUrl = url;
      (navigations[current] ??= []).push(url);
    });

    const settle = async (): Promise<void> => {
      const started = Date.now();
      await page.waitForTimeout(100);
      while (Date.now() - started < STEP_TIMEOUT) {
        if (inFlight.size === 0 && Date.now() - lastActivity >= options.settleMs) break;
        await page.waitForTimeout(50);
      }
      await Promise.all(pending.splice(0));
    };

    const steps: RawStep[] = [];
    const ran: JourneyStep[] = [];
    const visited = new Set<string>();
    const queue = [...journey.steps];
    while (queue.length > 0) {
      const step = queue.shift() as JourneyStep;
      current = steps.length;
      await perform(page, step, options.url);
      await settle();

      const probe = await page.evaluate<ProbeResult>(`(${probeElements.toString()})()`);
      for (const fact of probe.facts) {
        if (fact.owner?.file) fact.owner.file = normalizeSourcePath(fact.owner.file, options.sourceRoot);
      }
      const { regions, coverage } = assembleRegions(probe.facts);
      steps.push({
        path: probe.path,
        regions,
        coverage,
        navigations: navigations[current] ?? [],
        console: consoleLog[current] ?? [],
        pageErrors: errors[current] ?? [],
        screenshot: await page.screenshot({ type: 'png' }),
      });
      ran.push(step);

      if (explore) {
        visited.add(probe.path);
        const budget = options.explore - ran.length - queue.length;
        if (budget > 0) queue.push(...(await exploreSteps(page, budget, visited)));
      }
    }

    return { journey: { name: journey.name, steps: ran }, steps, requests };
  } finally {
    await context.close();
  }
}

async function perform(page: PageLike, step: JourneyStep, appUrl: string): Promise<void> {
  const timeout = STEP_TIMEOUT;
  if ('goto' in step) {
    await page.goto(new URL(step.goto, appUrl).href, { waitUntil: 'load', timeout: 60_000 });
  } else if ('click' in step) {
    await page.click(step.click, { timeout });
  } else if ('fill' in step) {
    await page.fill(step.fill.selector, step.fill.value, { timeout });
  } else if ('press' in step) {
    await page.press(step.press.selector, step.press.key, { timeout });
  } else {
    await page.waitForTimeout(step.wait);
  }
}

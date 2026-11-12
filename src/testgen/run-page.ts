/**
 * test:run's browser half (ADR-129 §12): a composition's actions fired in the running
 * shell, each placement found in its slot by its boundary stamp (#408), and each placed
 * capability's pack run inside that slot on its MFE's recorded data and clock.
 *
 * An action reaches the shell the way the platform delivers it: posted to the control
 * plane's daemon, which relays it to every connected shell (as `send-action.sh` does).
 */

import { NetworkError } from '@seans-mfe/contracts';
import { launchBrowser, type ChromiumLike } from '../design/dom-capture';
import type { JourneyStep } from '../decompose/journeys';
import type { RecordedResponse } from './contract';
import type { CapabilityPack } from './pack';
import { remoteServed, replayLookup, type Composition, type PackRun, type Placement, type RunReport } from './run';

interface Locator {
  first(): Locator;
  count(): Promise<number>;
  locator(selector: string): Locator;
  /** A function, not a string: a string is evaluated as an expression, never called on the element. */
  evaluate<T>(fn: (e: { textContent: string | null }) => T): Promise<T>;
  click(opts?: { timeout?: number }): Promise<void>;
  fill(value: string, opts?: { timeout?: number }): Promise<void>;
  press(key: string, opts?: { timeout?: number }): Promise<void>;
  selectOption(value: string, opts?: { timeout?: number }): Promise<unknown>;
  getAttribute(name: string): Promise<string | null>;
}

interface Route {
  request(): { method(): string; url(): string; postData(): string | null; resourceType(): string };
  fulfill(r: { status: number; contentType: string; body: string; headers?: Record<string, string> }): Promise<void>;
  continue(): Promise<void>;
}

interface Page {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForLoadState(state: 'networkidle', opts?: { timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  locator(selector: string): Locator;
  route(pattern: string, handler: (route: Route) => Promise<void>): Promise<void>;
  on(event: 'pageerror', handler: (e: Error) => void): void;
  clock: { setFixedTime(time: Date): Promise<void> };
  close(): Promise<void>;
}

interface Browser {
  newContext(opts: { viewport: { width: number; height: number } }): Promise<{ newPage(): Promise<Page>; close(): Promise<void> }>;
  close(): Promise<void>;
}

export interface ComposedOptions {
  shellUrl: string;
  daemonUrl: string;
  composition: Composition;
  packs: CapabilityPack[];
  responses: Map<string, Record<string, RecordedResponse>>;
  /** Milliseconds to wait for a placement to mount. */
  mountTimeout?: number;
}

const CONTROL_PLANE_SETTLE = 1500;

/** Post one action to the daemon, which relays it to every connected shell. */
export async function fireAction(daemonUrl: string, stateKey: string): Promise<void> {
  const id = `${stateKey.replace(/\./g, '-')}-${Date.now()}`;
  const message = {
    direction: 'ACTION',
    kind: 'ACTION',
    payload: { id, componentId: 'test-run', actionType: 'STATE_UPDATE', stateKey, data: {}, timestamp: new Date().toISOString(), context: { sessionId: 'test-run', application: 'web' } },
    metadata: { correlationId: id, acknowledged: false, error: null },
  };
  const res = await fetch(`${daemonUrl.replace(/\/+$/, '')}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'mutation($m:String!){sendMessage(message:$m)}', variables: { m: JSON.stringify(message) } }),
  });
  if (!res.ok) throw new NetworkError(`the control plane's daemon answered ${res.status} to ${stateKey}`, res.status);
}

const stampOf = (p: Placement) => `[data-smt-mfe="${p.mfe}"][data-smt-capability="${p.capability}"]`;

/** Wait for a placement's slot to carry its stamp; the slot's own state says ready or not. */
async function mounted(page: Page, p: Placement, timeout: number): Promise<{ mounted: boolean; error?: string }> {
  const end = Date.now() + timeout;
  for (;;) {
    const slot = page.locator(stampOf(p)).first();
    if ((await slot.count()) > 0) {
      const state = await slot.getAttribute('data-slot-state');
      if (state === 'error') {
        const said = ((await slot.evaluate<string | null>((e) => e.textContent)) ?? '').replace(/\s+/g, ' ').trim();
        return { mounted: false, error: `the slot reports an error${said ? `: "${said.slice(0, 160)}"` : ''}` };
      }
      if (state === null || state === 'ready') return { mounted: true };
    }
    if (Date.now() > end) return { mounted: false, error: `no slot stamped ${p.mfe}/${p.capability} within ${timeout} ms` };
    await page.waitForTimeout(200);
  }
}

/** A fresh page on the shell, the root action fired until the root placement is there, then `stateKey`. */
async function compose(page: Page, o: ComposedOptions, stateKey: string): Promise<void> {
  await page.goto(o.shellUrl, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  const root = o.composition.actions.find((a) => a.stateKey === o.composition.root);
  if (root) {
    // The shell may not have subscribed yet when the first action is relayed: fire until it lands.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.waitForTimeout(CONTROL_PLANE_SETTLE);
      await fireAction(o.daemonUrl, root.stateKey);
      if ((await mounted(page, root.placements[0], 4000)).mounted) break;
    }
  }
  if (stateKey !== o.composition.root) await fireAction(o.daemonUrl, stateKey);
}

/** The first chunk of `expected` a text does not show, in order, whitespace aside; null when it shows all. */
function missingText(pageText: string, expected: string): string | null {
  const page = pageText.replace(/\s+/g, '');
  let at = 0;
  for (const chunk of expected.split(/\s+/).filter(Boolean)) {
    const i = page.indexOf(chunk, at);
    if (i < 0) return chunk;
    at = i + chunk.length;
  }
  return null;
}

async function shows(slot: Locator, expected: Array<{ region: string; text: string }>, timeout: number): Promise<string | null> {
  const end = Date.now() + timeout;
  for (;;) {
    const text = (await slot.evaluate<string | null>((e) => e.textContent)) ?? '';
    const missing = expected.map((r) => ({ r, m: missingText(text, r.text) })).find((x) => x.m !== null);
    if (!missing) return null;
    if (Date.now() > end) {
      const shown = text.replace(/\s+/g, ' ').trim();
      return `${missing.r.region}: "${missing.m}" not shown (the slot shows ${shown ? `"${shown.slice(0, 80)}${shown.length > 80 ? '…' : ''}"` : 'nothing'})`;
    }
    await new Promise((res) => setTimeout(res, 200));
  }
}

/** The selector a step acts on, or null for a wait. */
const targetOf = (a: JourneyStep): string | null =>
  'click' in a ? a.click : 'fill' in a ? a.fill.selector : 'select' in a ? a.select.selector : 'press' in a ? a.press.selector : null;

/**
 * Perform a step inside the capability's slot. 'host' when its control is not there: a step
 * recorded on the standalone page's own chrome (its tabs) rather than on the capability.
 */
async function perform(slot: Locator, action: JourneyStep): Promise<'done' | 'host'> {
  const target = targetOf(action);
  if (target !== null && (await slot.locator(target).count()) === 0) return 'host';
  const t = { timeout: 10_000 };
  if ('click' in action) await slot.locator(action.click).first().click(t);
  else if ('fill' in action) await slot.locator(action.fill.selector).first().fill(action.fill.value, t);
  else if ('select' in action) await slot.locator(action.select.selector).first().selectOption(action.select.value, t);
  else if ('press' in action) await slot.locator(action.press.selector).first().press(action.press.key, t);
  else if ('wait' in action) await new Promise((res) => setTimeout(res, action.wait));
  return 'done';
}

export async function runComposed(o: ComposedOptions, chromium?: ChromiumLike): Promise<Exclude<RunReport['composed'], { skipped: string }>> {
  const pw = chromium ?? ((await import('playwright')).chromium as unknown as ChromiumLike);
  const browser = (await launchBrowser(pw)) as unknown as Browser;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const timeout = o.mountTimeout ?? 20_000;
  const actions: Exclude<RunReport['composed'], { skipped: string }>['actions'] = [];
  const packs: PackRun[] = [];
  try {
    // Every action: does each placement it makes mount in its slot?
    for (const a of o.composition.actions) {
      const page = await context.newPage();
      try {
        await compose(page, o, a.stateKey);
        const placements = [];
        for (const p of a.placements) {
          const m = await mounted(page, p, timeout);
          // Not mounted: say whether the remote is even served, so a gap in the environment
          // does not read as a defect in the MFE.
          const why = !m.mounted && p.remoteEntryUrl ? await remoteServed(p.remoteEntryUrl) : null;
          placements.push({ ...p, ...m, ...(why ? { error: why } : {}) });
        }
        actions.push({ stateKey: a.stateKey, placements });
      } finally {
        await page.close();
      }
    }

    // Every placed capability with a pack: its cases, inside its slot, on its recorded data.
    for (const a of o.composition.actions) {
      for (const p of a.placements) {
        const pack = o.packs.find((x) => x.mfe === p.mfe && x.capability === p.capability);
        if (!pack) continue;
        const run: PackRun = { mfe: p.mfe, capability: p.capability, slot: p.slot, stateKey: a.stateKey, cases: [] };
        for (const c of pack.cases) {
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(String(e)));
          try {
            await page.clock.setFixedTime(new Date(pack.clock));
            await page.route('**/*', async (route) => {
              const req = route.request();
              if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
              const hit = replayLookup(req.method(), req.url(), req.postData() ?? undefined, o.responses);
              if (!hit) return route.continue();
              return route.fulfill({
                status: hit.status,
                contentType: hit.mimeType,
                headers: { 'access-control-allow-origin': '*' },
                body: typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body),
              });
            });
            await compose(page, o, a.stateKey);
            const m = await mounted(page, p, timeout);
            if (!m.mounted) {
              run.cases.push({ name: c.name, ok: false, failure: m.error });
              continue;
            }
            const slot = page.locator(stampOf(p)).first();
            let failure = await shows(slot, c.expect, 10_000);
            let before = JSON.stringify(c.expect);
            for (const step of c.steps) {
              if (failure) break;
              const after = JSON.stringify(step.expect);
              if ((await perform(slot, step.action)) === 'host') {
                // Not the capability's control. Fine if it changed nothing the capability shows.
                if (after !== before) failure = `the control of a step that changed it is not inside the capability: ${targetOf(step.action)}`;
                continue;
              }
              failure = await shows(slot, step.expect, 10_000);
              before = after;
            }
            if (!failure && errors.length > 0) failure = `page error: ${errors[0]}`;
            run.cases.push({ name: c.name, ok: failure === null, ...(failure ? { failure } : {}) });
          } catch (err) {
            run.cases.push({ name: c.name, ok: false, failure: err instanceof Error ? err.message.split('\n')[0] : String(err) });
          } finally {
            await page.close();
          }
        }
        packs.push(run);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  const placed = o.composition.actions.flatMap((a) => a.placements);
  const unpacked = placed
    .filter((p) => !o.packs.some((x) => x.mfe === p.mfe && x.capability === p.capability))
    .filter((p, i, all) => all.findIndex((q) => q.mfe === p.mfe && q.capability === p.capability) === i)
    .map((p) => ({ mfe: p.mfe, capability: p.capability }));
  return { actions, packs, unpacked };
}

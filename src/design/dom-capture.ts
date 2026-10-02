/**
 * Browser half of `design:export`: launch headless Chromium via Playwright,
 * render the URL, run {@link serializePage} in the page, and grab a reference
 * screenshot.
 *
 * Playwright is an optional dependency of the CLI — it ships with the dev
 * install (the e2e suite uses it) but is not a published-runtime requirement.
 * Missing module or missing browser binary surfaces as a typed error with the
 * remediation, never a raw stack.
 */

import { ValidationError } from '@seans-mfe/contracts';
import { serializePage } from './page-serializer';
import type { RawRecord } from './design-tree';

export interface CaptureOptions {
  url: string;
  viewport: { width: number; height: number };
  /** Settle time after `load` — lets lazy data and animations resolve. */
  waitMs: number;
  /** Expand the viewport to the full scroll height before capturing. */
  fullPage: boolean;
}

export interface CaptureResult {
  records: RawRecord[];
  title: string;
  /** PNG bytes of the captured viewport. */
  screenshot: Buffer;
}

interface PageLike {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  evaluate<T>(fn: string): Promise<T>;
  title(): Promise<string>;
  screenshot(opts?: { type?: 'png'; fullPage?: boolean }): Promise<Buffer>;
}

interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

interface ChromiumLike {
  launch(opts?: {
    headless?: boolean;
    channel?: string;
    executablePath?: string;
  }): Promise<BrowserLike>;
}

async function importChromium(): Promise<ChromiumLike> {
  try {
    const pw = await import('playwright');
    return pw.chromium as ChromiumLike;
  } catch {
    throw new ValidationError(
      'design:export needs Playwright to render the page. Install it with `npm i -D playwright` (and `npx playwright install chromium`).',
      'playwright',
      'required'
    );
  }
}

/**
 * Launch Chromium, trying the sane fallbacks in order: Playwright's own
 * download, then the repo's `CHROMIUM_PATH` convention (the rust-wasm gate
 * uses the same var), then a system Chrome channel.
 */
async function launchBrowser(chromium: ChromiumLike): Promise<BrowserLike> {
  const attempts: Array<() => Promise<BrowserLike>> = [() => chromium.launch({ headless: true })];
  if (process.env.CHROMIUM_PATH) {
    attempts.push(() =>
      chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH })
    );
  }
  attempts.push(() => chromium.launch({ headless: true, channel: 'chrome' }));

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
    }
  }
  throw new ValidationError(
    `Could not launch a browser for design capture: ${lastError instanceof Error ? lastError.message.split('\n')[0] : String(lastError)}. ` +
      'Run `npx playwright install chromium`, or set CHROMIUM_PATH to a Chrome/Chromium binary.',
    'browser',
    'launchable'
  );
}

const MAX_FULL_PAGE_HEIGHT = 16000;

export async function captureDesignTree(options: CaptureOptions): Promise<CaptureResult> {
  const chromium = await importChromium();
  const browser = await launchBrowser(chromium);
  try {
    const page = await browser.newPage();
    await page.setViewportSize(options.viewport);
    await page.goto(options.url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(options.waitMs);

    if (options.fullPage) {
      const scrollHeight = await page.evaluate<number>('document.documentElement.scrollHeight');
      const height = Math.min(
        Math.max(scrollHeight, options.viewport.height),
        MAX_FULL_PAGE_HEIGHT
      );
      await page.setViewportSize({ width: options.viewport.width, height });
      // Let layout settle after the resize before reading rects.
      await page.waitForTimeout(200);
    }

    const serialized = await page.evaluate(serializePage);
    const screenshot = await page.screenshot({ type: 'png', fullPage: options.fullPage });
    return { records: serialized.records, title: serialized.title, screenshot };
  } finally {
    await browser.close();
  }
}

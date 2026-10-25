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
import { serializePage, type SerializedPage } from './page-serializer';
import type { RawRecord, Rect } from './design-tree';

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
  /** What was captured, in the records' page coordinates: the viewport, or
   * with `fullPage` the page up to {@link MAX_FULL_PAGE_HEIGHT}. */
  viewport: Rect;
  /** The document's full scroll height, to report what a capture left out. */
  pageHeight: number;
}

export interface PageLike {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  evaluate<T>(fn: string): Promise<T>;
  title(): Promise<string>;
  screenshot(opts?: { type?: 'png'; fullPage?: boolean }): Promise<Buffer>;
}

export interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

export interface ChromiumLike {
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
 *
 * When all of them fail, the error names every attempt and its first error
 * line: the last fallback's failure ("chrome is not found") is rarely the one
 * worth fixing (#409).
 */
export async function launchBrowser(
  chromium: ChromiumLike,
  env: Record<string, string | undefined> = process.env
): Promise<BrowserLike> {
  const attempts: Array<{ label: string; launch: () => Promise<BrowserLike> }> = [
    { label: 'bundled', launch: () => chromium.launch({ headless: true }) },
  ];
  const chromiumPath = env.CHROMIUM_PATH;
  if (chromiumPath) {
    attempts.push({
      label: `CHROMIUM_PATH=${chromiumPath}`,
      launch: () => chromium.launch({ headless: true, executablePath: chromiumPath }),
    });
  }
  attempts.push({
    label: 'channel chrome',
    launch: () => chromium.launch({ headless: true, channel: 'chrome' }),
  });

  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      return await attempt.launch();
    } catch (err) {
      const firstLine = (err instanceof Error ? err.message : String(err)).split('\n')[0];
      failures.push(`${attempt.label}: ${firstLine}`);
    }
  }
  throw new ValidationError(
    `Could not launch a browser for design capture (${failures.join('; ')}). ` +
      'Run `npx playwright install chromium`, or set CHROMIUM_PATH to a Chrome/Chromium binary.',
    'browser',
    'launchable'
  );
}

/** Tallest viewport a full-page capture expands to; Chromium cannot screenshot
 * much beyond it. Content below it is left out of the design and reported. */
export const MAX_FULL_PAGE_HEIGHT = 16000;

/**
 * Run {@link serializePage} in the page and bring the result back as one JSON
 * string. Returning the object directly makes Playwright serialize it value
 * by value: 34s for a 50k-node page, against 4s as a string (#409).
 */
export async function serializeInPage(page: Pick<PageLike, 'evaluate'>): Promise<SerializedPage> {
  const json = await page.evaluate<string>(`JSON.stringify((${serializePage.toString()})())`);
  return JSON.parse(json) as SerializedPage;
}

export async function captureDesignTree(
  options: CaptureOptions,
  chromium?: ChromiumLike
): Promise<CaptureResult> {
  const browser = await launchBrowser(chromium ?? (await importChromium()));
  try {
    const page = await browser.newPage();
    await page.setViewportSize(options.viewport);
    await page.goto(options.url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(options.waitMs);

    const pageHeight = await page.evaluate<number>('document.documentElement.scrollHeight');
    if (options.fullPage) {
      const height = Math.min(Math.max(pageHeight, options.viewport.height), MAX_FULL_PAGE_HEIGHT);
      await page.setViewportSize({ width: options.viewport.width, height });
      // Let layout settle after the resize before reading rects.
      await page.waitForTimeout(200);
    }

    const serialized = await serializeInPage(page);
    const viewport = await page.evaluate<Rect>(
      '({ x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight })'
    );
    // The viewport already spans the page in full-page mode, so a viewport
    // screenshot is the full page — and stays within what Chromium can capture,
    // which `fullPage: true` on a very tall document does not.
    const screenshot = await page.screenshot({ type: 'png' });
    return { records: serialized.records, title: serialized.title, screenshot, viewport, pageHeight };
  } finally {
    await browser.close();
  }
}

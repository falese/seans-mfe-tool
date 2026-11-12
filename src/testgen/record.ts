/**
 * Recording: a journey file run against a running MFE, written as an evidence
 * bundle (ADR-109) for test:generate to generate from (ADR-129 §9). The same
 * capture `decompose:capture` runs, with no exploration: the journey file —
 * written by hand or by the crawler — is the whole of what is driven.
 */

import * as fs from 'fs-extra';
import { buildBundle, writeBundle, type BundleStats } from '../decompose/bundle';
import { captureEvidence } from '../decompose/capture';
import type { Journey } from '../decompose/journeys';
import { crawl, journeysYaml, type CrawlResult } from './crawl';
import { pageDriver } from './crawl-page';

export interface RecordOptions {
  url: string;
  journeys: Journey[];
  outDir: string;
  viewport: { width: number; height: number };
  /** Frozen page clock, ISO-8601. */
  clock: string;
  settleMs: number;
}

export async function recordJourneys(opts: RecordOptions): Promise<{ stats: BundleStats; replayMisses: string[] }> {
  const outcome = await captureEvidence({
    url: opts.url,
    journeys: opts.journeys,
    explore: 0,
    viewport: opts.viewport,
    clock: opts.clock,
    settleMs: opts.settleMs,
  });
  const bundle = buildBundle(outcome.runs, { appUrl: opts.url, viewport: opts.viewport, clock: opts.clock });
  await fs.ensureDir(opts.outDir);
  await writeBundle(opts.outDir, bundle);
  return { stats: bundle.stats, replayMisses: outcome.replayMisses };
}

export interface CrawlFileOptions {
  url: string;
  /** Where every journey starts, app-relative (default: the URL's own path). */
  start?: string;
  out: string;
  maxInteractions: number;
  exclude?: RegExp;
  viewport: { width: number; height: number };
  settleMs: number;
}

/** Crawl a running MFE and write its journey file. */
export async function crawlToFile(opts: CrawlFileOptions): Promise<CrawlResult> {
  const u = new URL(opts.url);
  const driver = await pageDriver({ url: opts.url, viewport: opts.viewport, settleMs: opts.settleMs });
  try {
    const result = await crawl(driver, { start: opts.start ?? u.pathname + u.search, maxInteractions: opts.maxInteractions, exclude: opts.exclude });
    await fs.outputFile(opts.out, journeysYaml(result, opts.url));
    return result;
  } finally {
    await driver.close();
  }
}

export function parseViewport(text: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(text);
  if (!m) return { width: 1440, height: 900 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

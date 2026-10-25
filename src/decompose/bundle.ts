/**
 * The evidence bundle (ADR-109 §1): what one capture run observed, written
 * once and read by every later stage.
 *
 *   bundle.json              run summary: app, viewport, frozen clock, journeys, stats
 *   journeys.yaml            the journeys that ran (explored ones included) — replayable
 *   journeys/<name>.json     per step: action, path, regions, requests, console, screenshot
 *   requests.json            every XHR/fetch: step, initiator files, region attribution
 *   responses.json           first response per `METHOD url`, for --replay
 *   screens/<step>.png       screenshot after each step
 *
 * Every JSON file is written with sorted keys and contains no wall-clock data,
 * so two runs over the same journeys and recorded responses produce identical
 * files. Screenshots are kept beside the JSON but are not part of that promise.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { attributeRequests, distinctiveValues, type Attribution } from './attribution';
import { describeStep, type Journey } from './journeys';
import type { Region, SourceCoverage } from './regions';

export const BUNDLE_FORMAT = 'smt-evidence/1';

/** A request as the browser half recorded it. */
export interface RawRequest {
  /** Index of the step during which it was sent. */
  step: number;
  method: string;
  /** Absolute URL. */
  url: string;
  initiator: string[];
  status?: number;
  mimeType?: string;
  /** Parsed JSON when the response was JSON, otherwise the text. */
  body?: unknown;
  /** Set when the request failed or was not answered. */
  failure?: string;
}

export interface RawStep {
  /** Path after the step settled. */
  path: string;
  regions: Region[];
  coverage: SourceCoverage;
  /** Main-frame URLs (app-relative) navigated to during the step. */
  navigations: string[];
  console: Array<{ type: string; text: string }>;
  pageErrors: string[];
  screenshot: Buffer;
}

export interface JourneyRun {
  journey: Journey;
  steps: RawStep[];
  requests: RawRequest[];
}

export interface BundleMeta {
  appUrl: string;
  viewport: { width: number; height: number };
  clock: string;
}

export interface RecordedResponse {
  status: number;
  mimeType: string;
  body: unknown;
}

export interface BundleStats {
  steps: number;
  regions: number;
  requests: number;
  attributedRequests: number;
  sourceCoverage: SourceCoverage;
  consoleErrors: number;
  pageErrors: number;
}

export interface Bundle {
  /** Relative path → JSON value (or text for `.yaml`). */
  files: Record<string, unknown>;
  screenshots: Record<string, Buffer>;
  stats: BundleStats;
}

const MAX_OWN_TEXT = 2000;

/** Console text with run-specific tokens masked: memory addresses differ on every run. */
export function normalizeConsoleText(text: string): string {
  return text.replace(/\b0x[0-9a-f]{6,}\b/gi, '0x…');
}

/** The app-relative form of a URL on the app's origin; other origins stay absolute. */
export function relativeUrl(url: string, appUrl: string): string {
  try {
    const u = new URL(url);
    const app = new URL(appUrl);
    return u.origin === app.origin ? u.pathname + u.search : url;
  } catch {
    return url;
  }
}

/**
 * What a development server requests for itself — its live-reload socket and
 * hot-update manifests — rather than anything the app does (#442). Matched on
 * the path's start, so an app's own `/api/ws/...` is not mistaken for it.
 */
export function isDevServerRequest(url: string): boolean {
  const p = relativeUrl(url, url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  return /^\/(sockjs-node|__webpack_hmr|webpack-dev-server|ws$|@vite\/)/.test(p) || /\.hot-update\.(json|js)$/.test(p);
}

export function responseKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

/** Fold raw journey runs into the bundle's files. Pure: same runs, same bundle. */
export function buildBundle(runs: JourneyRun[], meta: BundleMeta): Bundle {
  const files: Record<string, unknown> = {};
  const screenshots: Record<string, Buffer> = {};
  const allRequests: Array<Record<string, unknown>> = [];
  const responses: Record<string, RecordedResponse> = {};
  const regionIds = new Set<string>();
  const coverage: SourceCoverage = { visibleElements: 0, mappedToSource: 0 };
  let steps = 0;
  let attributed = 0;
  let consoleErrors = 0;
  let pageErrors = 0;

  for (const run of runs) {
    const name = run.journey.name;
    const stepId = (k: number) => `${name}.${k}`;

    // Stable ids: per step, sorted by method then URL, then original order.
    const ids = new Map<RawRequest, string>();
    const appRequests = run.requests.filter((r) => !isDevServerRequest(r.url));
    for (let k = 0; k < run.steps.length; k += 1) {
      appRequests
        .map((r, order) => ({ r, order, url: relativeUrl(r.url, meta.appUrl) }))
        .filter((x) => x.r.step === k)
        .sort((a, b) => a.r.method.localeCompare(b.r.method) || a.url.localeCompare(b.url) || a.order - b.order)
        .forEach((x, n) => ids.set(x.r, `${stepId(k)}.r${n}`));
    }
    const ordered = [...ids.entries()].sort((a, b) => {
      const [as, bs] = [a[0].step, b[0].step];
      return as - bs || a[1].localeCompare(b[1], 'en', { numeric: true });
    });

    // Data shown at step k may have been loaded at any earlier step.
    const values = new Map(ordered.map(([r, id]) => [id, distinctiveValues(r.body)]));
    const attribution = new Map<string, Attribution[]>();
    run.steps.forEach((step, k) => {
      const loaded = ordered
        .filter(([r]) => r.step <= k)
        .map(([r, id]) => ({ id, initiator: r.step === k ? r.initiator : [], values: values.get(id) ?? [] }));
      for (const a of attributeRequests(loaded, step.regions)) {
        const list = attribution.get(a.request) ?? [];
        if (!list.some((x) => x.region === a.region && x.via === a.via)) list.push(a);
        attribution.set(a.request, list);
      }
    });

    for (const [r, id] of ordered) {
      const url = relativeUrl(r.url, meta.appUrl);
      const attributedTo = (attribution.get(id) ?? [])
        .map(({ region, via }) => ({ region, via }))
        .sort((a, b) => a.region.localeCompare(b.region) || a.via.localeCompare(b.via));
      if (attributedTo.length > 0) attributed += 1;
      allRequests.push({
        id,
        journey: name,
        step: stepId(r.step),
        method: r.method,
        url,
        status: r.status ?? null,
        mimeType: r.mimeType ?? null,
        failure: r.failure ?? null,
        initiator: r.initiator,
        attributedTo,
      });
      const key = responseKey(r.method, url);
      if (!(key in responses) && r.status !== undefined && r.failure === undefined) {
        responses[key] = { status: r.status, mimeType: r.mimeType ?? 'application/octet-stream', body: r.body ?? null };
      }
    }

    files[`journeys/${name}.json`] = {
      name,
      steps: run.steps.map((step, k) => {
        steps += 1;
        coverage.visibleElements += step.coverage.visibleElements;
        coverage.mappedToSource += step.coverage.mappedToSource;
        consoleErrors += step.console.filter((c) => c.type === 'error').length;
        pageErrors += step.pageErrors.length;
        step.regions.forEach((r) => regionIds.add(r.id));
        const shot = `screens/${stepId(k)}.png`;
        screenshots[shot] = step.screenshot;
        return {
          id: stepId(k),
          action: describeStep(run.journey.steps[k]),
          path: step.path,
          navigations: step.navigations,
          requests: ordered.filter(([r]) => r.step === k).map(([, rid]) => rid),
          regions: step.regions.map((r) => ({ ...r, ownText: r.ownText.slice(0, MAX_OWN_TEXT) })),
          coverage: step.coverage,
          console: step.console.map((c) => ({ type: c.type, text: normalizeConsoleText(c.text) })),
          pageErrors: step.pageErrors,
          screenshot: shot,
        };
      }),
    };
  }

  const stats: BundleStats = {
    steps,
    regions: regionIds.size,
    requests: allRequests.length,
    attributedRequests: attributed,
    sourceCoverage: coverage,
    consoleErrors,
    pageErrors,
  };
  files['bundle.json'] = {
    format: BUNDLE_FORMAT,
    app: meta.appUrl,
    viewport: meta.viewport,
    clock: meta.clock,
    journeys: runs.map((r) => r.journey.name),
    stats,
  };
  files['requests.json'] = allRequests;
  files['responses.json'] = responses;
  files['journeys.yaml'] = yaml.dump({ journeys: runs.map((r) => r.journey) }, { lineWidth: -1 });
  return { files, screenshots, stats };
}

/** JSON with object keys sorted at every depth, two-space indent, trailing newline. */
export function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object' && !Buffer.isBuffer(v)) {
      const obj = v as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(obj)
          .sort()
          .map((k) => [k, sort(obj[k])])
      );
    }
    return v;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** Write a bundle into `dir`, replacing a previous bundle's files there. Returns the paths written. */
export async function writeBundle(dir: string, bundle: Bundle): Promise<string[]> {
  for (const stale of ['journeys', 'screens']) await fs.remove(path.join(dir, stale));
  const written: string[] = [];
  for (const [rel, value] of Object.entries(bundle.files)) {
    const full = path.join(dir, rel);
    await fs.ensureDir(path.dirname(full));
    await fs.writeFile(full, typeof value === 'string' ? value : stableStringify(value));
    written.push(full);
  }
  for (const [rel, png] of Object.entries(bundle.screenshots)) {
    const full = path.join(dir, rel);
    await fs.ensureDir(path.dirname(full));
    await fs.writeFile(full, png);
    written.push(full);
  }
  return written.sort();
}

/** What a previous bundle offers a replay: its recorded responses, clock and journeys. */
export interface ReplaySource {
  responses: Record<string, RecordedResponse>;
  clock: string;
  journeysYaml: string;
}

export async function readReplaySource(dir: string): Promise<ReplaySource> {
  const meta = (await fs.readJson(path.join(dir, 'bundle.json'))) as { clock: string };
  const responses = (await fs.readJson(path.join(dir, 'responses.json'))) as Record<string, RecordedResponse>;
  const journeysYaml = await fs.readFile(path.join(dir, 'journeys.yaml'), 'utf8');
  return { responses, clock: meta.clock, journeysYaml };
}

/**
 * The parity gate's comparison (ADR-113): did the candidate app, driven
 * through the baseline's journeys on the baseline's recorded data, do what the
 * baseline did?
 *
 * Per step it compares four things:
 *
 *   content  the same regions, with the same text, under the same parents
 *   network  the same backend calls; a request to a BFF counts as the backend calls it
 *            stands for, and a domain re-loading data the baseline had already loaded
 *            is a repeat, not a failure (ADR-127 §4)
 *   console  no error the baseline did not already have
 *   visual   each region's own pixels (its nested regions excluded), compared
 *            by content so a region that moved on the page still matches;
 *            like Playwright's toHaveScreenshot, no pixel may differ by default
 *
 * Regions are matched by component and order of appearance, never by source
 * file: a decomposed app renders the same components from new files, inside
 * wrappers the shell adds. A wrapper with no text of its own is not a
 * difference; new visible text is.
 */

import type { Region } from '../regions';
import { decodePng, diffRegion, type Image } from './png';

export interface StepView {
  id: string;
  path: string;
  regions: Region[];
  requests: string[];
  console: Array<{ type: string; text: string }>;
  pageErrors: string[];
  screenshot: string;
}

export interface BundleView {
  journeys: Array<{ name: string; steps: StepView[] }>;
  /**
   * Request id → its method and app-relative URL; for a request to a BFF, the
   * backend calls it stands for (ADR-127 §4).
   */
  requests: Record<string, { method: string; url: string; calls?: string[] }>;
}

export interface StepParity {
  id: string;
  ok: boolean;
  /** The candidate never ran this step. */
  missing?: true;
  /** Set when the step settled on a different path. */
  path?: { baseline: string; candidate: string };
  content: {
    missing: string[];
    changed: Array<{ region: string; baseline: string; candidate: string }>;
    moved: Array<{ region: string; baseline: string; candidate: string }>;
    added: string[];
  };
  /** `repeated`: calls through a BFF to data the baseline had already loaded by this step. */
  network: { missing: string[]; extra: string[]; repeated: string[] };
  console: { new: string[] };
  visual: { compared: number; failed: string[] };
}

export interface ParityReport {
  parity: boolean;
  journeys: Array<{ name: string; ok: boolean; steps: StepParity[] }>;
  summary: {
    steps: number;
    stepsAtParity: number;
    regions: number;
    regionsAtParity: number;
    requests: number;
    newConsoleErrors: number;
    visualFailures: number;
  };
}

export interface CompareOptions {
  /** The screenshot of a step on one side; visual comparison is skipped without it. */
  screenshot?: (side: 'baseline' | 'candidate', step: StepView) => Buffer | undefined;
  /** Pixels a region may have changed before it fails (default 0, as `toHaveScreenshot`). */
  maxDiffPixels?: number;
  /** Per-channel difference (0–255) a pixel may have before it counts as changed (default 4). */
  pixelTolerance?: number;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Each region's key — component and its order among that component's regions — and its parent's. */
function keyed(regions: Region[]): Map<string, { region: Region; parentId: string | null }> {
  const count = new Map<string, number>();
  const out = new Map<string, { region: Region; parentId: string | null }>();
  for (const r of regions) {
    const n = count.get(r.component) ?? 0;
    count.set(r.component, n + 1);
    out.set(`${r.component}#${n}`, { region: r, parentId: r.parent });
  }
  return out;
}

/** The key of the nearest ancestor of `id` whose key is in `known`. */
function nearestKnownAncestor(byKey: Map<string, { region: Region; parentId: string | null }>, parentId: string | null, known: Set<string>): string | null {
  const keyOfId = new Map([...byKey.entries()].map(([k, v]) => [v.region.id, k]));
  let at = parentId;
  for (let guard = 0; at && guard < 1000; guard += 1) {
    const k = keyOfId.get(at);
    if (k && known.has(k)) return k;
    at = k ? (byKey.get(k)?.parentId ?? null) : null;
  }
  return null;
}

/** `b` minus `a`, as multisets. */
function minus(b: string[], a: string[]): string[] {
  const left = [...a];
  const out: string[] = [];
  for (const x of b) {
    const i = left.indexOf(x);
    if (i >= 0) left.splice(i, 1);
    else out.push(x);
  }
  return out;
}

const errorsOf = (s: StepView) => [...s.console.filter((c) => c.type === 'error').map((c) => `error: ${c.text}`), ...s.pageErrors.map((e) => `pageerror: ${e}`)];

function emptyStep(id: string): StepParity {
  return {
    id,
    ok: false,
    missing: true,
    content: { missing: [], changed: [], moved: [], added: [] },
    network: { missing: [], extra: [], repeated: [] },
    console: { new: [] },
    visual: { compared: 0, failed: [] },
  };
}

type Calls = (id: string) => { keys: string[]; viaBff: boolean };

/**
 * ADR-113's exact rule for calls made directly; for calls through a BFF
 * (ADR-127 §4), one the baseline had already made by this step is a repeat.
 */
function compareNetwork(baseCalls: string[], candidate: Array<{ keys: string[]; viaBff: boolean }>, loadedBefore: Set<string>): StepParity['network'] {
  const remaining = [...baseCalls];
  const consume = (k: string): boolean => {
    const i = remaining.indexOf(k);
    if (i < 0) return false;
    remaining.splice(i, 1);
    return true;
  };
  const extra: string[] = [];
  const repeated: string[] = [];
  for (const c of candidate.filter((x) => !x.viaBff)) for (const k of c.keys) if (!consume(k)) extra.push(k);
  for (const c of candidate.filter((x) => x.viaBff)) {
    for (const k of c.keys) {
      if (consume(k)) continue;
      if (loadedBefore.has(k) || baseCalls.includes(k)) repeated.push(k);
      else extra.push(k);
    }
  }
  return { missing: remaining, extra, repeated };
}

function compareStep(
  base: StepView,
  cand: StepView,
  calls: { baseline: Calls; candidate: Calls },
  opts: CompareOptions,
  loadedBefore: Set<string> = new Set()
): StepParity {
  const b = keyed(base.regions);
  const c = keyed(cand.regions);
  const baseKeys = new Set(b.keys());
  const content: StepParity['content'] = { missing: [], changed: [], moved: [], added: [] };
  for (const [key, { region, parentId }] of b) {
    const other = c.get(key);
    if (!other) {
      content.missing.push(key);
      continue;
    }
    if (norm(region.ownText) !== norm(other.region.ownText)) content.changed.push({ region: key, baseline: norm(region.ownText), candidate: norm(other.region.ownText) });
    const wasUnder = nearestKnownAncestor(b, parentId, baseKeys);
    const isUnder = nearestKnownAncestor(c, other.parentId, baseKeys);
    if (wasUnder !== isUnder) content.moved.push({ region: key, baseline: wasUnder ?? '(root)', candidate: isUnder ?? '(root)' });
  }
  for (const [key, { region }] of c) if (!baseKeys.has(key) && norm(region.ownText)) content.added.push(`${key}: ${norm(region.ownText)}`);

  const baseCalls = base.requests.flatMap((id) => calls.baseline(id).keys);
  const network = compareNetwork(baseCalls, cand.requests.map(calls.candidate), loadedBefore);
  const consoleNew = minus(errorsOf(cand), errorsOf(base));

  const visual: StepParity['visual'] = { compared: 0, failed: [] };
  const shotA = opts.screenshot?.('baseline', base);
  const shotB = opts.screenshot?.('candidate', cand);
  if (shotA && shotB) {
    const imgA: Image = decodePng(shotA);
    const imgB: Image = decodePng(shotB);
    const budget = opts.maxDiffPixels ?? 0;
    for (const [key, { region }] of b) {
      const other = c.get(key);
      if (!other) continue;
      const exclude = base.regions.filter((r) => r.parent === region.id).map((r) => r.rect);
      const { pixels, differing } = diffRegion(imgA, region.rect, imgB, other.region.rect, { exclude, tolerance: opts.pixelTolerance });
      if (pixels === 0) continue;
      visual.compared += 1;
      if (differing > budget) visual.failed.push(key);
    }
  }

  const path = base.path === cand.path ? {} : { path: { baseline: base.path, candidate: cand.path } };
  const ok =
    !('path' in path) &&
    content.missing.length + content.changed.length + content.moved.length + content.added.length === 0 &&
    network.missing.length + network.extra.length === 0 &&
    consoleNew.length === 0 &&
    visual.failed.length === 0;
  return { id: base.id, ok, ...path, content, network, console: { new: consoleNew }, visual };
}

export function compareBundles(baseline: BundleView, candidate: BundleView, opts: CompareOptions = {}): ParityReport {
  const call = (requests: BundleView['requests']): Calls => (id: string) => {
    const r = requests[id];
    if (!r) return { keys: [`? ${id}`], viaBff: false };
    return r.calls ? { keys: r.calls, viaBff: true } : { keys: [`${r.method} ${r.url}`], viaBff: false };
  };
  const calls = { baseline: call(baseline.requests), candidate: call(candidate.requests) };
  const summary: ParityReport['summary'] = { steps: 0, stepsAtParity: 0, regions: 0, regionsAtParity: 0, requests: 0, newConsoleErrors: 0, visualFailures: 0 };
  const journeys = baseline.journeys.map((j) => {
    const other = candidate.journeys.find((x) => x.name === j.name);
    // What the baseline had loaded by each step: a domain re-loading it through its BFF repeats it.
    const loaded = new Set<string>();
    const steps = j.steps.map((s, k) => {
      const cand = other?.steps[k];
      const result = cand ? compareStep(s, cand, calls, opts, new Set(loaded)) : emptyStep(s.id);
      for (const id of s.requests) for (const key of calls.baseline(id).keys) loaded.add(key);
      summary.steps += 1;
      summary.regions += s.regions.length;
      summary.requests += s.requests.length;
      if (result.ok) summary.stepsAtParity += 1;
      if (!result.missing) {
        const bad = new Set([
          ...result.content.missing,
          ...result.content.changed.map((x) => x.region),
          ...result.content.moved.map((x) => x.region),
          ...result.visual.failed,
        ]);
        summary.regionsAtParity += s.regions.length - bad.size;
      }
      summary.newConsoleErrors += result.console.new.length;
      summary.visualFailures += result.visual.failed.length;
      return result;
    });
    return { name: j.name, ok: steps.every((s) => s.ok), steps };
  });
  return { parity: journeys.every((j) => j.ok), journeys, summary };
}

/** Routes (React Router patterns) that no visited path matches: behavior no journey exercised. */
export function routeGaps(routes: string[], visited: string[]): string[] {
  const pattern = (r: string) =>
    new RegExp(
      `^${r
        .split('/')
        .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg === '*' ? '.*' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('/')}/?$`
    );
  return [...new Set(routes)].filter((r) => !visited.some((p) => pattern(r).test(p.split('?')[0])));
}

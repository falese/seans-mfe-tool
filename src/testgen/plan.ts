/**
 * What to test, from what a capture observed (ADR-129 §2): per capability, the
 * states it was seen in and what it showed there; per journey step, what each
 * of the MFE's capabilities drew, the backend calls behind it, and the pixels
 * to hold it to.
 *
 * Pure: an evidence view and an MFE in, a plan out. The emitters turn the plan
 * into files (`emit.ts`); nothing here touches the disk.
 */

import type { JourneyStep } from '../decompose/journeys';
import type { Region } from '../decompose/regions';
import { capabilityView, rectIn, type CapabilityRef, type Rect } from './select';

/** One step of a capture, as the bundle's `journeys/<name>.json` records it. */
export interface EvidenceStep {
  id: string;
  path: string;
  regions: Region[];
  requests: string[];
  console: Array<{ type: string; text: string }>;
  pageErrors: string[];
  screenshot: string;
}

export interface EvidenceRequest {
  id: string;
  method: string;
  url: string;
  attributedTo: Array<{ region: string }>;
}

export interface Evidence {
  app: string;
  clock: string;
  viewport: { width: number; height: number };
  journeys: Array<{ name: string; actions: JourneyStep[]; steps: EvidenceStep[] }>;
  requests: EvidenceRequest[];
}

export interface TestTarget {
  /** The MFE's name, as its manifest declares it. */
  mfe: string;
  capabilities: Array<CapabilityRef & {
    /**
     * Why it cannot be rendered on its own, when it cannot: a capability drawn
     * by another one for each item of a list gets its props from that one.
     */
    notAlone?: string;
  }>;
  /** Components that are placed capabilities anywhere in the composition: where a view stops. */
  boundaries: string[];
}

export interface RegionExpectation {
  region: string;
  text: string;
}

/** One state a capability was seen in, rendered alone in jsdom. */
export interface AloneCase {
  step: string;
  path: string;
  regions: RegionExpectation[];
  /** `METHOD url` the monolith made for what this capability shows, by this step. */
  calls: string[];
  /** Console errors the baseline already had at this step: not new. */
  consoleErrors: string[];
  /** The props it was shown with, from a hosted route (`/BerthTile?berthId=b2`, ADR-129 §13). */
  props: Record<string, string>;
}

/** Props from a hosted route's query: `/BerthTile?berthId=b2` → `{ berthId: 'b2' }`. */
export function routeProps(route: string): Record<string, string> {
  const q = route.indexOf('?');
  return q < 0 ? {} : Object.fromEntries(new URLSearchParams(route.slice(q + 1)).entries());
}

export interface CapabilityPlan {
  capability: string;
  component: string;
  cases: AloneCase[];
  /** Set when there is no alone test, with why. */
  skipped?: string;
}

export interface StepCapability {
  capability: string;
  regions: RegionExpectation[];
  calls: string[];
  /** The baseline image name and where to take it; null when the capability is off screen. */
  visual: { name: string; rect: Rect; exclude: Rect[] } | null;
}

export interface JourneyPlan {
  name: string;
  steps: Array<{ id: string; action: JourneyStep; path: string; capabilities: StepCapability[]; consoleErrors: string[] }>;
}

export interface TestPlan {
  mfe: string;
  app: string;
  clock: string;
  viewport: { width: number; height: number };
  capabilities: CapabilityPlan[];
  journeys: JourneyPlan[];
  /** Every `METHOD url` some expectation depends on. */
  calls: string[];
}

const errorsOf = (s: EvidenceStep): string[] => [...s.console.filter((c) => c.type === 'error').map((c) => c.text), ...s.pageErrors];

/**
 * A baseline's file name, as Playwright's snapshot lookup spells it: it turns
 * every run of ASCII punctuation but `-` into one `-` (`sanitizeForFilePath`).
 */
export const baselineName = (step: string, capability: string): string => `${step}-${capability}`.replace(/[^A-Za-z0-9\u0080-￿-]+/g, '-');

export function planTests(evidence: Evidence, target: TestTarget): TestPlan {
  const boundaries = new Set(target.boundaries);
  const byId = new Map(evidence.requests.map((r) => [r.id, r]));
  const capabilities: CapabilityPlan[] = target.capabilities.map((c) => ({ capability: c.name, component: c.component, cases: [], ...(c.notAlone ? { skipped: c.notAlone } : {}) }));
  const seenPaths = new Map<string, Set<string>>(target.capabilities.map((c) => [c.name, new Set<string>()]));
  const allCalls = new Set<string>();
  const journeys: JourneyPlan[] = [];

  for (const j of evidence.journeys) {
    const plan: JourneyPlan = { name: j.name, steps: [] };
    // Requests made so far in this journey: data shown at step k may have loaded at any earlier step.
    const sofar: EvidenceRequest[] = [];
    j.steps.forEach((step, k) => {
      for (const id of step.requests) {
        const r = byId.get(id);
        if (r) sofar.push(r);
      }
      const caps: StepCapability[] = [];
      for (const cap of target.capabilities) {
        const view = capabilityView(step.regions, cap, boundaries);
        if (view.regions.length === 0) continue;
        const ids = new Set(view.regions.map((r) => r.id));
        const regions = view.regions.filter((r) => r.ownText.trim() !== '').map((r) => ({ region: r.id, text: r.ownText }));
        const calls = [...new Set(sofar.filter((r) => r.attributedTo.some((a) => ids.has(a.region))).map((r) => `${r.method.toUpperCase()} ${r.url}`))].sort();
        calls.forEach((c) => allCalls.add(c));
        const rect = view.rect ? rectIn(view.rect, evidence.viewport) : null;
        const exclude = view.exclude.map((e) => rectIn(e, evidence.viewport)).filter((e): e is Rect => e !== null);
        caps.push({ capability: cap.name, regions, calls, visual: rect ? { name: baselineName(step.id, cap.name), rect, exclude } : null });

        // Alone: the first time the capability is seen at a path is how a URL reaches it.
        const seen = seenPaths.get(cap.name) as Set<string>;
        const planFor = capabilities.find((p) => p.capability === cap.name) as CapabilityPlan;
        if (!planFor.skipped && !seen.has(step.path)) {
          seen.add(step.path);
          planFor.cases.push({ step: step.id, path: step.path, regions, calls, consoleErrors: errorsOf(step), props: routeProps(step.path) });
        }
      }
      plan.steps.push({ id: step.id, action: j.actions[k] ?? { wait: 0 }, path: step.path, capabilities: caps, consoleErrors: errorsOf(step) });
    });
    journeys.push(plan);
  }

  for (const p of capabilities) if (!p.skipped && p.cases.length === 0) p.skipped = 'not on screen in any captured step';
  return {
    mfe: target.mfe,
    app: evidence.app,
    clock: evidence.clock,
    viewport: evidence.viewport,
    capabilities,
    journeys,
    calls: [...allCalls].sort(),
  };
}

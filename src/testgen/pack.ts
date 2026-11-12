/**
 * Capability test packs (ADR-129 §12): a capability's recorded states, cut
 * loose from the page they were recorded on, so any host that mounts the
 * capability can run them.
 *
 * A case starts where a journey first shows the capability — how the page got
 * there (the standalone page's tabs, a route) is the host's business, not the
 * capability's — and keeps the journey's steps while the capability stays on
 * screen. Each step is the action, performed inside the capability's own root,
 * and what the capability showed after it. `test:run` fires a composition's
 * action, finds the capability's slot by its boundary stamp, and runs the
 * pack there.
 *
 * Pure: a test plan in, packs out.
 */

import type { JourneyStep } from '../decompose/journeys';
import type { RegionExpectation, TestPlan } from './plan';

export interface PackStep {
  action: JourneyStep;
  /** What the capability shows after the action. */
  expect: RegionExpectation[];
}

export interface PackCase {
  /** The journey it was cut from. */
  name: string;
  /** What the capability shows when it is first on screen. */
  expect: RegionExpectation[];
  steps: PackStep[];
}

export interface CapabilityPack {
  mfe: string;
  capability: string;
  /** The app the pack was recorded on: its origin keys the MFE's recorded responses. */
  app: string;
  clock: string;
  cases: PackCase[];
}

export function planPacks(plan: TestPlan): CapabilityPack[] {
  const byCapability = new Map<string, PackCase[]>();
  for (const journey of plan.journeys) {
    const names = new Set(journey.steps.flatMap((s) => s.capabilities.map((c) => c.capability)));
    for (const capability of names) {
      const on = (k: number) => journey.steps[k]?.capabilities.find((c) => c.capability === capability);
      const first = journey.steps.findIndex((_s, k) => on(k) !== undefined);
      if (first < 0) continue;
      const steps: PackStep[] = [];
      for (let k = first + 1; k < journey.steps.length; k += 1) {
        const shown = on(k);
        const action = journey.steps[k].action;
        if (!shown || 'goto' in action) break;
        steps.push({ action, expect: shown.regions });
      }
      const cases = byCapability.get(capability) ?? [];
      const key = JSON.stringify(steps.map((s) => s.action));
      if (!cases.some((c) => JSON.stringify(c.steps.map((s) => s.action)) === key)) {
        cases.push({ name: journey.name, expect: on(first)?.regions ?? [], steps });
      }
      byCapability.set(capability, cases);
    }
  }
  return [...byCapability.entries()].map(([capability, cases]) => ({
    mfe: plan.mfe,
    capability,
    app: plan.app,
    clock: plan.clock,
    // Longest first: the most behaviour per page load when a host runs them.
    cases: [...cases].sort((a, b) => b.steps.length - a.steps.length),
  }));
}

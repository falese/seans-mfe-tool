/**
 * Where a directory stands in a flow (ADR-119 §2), derived from its files on
 * every call. Nothing records progress, so nothing can disagree with the files.
 *
 * Pure: the filesystem comes in as a probe and the host's knowledge as named
 * checks, each shaped like a sentinel ValidatePort lifted to a step (ADR-089).
 */

import * as path from 'path';
import { ValidationError } from '@seans-mfe/contracts';
import type { Flow, FlowStep } from './flow';

export interface FlowProbe {
  /** Modification time in ms, or null when the path does not exist. */
  mtime(file: string): number | null;
  /** The parsed JSON at the path, or undefined. */
  readJson(file: string): unknown;
}

export interface CheckResult {
  done: boolean;
  /** Done, but no longer true of the current files (an approval after the proposal changed). */
  stale?: boolean;
  detail?: string;
}

export type FlowChecks = Record<string, (root: string) => CheckResult>;

export type StepState = 'done' | 'stale' | 'next' | 'ready' | 'waiting' | 'blocked' | 'optional' | 'unavailable';

export interface StepStatus {
  id: string;
  title: string;
  kind: FlowStep['kind'];
  state: StepState;
  detail?: string;
  /** The command, rendered with what is known; absent for an unavailable step. */
  command?: string;
}

export interface NextStep {
  step: string;
  command: string;
  /** Inputs no step has recorded yet: fill these in before running it. */
  placeholders: string[];
}

export interface FlowStatus {
  flow: string;
  title: string;
  root: string;
  steps: StepStatus[];
  next: NextStep | null;
  summary: string;
}

/** The value each input names, or its placeholder. */
function resolveInputs(flow: Flow, root: string, probe: FlowProbe): Record<string, { value: string; known: boolean }> {
  const out: Record<string, { value: string; known: boolean }> = {};
  for (const [name, input] of Object.entries(flow.inputs)) {
    const doc = probe.readJson(path.resolve(root, input.from));
    const value = doc && typeof doc === 'object' ? (doc as Record<string, unknown>)[input.field] : undefined;
    out[name] = typeof value === 'string' && value ? { value, known: true } : { value: input.otherwise, known: false };
  }
  return out;
}

function render(template: string, root: string, inputs: ReturnType<typeof resolveInputs>): { command: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const command = template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (whole, name: string) => {
    if (name === 'root') return root;
    const input = inputs[name];
    if (!input) return whole;
    if (!input.known && !placeholders.includes(input.value)) placeholders.push(input.value);
    return input.value;
  });
  return { command, placeholders };
}

const SATISFIED: StepState[] = ['done', 'stale', 'optional'];

export function flowStatus(flow: Flow, dir: string, probe: FlowProbe, checks: FlowChecks): FlowStatus {
  const root = path.resolve(dir);
  const unregistered = flow.steps.filter((s) => s.check && s.available && !checks[s.check]).map((s) => `"${s.check}" (step ${s.id})`);
  if (unregistered.length > 0) {
    throw new ValidationError(`flow "${flow.id}" needs checks that are not registered: ${unregistered.join(', ')}`, 'checks', 'registered');
  }
  const inputs = resolveInputs(flow, root, probe);
  const byId = new Map(flow.steps.map((s) => [s.id, s]));
  const states = new Map<string, StepStatus>();
  const rendered = new Map<string, { command: string; placeholders: string[] }>();
  const file = (rel: string) => path.resolve(root, rel);

  for (const step of flow.steps) {
    const base = { id: step.id, title: step.title, kind: step.kind };
    if (!step.available) {
      states.set(step.id, { ...base, state: 'unavailable', detail: `not built yet${step.issue ? ` (${step.issue})` : ''}` });
      continue;
    }
    const r = step.command ? render(step.command, root, inputs) : undefined;
    if (r) rendered.set(step.id, r);
    const cmd = r ? { command: r.command } : {};
    const check = step.check ? checks[step.check](root) : undefined;

    if (step.kind === 'optional') {
      states.set(step.id, { ...base, ...cmd, state: 'optional', ...(check?.detail ? { detail: check.detail } : {}) });
      continue;
    }
    const waitingOn = step.after.filter((a) => !SATISFIED.includes(states.get(a)?.state ?? 'blocked'));
    if (waitingOn.length > 0) {
      states.set(step.id, { ...base, ...cmd, state: 'blocked', detail: `waits on ${waitingOn.join(', ')}` });
      continue;
    }

    const missing = step.produces.filter((p) => probe.mtime(file(p)) === null);
    const done = missing.length === 0 && (check ? check.done : true);
    if (!done) {
      const detail = check?.detail ?? (missing.length > 0 ? `${missing.join(', ')} not written yet` : undefined);
      states.set(step.id, { ...base, ...cmd, state: step.kind === 'gate' ? 'waiting' : 'ready', ...(detail ? { detail } : {}) });
      continue;
    }

    const own = step.produces[0] ? probe.mtime(file(step.produces[0])) : null;
    const newer =
      own === null
        ? []
        : step.after
            .map((a) => byId.get(a))
            .filter((a): a is FlowStep => a !== undefined && a.kind !== 'optional')
            .flatMap((a) => a.produces)
            .filter((p) => (probe.mtime(file(p)) ?? 0) > own);
    if (newer.length > 0) {
      states.set(step.id, { ...base, ...cmd, state: 'stale', detail: `${newer.join(', ')} changed after ${step.produces[0]} was written` });
    } else if (check?.stale) {
      states.set(step.id, { ...base, ...cmd, state: 'stale', ...(check.detail ? { detail: check.detail } : {}) });
    } else {
      states.set(step.id, { ...base, ...cmd, state: 'done', ...(check?.detail ? { detail: check.detail } : {}) });
    }
  }

  const steps = flow.steps.map((s) => states.get(s.id) as StepStatus);
  const chosen = steps.find((s) => s.state === 'ready' || s.state === 'waiting') ?? steps.find((s) => s.state === 'stale');
  if (chosen?.state === 'ready') chosen.state = 'next';
  const r = chosen ? rendered.get(chosen.id) : undefined;
  const next = chosen && r ? { step: chosen.id, command: r.command, placeholders: r.placeholders } : null;

  const unavailable = steps.filter((s) => s.state === 'unavailable');
  const summary = next
    ? `next: ${chosen?.title} — ${next.command}`
    : unavailable.length > 0 && steps.some((s) => s.state === 'blocked')
      ? `everything that can run has; waiting on ${unavailable.map((s) => `${s.id} (${s.detail})`).join(', ')}`
      : 'every step is done';

  return { flow: flow.id, title: flow.title, root, steps, next, summary };
}

/**
 * The flows the CLI ships, and the checks they name (PDR-012, ADR-119 §4).
 *
 * Definitions are `flows/<id>.yaml` beside the package; the engine is
 * `@seans-mfe/flow`. A check decides what a file's existence cannot: whether a
 * proposal is approved, and still for the document as it is now.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ValidationError } from '@seans-mfe/contracts';
import { approvalStatus, DecompositionSchema, loadProposalStatus, type Decomposition } from '@seans-mfe/decompose';
import type { FlowProposalStatus } from '../oclif/results';
import { digestFile, flowStatus, loadFlow, type Flow, type FlowChecks, type FlowProbe, type FlowStatus } from '@seans-mfe/flow';

/** From `src/flow` and from `dist/flow` alike. */
export const FLOWS_DIR = path.resolve(__dirname, '../../flows');

export const FLOW_IDS: string[] = fs.existsSync(FLOWS_DIR)
  ? fs.readdirSync(FLOWS_DIR).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')).sort()
  : [];

export function loadShippedFlow(id: string): Flow {
  if (!FLOW_IDS.includes(id)) {
    throw new ValidationError(`no flow "${id}" — the flows are: ${FLOW_IDS.join(', ')}`, 'flow', FLOW_IDS.join('|'));
  }
  return loadFlow(fs.readFileSync(path.join(FLOWS_DIR, `${id}.yaml`), 'utf8'));
}

export const fsProbe: FlowProbe = {
  mtime: (file) => {
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return null;
    }
  },
  readJson: (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    } catch {
      return undefined;
    }
  },
  digest: digestFile,
};

/** The proposal inside a bundle, or why there is none. */
function proposalIn(bundle: string): { doc: Decomposition } | { missing: string } {
  const file = path.join(bundle, 'proposal', 'decomposition.yaml');
  if (!fs.existsSync(file)) return { missing: 'no proposal yet' };
  const parsed = DecompositionSchema.safeParse(yaml.load(fs.readFileSync(file, 'utf8')));
  return parsed.success ? { doc: parsed.data } : { missing: `decomposition.yaml does not parse: ${parsed.error.issues[0].message}` };
}

export const flowChecks: FlowChecks = {
  'proposal-approved': (bundle) => {
    const p = proposalIn(bundle);
    if ('missing' in p) return { done: false, detail: p.missing };
    const status = approvalStatus(p.doc);
    const by = p.doc.approval?.by;
    if (status === 'current') return { done: true, detail: `approved by ${by}` };
    if (status === 'stale') return { done: true, stale: true, detail: `the proposal changed after ${by} approved it — review it and approve again` };
    return { done: false, detail: 'not approved yet' };
  },
  'suggestions-waiting': (bundle) => {
    const p = proposalIn(bundle);
    if ('missing' in p) return { done: false, detail: p.missing };
    const n = (p.doc.suggestions ?? []).length;
    return { done: false, detail: n === 0 ? 'no suggestions waiting' : `${n} ${n === 1 ? 'suggestion' : 'suggestions'} waiting` };
  },
  'at-parity': (bundle) => {
    const report = fsProbe.readJson(path.resolve(bundle, '..', 'verify', 'parity.json')) as { parity?: boolean } | undefined;
    if (!report) return { done: false, detail: 'not run yet' };
    return report.parity === true ? { done: true, detail: 'at parity' } : { done: false, detail: 'the last parity run failed — see verify/parity.md' };
  },
};

export function statusOf(id: string, dir: string): FlowStatus {
  return flowStatus(loadShippedFlow(id), dir, fsProbe, flowChecks);
}

/**
 * The proposal inside a bundle as the workspace renders it — the document,
 * validation, approval, each pending suggestion checked, the screens (ADR-116
 * §3). Heavier than `statusOf`, so it is asked for, not always run. Null when
 * the bundle has no proposal yet.
 */
export async function proposalStatusOf(
  bundle: string,
): Promise<{ status: FlowProposalStatus; warnings: string[] } | null> {
  const dir = path.join(bundle, 'proposal');
  if (!fs.existsSync(path.join(dir, 'decomposition.yaml'))) return null;
  const { warnings, ...status } = await loadProposalStatus(dir, { evidence: bundle });
  return { status, warnings };
}

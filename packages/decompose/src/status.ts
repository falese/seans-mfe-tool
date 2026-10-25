/**
 * What the decomposition workspace renders (ADR-116 §3): the document, whether
 * the fleet derived from it validates, the approval and whether it still names
 * the document, each pending suggestion checked, and the captured screens with
 * the proposed domains outlined.
 *
 * Everything here is computed from the document and the evidence bundle; the
 * workspace keeps nothing of its own.
 */

import { deriveFleet, type BackendSpecs, type DerivedFleet } from './derive';
import { applyEdits, approvalStatus } from './edit';
import type { Decomposition, SuggestableEdit } from './model';
import { buildOverlay, type EvidenceStep, type Overlay } from './present';

export interface SuggestionStatus {
  id: string;
  by: string;
  at: string;
  explanation: string;
  request?: string;
  edit: SuggestableEdit;
  /** The oracle's verdict (ADR-117 §4): the edit applied alone to the current document, then the fleet validated. */
  check: { ok: boolean; errors: string[]; domains: string[] };
}

export interface ProposalStatus {
  app: { name: string; namespace: string };
  approval: { status: 'none' | 'current' | 'stale'; by?: string; at?: string; hash?: string };
  document: Decomposition;
  validation: DerivedFleet['validation'];
  valid: boolean;
  suggestions: SuggestionStatus[];
  /** Null without an evidence bundle to draw from. */
  screens: Overlay | null;
}

const errorsOf = (v: DerivedFleet['validation']): string[] => [
  ...Object.entries(v.manifests).flatMap(([mfe, errs]) => errs.map((e) => `${mfe}: ${e}`)),
  ...v.composition.map((c) => `composition ${c.rule}: ${c.message}`),
];

function check(doc: Decomposition, id: string, specs: BackendSpecs | undefined): SuggestionStatus['check'] {
  try {
    const after = applyEdits(doc, [{ kind: 'accept-suggestion', id }]);
    const errors = errorsOf(deriveFleet(after, specs).validation);
    return { ok: errors.length === 0, errors, domains: after.domains.map((d) => d.id) };
  } catch (err) {
    return { ok: false, errors: [(err as Error).message], domains: doc.domains.map((d) => d.id) };
  }
}

export function proposalStatus(
  doc: Decomposition,
  opts: { specs?: BackendSpecs; steps?: EvidenceStep[]; viewport?: { width: number; height: number } } = {}
): ProposalStatus {
  const validation = deriveFleet(doc, opts.specs).validation;
  return {
    app: { name: doc.app.name, namespace: doc.app.namespace },
    approval: { status: approvalStatus(doc), ...(doc.approval ?? {}) },
    document: doc,
    validation,
    valid: errorsOf(validation).length === 0,
    suggestions: (doc.suggestions ?? []).map((s) => ({ ...s, check: check(doc, s.id, opts.specs) })),
    screens: opts.steps && opts.viewport ? buildOverlay(doc, opts.steps, opts.viewport) : null,
  };
}

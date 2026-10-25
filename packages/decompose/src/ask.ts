/**
 * Ask an agent about a proposal and keep only what the oracle passes
 * (ADR-117 §3–§4), in-process (ADR-118 §2).
 *
 * 1. Read the proposal.
 * 2. Ask the model — injected, so this package never names a provider.
 * 3. Dry-apply each edit on top of the edits that passed before it, and keep
 *    it only if it applies and the derived fleet validates. A failure is
 *    dropped with its reason, never offered; so is an edit already waiting as
 *    a suggestion.
 * 4. Write the question, the answer and the survivors in one edit: two comments
 *    and a pending suggestion per edit. Nothing else changes until a person
 *    accepts one (ADR-116 §4).
 */

import * as path from 'path';
import { deriveFleet, type DerivedFleet } from './derive';
import { applyEdits } from './edit';
import { editProposalFile } from './edit-file';
import { readDecomposition, readSpecs } from './files';
import type { AgentEdit, Decomposition, EditOp, SuggestableEdit } from './model';

export interface CheckedEdit {
  explanation: string;
  edit: AgentEdit;
}

/** What the model answers with (the `decomposition-edit` prompt adaptor's output). */
export interface AgentAnswer {
  /** A few sentences for the product owner; recorded in the proposal's conversation. */
  answer: string;
  edits: CheckedEdit[];
}

/** The model call. `model` names the model that actually answered. */
export type AgentModel = (input: { document: Decomposition; request: string }) => Promise<{ output: AgentAnswer; model: string }>;

export interface AskResult {
  answer: string;
  /** Edits written to the proposal as pending suggestions. */
  suggested: CheckedEdit[];
  /** Edits the oracle refused, with why. */
  dropped: (CheckedEdit & { reason: string })[];
  model: string;
}

/** Suggestions and their comments are signed by this name. */
export const AGENT = 'agent';

const errorsOf = (v: DerivedFleet['validation']): string[] => [
  ...Object.entries(v.manifests).flatMap(([mfe, errs]) => errs.map((e) => `${mfe}: ${e}`)),
  ...v.composition.map((c) => `composition: ${c.message}`),
];

/** An edit's identity, ignoring key order and who signed it. */
function identity(edit: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .filter(([k]) => k !== 'by' && k !== 'at')
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)])
          )
        : v;
  return JSON.stringify(canonical(edit));
}

/** A comment the agent suggests is signed by the agent; other edits carry no signature. */
const signed = (edit: AgentEdit, at: string): SuggestableEdit => (edit.kind === 'comment' ? { ...edit, by: AGENT, at } : edit);

export async function askAgent(
  proposalDir: string,
  opts: { request: string; by: string; at: string },
  model: AgentModel
): Promise<AskResult> {
  const file = path.join(path.resolve(proposalDir), 'decomposition.yaml');
  const document = await readDecomposition(file);
  const specs = await readSpecs(path.dirname(file));
  const waiting = new Map((document.suggestions ?? []).map((s) => [identity(s.edit), s.id]));

  const { output, model: answeredBy } = await model({ document, request: opts.request });

  const suggested: CheckedEdit[] = [];
  const dropped: AskResult['dropped'] = [];
  for (const candidate of output.edits) {
    const already = waiting.get(identity(candidate.edit));
    if (already) {
      dropped.push({ ...candidate, reason: `already suggested (${already})` });
      continue;
    }
    try {
      const after = applyEdits(document, [...suggested, candidate].map((c) => signed(c.edit, opts.at)));
      const errors = errorsOf(deriveFleet(after, specs).validation);
      if (errors.length > 0) dropped.push({ ...candidate, reason: errors.join('; ') });
      else suggested.push(candidate);
    } catch (err) {
      dropped.push({ ...candidate, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  await editProposalFile(
    file,
    [
      { kind: 'comment', by: opts.by, at: opts.at, text: opts.request },
      { kind: 'comment', by: AGENT, at: opts.at, text: output.answer },
      ...suggested.map((s): EditOp => ({ kind: 'suggest', by: AGENT, at: opts.at, explanation: s.explanation, request: opts.request, edit: signed(s.edit, opts.at) })),
    ],
    { dryRun: false }
  );

  return { answer: output.answer, suggested, dropped, model: answeredBy };
}

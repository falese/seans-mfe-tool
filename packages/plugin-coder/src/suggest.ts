/**
 * Ask the agent about a proposal and keep only what the oracle passes
 * (ADR-117 §3–§4).
 *
 * 1. Read the proposal with `decompose:status`.
 * 2. Ask the `decomposition-edit` adaptor.
 * 3. Dry-apply each edit with `decompose:edit --dry-run`, on top of the edits
 *    that passed before it, and keep it only if it applies and the derived
 *    fleet validates. A failure is dropped with its reason, never offered; so
 *    is an edit already waiting as a suggestion.
 * 4. Write the question, the answer and the survivors to the proposal with one
 *    `decompose:edit`: two comments and a pending suggestion per edit.
 *
 * Every step that reads or writes the document is the CLI, run as a child
 * process (CLAUDE.md, "MCP child-process per tool call"): this package never
 * touches `decomposition.yaml` itself.
 */

import * as path from 'node:path';
import { BusinessError, type CommandResult } from '@seans-mfe/contracts';
import type { AdaptorAnswer } from './api-runner';
import type { AgentEdit, DecompositionEditAnswer, DecompositionEditInput } from './adaptors/decomposition-edit';

/** Runs one CLI command with `--json` and returns its envelope. */
export interface SuggestCli {
  run(args: string[]): Promise<CommandResult<unknown>>;
}

export interface SuggestOptions {
  /** The proposal directory, holding decomposition.yaml. */
  proposalDir: string;
  request: string;
  /** Who asked; signs the question in the conversation. */
  by: string;
  /** ISO-8601, so the edits stay deterministic. */
  at: string;
}

export interface SuggestDeps {
  cli: SuggestCli;
  ask(input: DecompositionEditInput): Promise<AdaptorAnswer<DecompositionEditAnswer>>;
}

export interface CheckedEdit {
  explanation: string;
  edit: AgentEdit;
}

export interface SuggestResult {
  answer: string;
  /** Edits written to the proposal as pending suggestions. */
  suggested: CheckedEdit[];
  /** Edits the oracle refused, with why. */
  dropped: (CheckedEdit & { reason: string })[];
  model: string;
}

/** Suggestions and their comments are signed by this name. */
export const AGENT = 'agent';

type Json = Record<string, unknown>;

interface EditData {
  valid?: boolean;
  validation?: { manifests?: Record<string, string[]>; composition?: { message: string }[] };
}

function invalidReason(data: EditData): string {
  const v = data.validation ?? {};
  const reasons = [
    ...Object.entries(v.manifests ?? {}).flatMap(([mfe, errs]) => errs.map((e) => `${mfe}: ${e}`)),
    ...(v.composition ?? []).map((c) => `composition: ${c.message}`),
  ];
  return reasons.join('; ') || 'the derived fleet does not validate';
}

/** An edit's identity, ignoring key order and who signed it. */
function sameEdit(edit: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v as Json)
              .filter(([k]) => k !== 'by' && k !== 'at')
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)]),
          )
        : v;
  return JSON.stringify(canonical(edit));
}

/** A comment the agent suggests is signed by the agent; the other edits carry no signature. */
const signed = (edit: AgentEdit, at: string): Json => (edit.kind === 'comment' ? { ...edit, by: AGENT, at } : { ...edit });

export async function suggestEdits(opts: SuggestOptions, deps: SuggestDeps): Promise<SuggestResult> {
  const proposalDir = path.resolve(opts.proposalDir);
  const proposalFile = path.join(proposalDir, 'decomposition.yaml');

  const status = await deps.cli.run(['decompose:status', proposalDir, '--json']);
  if (!status.ok) {
    throw new BusinessError(status.error?.message ?? 'decompose:status failed', 'PROPOSAL_UNREADABLE', { proposal: proposalDir });
  }
  const { document, suggestions: pending = [] } = status.data as { document: unknown; suggestions?: { id: string; edit: unknown }[] };
  const waiting = new Map(pending.map((p) => [sameEdit(p.edit), p.id]));

  const { output, model } = await deps.ask({ document, request: opts.request });

  const suggested: CheckedEdit[] = [];
  const dropped: SuggestResult['dropped'] = [];
  for (const candidate of output.edits) {
    const already = waiting.get(sameEdit(candidate.edit));
    if (already) {
      dropped.push({ ...candidate, reason: `already suggested (${already})` });
      continue;
    }
    const ops = [...suggested, candidate].map((c) => signed(c.edit, opts.at));
    const dry = await deps.cli.run(['decompose:edit', proposalFile, '--ops', JSON.stringify(ops), '--dry-run', '--json']);
    if (!dry.ok) dropped.push({ ...candidate, reason: dry.error?.message ?? 'the edit could not be applied' });
    else if ((dry.data as EditData).valid === false) dropped.push({ ...candidate, reason: invalidReason(dry.data as EditData) });
    else suggested.push(candidate);
  }

  const writes: Json[] = [
    { kind: 'comment', by: opts.by, at: opts.at, text: opts.request },
    { kind: 'comment', by: AGENT, at: opts.at, text: output.answer },
    ...suggested.map((s) => ({
      kind: 'suggest',
      by: AGENT,
      at: opts.at,
      explanation: s.explanation,
      request: opts.request,
      edit: signed(s.edit, opts.at),
    })),
  ];
  const written = await deps.cli.run(['decompose:edit', proposalFile, '--ops', JSON.stringify(writes), '--json']);
  if (!written.ok) {
    throw new BusinessError(written.error?.message ?? 'the suggestions could not be written', 'SUGGESTIONS_NOT_WRITTEN', { proposal: proposalFile });
  }

  return { answer: output.answer, suggested, dropped, model };
}

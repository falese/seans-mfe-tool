import type { CommandResult } from '@seans-mfe/contracts';
import { suggestEdits, type SuggestCli } from '../suggest';
import type { DecompositionEditAnswer } from '../adaptors/decomposition-edit';

const document = {
  domains: [
    { id: 'cargo', files: ['src/pages/cargo/CargoPage.tsx', 'src/pages/cargo/HazardSummary.tsx'] },
    { id: 'docking', files: ['src/pages/docking/DockingPage.tsx'] },
  ],
};

const okEnvelope = (data: unknown): CommandResult<unknown> => ({ ok: true, data, warnings: [], telemetry: { durationMs: 1, correlationId: 'c' } });
const failEnvelope = (message: string): CommandResult<unknown> => ({
  ok: false,
  error: { type: 'ValidationError', code: 1, message, retryable: false, userFacing: true },
  warnings: [],
  telemetry: { durationMs: 1, correlationId: 'c' },
});

/** A CLI that knows the status, refuses a merge into an unknown domain, and records every call. */
function fakeCli(): SuggestCli & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async run(args) {
      calls.push(args);
      if (args[0] === 'decompose:status') return okEnvelope({ document, suggestions: [] });
      if (args[0] === 'decompose:edit') {
        const ops = JSON.parse(args[args.indexOf('--ops') + 1]) as { kind: string; to?: string }[];
        if (args.includes('--dry-run')) {
          if (ops.some((o) => o.kind === 'move-file' && o.to === 'nowhere')) return failEnvelope('no domain "nowhere"');
          if (ops.some((o) => o.kind === 'rename-slot')) {
            return okEnvelope({ valid: false, validation: { manifests: { 'cargo-mfe': ['slot "x" is not provided'] }, composition: [] } });
          }
          return okEnvelope({ valid: true, validation: { manifests: {}, composition: [] } });
        }
        return okEnvelope({ valid: true, suggestions: ops.filter((o) => o.kind === 'suggest').length });
      }
      return failEnvelope(`unexpected ${args[0]}`);
    },
  };
}

const answer: DecompositionEditAnswer = {
  answer: 'Hazards can stand alone; the slot rename would break cargo.',
  edits: [
    { explanation: 'a separate team owns hazards', edit: { kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['src/pages/cargo/HazardSummary.tsx'] } },
    { explanation: 'misplaced', edit: { kind: 'move-file', file: 'src/pages/docking/DockingPage.tsx', to: 'nowhere' } },
    { explanation: 'clearer name', edit: { kind: 'rename-slot', from: 'aside', to: 'x' } },
    { explanation: 'the new domain needs a clearer name', edit: { kind: 'rename-domain', from: 'hazmat', to: 'hazards' } },
  ],
};

describe('suggestEdits — the oracle decides (ADR-117 §4)', () => {
  const opts = { proposalDir: '/p', request: 'Split hazards out of cargo', by: 'sean', at: '2026-10-25T12:00:00.000Z' };

  it('dry-applies each edit after the ones that passed, drops the failures with their reason, and writes the rest as suggestions', async () => {
    const cli = fakeCli();
    const asked: unknown[] = [];
    const result = await suggestEdits(opts, {
      cli,
      ask: async (input) => {
        asked.push(input);
        return { output: answer, model: 'model-x' };
      },
    });

    expect(asked).toEqual([{ document, request: 'Split hazards out of cargo' }]);
    expect(result.suggested.map((s) => s.edit.kind)).toEqual(['split-domain', 'rename-domain']);
    expect(result.dropped).toEqual([
      { explanation: 'misplaced', edit: answer.edits[1].edit, reason: 'no domain "nowhere"' },
      { explanation: 'clearer name', edit: answer.edits[2].edit, reason: 'cargo-mfe: slot "x" is not provided' },
    ]);

    // The rename was checked on top of the split that passed before it — not alone.
    const dryRuns = cli.calls.filter((c) => c.includes('--dry-run'));
    expect(dryRuns).toHaveLength(4);
    expect(JSON.parse(dryRuns[3][dryRuns[3].indexOf('--ops') + 1]).map((o: { kind: string }) => o.kind)).toEqual(['split-domain', 'rename-domain']);
    for (const run of dryRuns) expect(run[1]).toBe('/p/decomposition.yaml');

    const write = cli.calls.filter((c) => c[0] === 'decompose:edit' && !c.includes('--dry-run'));
    expect(write).toHaveLength(1);
    const ops = JSON.parse(write[0][write[0].indexOf('--ops') + 1]);
    expect(ops).toEqual([
      { kind: 'comment', by: 'sean', at: opts.at, text: 'Split hazards out of cargo' },
      { kind: 'comment', by: 'agent', at: opts.at, text: answer.answer },
      { kind: 'suggest', by: 'agent', at: opts.at, explanation: 'a separate team owns hazards', request: 'Split hazards out of cargo', edit: answer.edits[0].edit },
      { kind: 'suggest', by: 'agent', at: opts.at, explanation: 'the new domain needs a clearer name', request: 'Split hazards out of cargo', edit: answer.edits[3].edit },
    ]);
    expect(result.answer).toBe(answer.answer);
    expect(result.model).toBe('model-x');
  });

  it('signs a comment the agent suggests as the agent', async () => {
    const cli = fakeCli();
    await suggestEdits(opts, {
      cli,
      ask: async () => ({ output: { answer: 'noted', edits: [{ explanation: 'for the record', edit: { kind: 'comment', text: 'cargo reads docking', about: 'cargo' } }] }, model: 'm' }),
    });
    const write = cli.calls.find((c) => c[0] === 'decompose:edit' && !c.includes('--dry-run'));
    const ops = JSON.parse(write![write!.indexOf('--ops') + 1]);
    expect(ops[2].edit).toEqual({ kind: 'comment', by: 'agent', at: opts.at, text: 'cargo reads docking', about: 'cargo' });
  });

  it('records the question and the answer even when no edit survives', async () => {
    const cli = fakeCli();
    const result = await suggestEdits(opts, { cli, ask: async () => ({ output: { answer: 'Nothing to change.', edits: [] }, model: 'm' }) });
    expect(result.suggested).toEqual([]);
    const write = cli.calls.find((c) => c[0] === 'decompose:edit' && !c.includes('--dry-run'));
    expect(JSON.parse(write![write!.indexOf('--ops') + 1]).map((o: { kind: string }) => o.kind)).toEqual(['comment', 'comment']);
  });

  it('drops an edit that is already waiting as a suggestion, instead of offering it twice', async () => {
    const cli = fakeCli();
    const pending = { id: 's-1', by: 'agent', at: 't', explanation: 'x', edit: answer.edits[0].edit };
    const run = cli.run.bind(cli);
    cli.run = async (args) => (args[0] === 'decompose:status' ? okEnvelope({ document, suggestions: [pending] }) : run(args));
    const result = await suggestEdits(opts, { cli, ask: async () => ({ output: { answer: 'a', edits: [answer.edits[0]] }, model: 'm' }) });
    expect(result.suggested).toEqual([]);
    expect(result.dropped).toEqual([{ ...answer.edits[0], reason: 'already suggested (s-1)' }]);
  });

  it('fails without asking the model when the proposal cannot be read', async () => {
    const cli: SuggestCli = { run: async () => failEnvelope('no decomposition.yaml in /p') };
    const ask = jest.fn();
    await expect(suggestEdits(opts, { cli, ask })).rejects.toThrow(/no decomposition.yaml/);
    expect(ask).not.toHaveBeenCalled();
  });
});

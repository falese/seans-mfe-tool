import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AgentEditSchema } from '@seans-mfe/decompose';
import type { MessagesClient } from '../../api-runner';
import { AGENT_EDIT_KINDS, DecompositionEditAnswerSchema, decompositionEdit, decompositionEditModel } from '../decomposition-edit';

const document = {
  version: 1,
  app: { name: 'meridian', gateway: true },
  domains: [
    { id: 'cargo', mfe: 'cargo-mfe', files: ['src/pages/cargo/CargoPage.tsx', 'src/pages/cargo/HazardSummary.tsx'], capabilities: [] },
    { id: 'docking', mfe: 'docking-mfe', files: ['src/pages/docking/DockingPage.tsx'], capabilities: [] },
  ],
  comments: [{ id: 'c1', by: 'sean', at: '2026-10-25T10:00:00Z', text: 'hazards are a separate team' }],
};

describe('the decomposition-edit prompt adaptor (ADR-117 §3)', () => {
  it('answers only in the named edits decompose:edit applies — never approve, accept or reject', () => {
    expect([...AGENT_EDIT_KINDS].sort()).toEqual(
      ['comment', 'merge-domains', 'move-file', 'rename-capability', 'rename-domain', 'rename-slot', 'split-domain'].sort()
    );
    for (const kind of ['approve', 'accept-suggestion', 'reject-suggestion', 'suggest']) {
      expect(DecompositionEditAnswerSchema.safeParse({ answer: 'a', edits: [{ explanation: 'e', edit: { kind, id: 'x', by: 'a', at: 'b' } }] }).success).toBe(false);
    }
  });

  it('takes its edits from the proposal model itself, so the two cannot drift (ADR-118 §3)', () => {
    expect(DecompositionEditAnswerSchema.shape.edits.element.shape.edit).toBe(AgentEditSchema);
  });

  it('is the agent model askAgent takes: the proposal and the request in, the checked answer and the model out', async () => {
    const calls: Record<string, unknown>[] = [];
    const answer = { answer: 'ok', edits: [{ explanation: 'e', edit: { kind: 'rename-domain', from: 'a', to: 'b' } }] };
    const client = {
      beta: {
        messages: {
          parse: async (params: Record<string, unknown>) => {
            calls.push(params);
            return { model: 'answered-by', stop_reason: 'end_turn', content: [], parsed_output: answer };
          },
        },
      },
    } as unknown as MessagesClient;
    const model = decompositionEditModel({ client, model: 'model-x' });
    await expect(model({ document: document as never, request: 'Rename a' })).resolves.toEqual({ output: answer, model: 'answered-by' });
    expect(calls[0].model).toBe('model-x');
  });

  it('accepts a split with its files and an explanation', () => {
    const parsed = DecompositionEditAnswerSchema.parse({
      answer: 'Hazards can be their own domain.',
      edits: [{ explanation: 'separate team', edit: { kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['src/pages/cargo/HazardSummary.tsx'] } }],
    });
    expect(parsed.edits[0].edit.kind).toBe('split-domain');
  });

  it('names every edit kind in the JSON schema the model answers in, one variant each', () => {
    const format = betaZodOutputFormat(DecompositionEditAnswerSchema);
    const variants = (format.schema as { properties: { edits: { items: { properties: { edit: { anyOf: unknown[] } } } } } }).properties.edits.items.properties.edit.anyOf;
    expect(variants).toHaveLength(AGENT_EDIT_KINDS.length);
    const schema = JSON.stringify(format.schema);
    for (const kind of AGENT_EDIT_KINDS) expect(schema).toContain(kind);
  });

  it('parses the model’s answer back through the same schema, so a kind outside the list is refused', () => {
    const format = betaZodOutputFormat(DecompositionEditAnswerSchema);
    expect(() => format.parse(JSON.stringify({ answer: 'a', edits: [{ explanation: 'e', edit: { kind: 'approve', from: 'a', to: 'b' } }] }))).toThrow();
  });

  it('puts the whole proposal, conversation included, in the cached context and the request last', () => {
    const { context, request } = decompositionEdit.assemble({ document, request: 'Split hazards out of cargo' });
    expect(context).toContain('src/pages/cargo/HazardSummary.tsx');
    expect(context).toContain('hazards are a separate team');
    expect(request).toContain('Split hazards out of cargo');
    expect(context).not.toContain('Split hazards out of cargo');
  });

  it('explains every edit kind in its system prompt, and that nothing applies until a person accepts it', () => {
    for (const kind of AGENT_EDIT_KINDS) expect(decompositionEdit.system).toContain(kind);
    expect(decompositionEdit.system).toMatch(/accept/i);
  });
});

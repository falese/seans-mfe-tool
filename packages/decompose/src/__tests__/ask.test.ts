import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { askAgent, type AgentAnswer } from '../ask';
import { dumpYaml, readDecomposition } from '../files';
import { applyEdits } from '../edit';
import type { Decomposition, Domain } from '../model';

const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };
const domain = (id: string, files: string[], caps: string[], extra: Partial<Domain> = {}): Domain => ({
  id, mfe: `app-${id}`, shell: false, files,
  capabilities: caps.map((name, i) => ({ name, file: files[i] ?? files[0], component: name })),
  backends: [], endpoints: [], evidence, reasons: [], ...extra,
});

const doc = (): Decomposition => ({
  version: 1,
  app: { name: 'app', namespace: 'app', gateway: true },
  domains: [
    domain('shell', ['src/App.tsx'], ['App'], { shell: true }),
    domain('docking', ['src/Board.tsx'], ['Board']),
    domain('cargo', ['src/Manifest.tsx', 'src/Hazards.tsx'], ['Manifest', 'Hazards']),
  ],
  shared: [],
  unassigned: [],
  couplings: [],
  slots: [{ id: 'main', provider: 'shell', repeated: false }],
  routes: [
    { path: '/docking', stateKey: 'app.open.docking', place: [{ capability: 'Board', domain: 'docking', slot: 'main' }] },
    { path: '/cargo', stateKey: 'app.open.cargo', place: [{ capability: 'Manifest', domain: 'cargo', slot: 'main' }] },
  ],
  repeated: [],
  tests: [],
  uncovered: [],
});

const at = '2026-10-25T12:00:00.000Z';
const split = { kind: 'split-domain' as const, domain: 'cargo', into: 'hazmat', files: ['src/Hazards.tsx'] };

describe('askAgent — the agent suggests, the oracle decides (ADR-117 §4, ADR-118)', () => {
  let dir: string;
  const file = () => path.join(dir, 'decomposition.yaml');
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ask-'));
    await fs.writeFile(file(), dumpYaml(doc()));
  });
  afterEach(() => fs.remove(dir));

  const answering = (answer: AgentAnswer) => {
    const asked: unknown[] = [];
    return {
      asked,
      model: async (input: { document: Decomposition; request: string }) => {
        asked.push(input);
        return { output: answer, model: 'model-x' };
      },
    };
  };

  it('dry-applies each edit after the ones that passed, drops failures with the reason, and writes the rest as suggestions', async () => {
    const { asked, model } = answering({
      answer: 'Hazards can stand alone.',
      edits: [
        { explanation: 'a separate team', edit: split },
        { explanation: 'misplaced', edit: { kind: 'move-file', file: 'src/Board.tsx', to: 'nowhere' } },
        { explanation: 'their word', edit: { kind: 'rename-domain', from: 'hazmat', to: 'hazards' } },
      ],
    });
    const result = await askAgent(dir, { request: 'Split hazards out of cargo', by: 'sean', at }, model);

    expect((asked[0] as { request: string }).request).toBe('Split hazards out of cargo');
    expect((asked[0] as { document: Decomposition }).document.domains.map((d) => d.id)).toEqual(['shell', 'docking', 'cargo']);
    expect(result.answer).toBe('Hazards can stand alone.');
    expect(result.model).toBe('model-x');
    expect(result.suggested.map((s) => s.edit.kind)).toEqual(['split-domain', 'rename-domain']);
    expect(result.dropped).toEqual([{ explanation: 'misplaced', edit: { kind: 'move-file', file: 'src/Board.tsx', to: 'nowhere' }, reason: expect.stringContaining('nowhere') }]);

    const written = await readDecomposition(file());
    expect(written.domains.map((d) => d.id)).toEqual(['shell', 'docking', 'cargo']);
    expect(written.comments?.map((c) => [c.by, c.text])).toEqual([
      ['sean', 'Split hazards out of cargo'],
      ['agent', 'Hazards can stand alone.'],
    ]);
    expect(written.suggestions?.map((s) => [s.by, s.request, s.edit.kind])).toEqual([
      ['agent', 'Split hazards out of cargo', 'split-domain'],
      ['agent', 'Split hazards out of cargo', 'rename-domain'],
    ]);
  });

  it('drops an edit already waiting as a suggestion instead of offering it twice', async () => {
    const pending = applyEdits(doc(), [{ kind: 'suggest', by: 'agent', at, explanation: 'earlier', edit: split }]);
    await fs.writeFile(file(), dumpYaml(pending));
    const id = pending.suggestions?.[0].id;
    const { model } = answering({ answer: 'a', edits: [{ explanation: 'again', edit: split }] });
    const result = await askAgent(dir, { request: 'q', by: 'sean', at }, model);
    expect(result.suggested).toEqual([]);
    expect(result.dropped).toEqual([{ explanation: 'again', edit: split, reason: `already suggested (${id})` }]);
  });

  it('signs a comment the agent suggests as the agent', async () => {
    const { model } = answering({ answer: 'noted', edits: [{ explanation: 'for the record', edit: { kind: 'comment', text: 'cargo reads docking', about: 'cargo' } }] });
    await askAgent(dir, { request: 'q', by: 'sean', at }, model);
    expect((await readDecomposition(file())).suggestions?.[0].edit).toEqual({ kind: 'comment', by: 'agent', at, text: 'cargo reads docking', about: 'cargo' });
  });

  it('fails before asking the model when there is no proposal to read', async () => {
    const model = jest.fn();
    await expect(askAgent(path.join(dir, 'missing'), { request: 'q', by: 'sean', at }, model)).rejects.toThrow();
    expect(model).not.toHaveBeenCalled();
  });
});

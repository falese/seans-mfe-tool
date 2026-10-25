import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { dumpYaml, readDecomposition, type AgentModel, type Decomposition } from '@seans-mfe/decompose';
import { agentFor } from '../agent';

const doc = (): Decomposition => ({
  version: 1,
  app: { name: 'app', namespace: 'app', gateway: true },
  domains: [
    {
      id: 'shell', mfe: 'app-shell', shell: true, files: ['src/App.tsx'],
      capabilities: [{ name: 'App', file: 'src/App.tsx', component: 'App' }],
      backends: [], endpoints: [], reasons: [],
      evidence: { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null },
    },
  ],
  shared: [], unassigned: [], couplings: [],
  slots: [{ id: 'main', provider: 'shell', repeated: false }],
  routes: [], repeated: [], tests: [], uncovered: [],
});

describe('agentFor — whether the workspace has an agent, decided by the command (ADR-117, ADR-118 §4)', () => {
  it('says which variable to set when there is no key, and that it was turned off when it was', () => {
    expect(agentFor({ proposalDir: '/p', enabled: true, env: {} })).toEqual({ unavailable: expect.stringContaining('ANTHROPIC_API_KEY') });
    expect(agentFor({ proposalDir: '/p', enabled: false, env: { ANTHROPIC_API_KEY: 'k' } })).toEqual({ unavailable: expect.stringContaining('--no-agent') });
  });

  it('connects with a key, and answers each question with askAgent over the proposal', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-'));
    await fs.writeFile(path.join(dir, 'decomposition.yaml'), dumpYaml(doc()));
    const seen: unknown[] = [];
    const model: AgentModel = async (input) => (seen.push(input.request), { output: { answer: 'Nothing to change.', edits: [] }, model: 'answered-by' });
    const made: unknown[] = [];
    const connected = agentFor({ proposalDir: dir, enabled: true, model: 'model-x', env: { ANTHROPIC_API_KEY: 'k' } }, (opts) => (made.push(opts), model));
    if (!('agent' in connected)) throw new Error('expected an agent');
    expect(connected.agent.model).toBe('model-x');

    const result = await connected.agent.ask('Anything to change?', 'sean', '2026-10-25T12:00:00.000Z');
    expect(result).toEqual({ answer: 'Nothing to change.', suggested: [], dropped: [], model: 'answered-by' });
    expect(seen).toEqual(['Anything to change?']);
    expect(made).toEqual([{ apiKey: 'k', model: 'model-x' }]);
    expect((await readDecomposition(path.join(dir, 'decomposition.yaml'))).comments?.map((c) => c.by)).toEqual(['sean', 'agent']);
    await fs.remove(dir);
  });
});

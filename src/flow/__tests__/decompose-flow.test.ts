import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyEdits, dumpYaml, type Decomposition } from '@seans-mfe/decompose';
import { writeProvenance } from '@seans-mfe/flow';
import { loadProposalStatus } from '@seans-mfe/decompose';
import { FLOW_IDS, flowChecks, fsProbe, loadShippedFlow, proposalStatusOf, statusOf } from '../index';

const REPO = path.resolve(__dirname, '../../..');

/** The decomposition documents the meridian proposal fixture is made of: just enough to approve. */
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

/** Write a file and push its mtime forward, so the order on disk is the order written here. */
let clock = 1_700_000_000;
function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  clock += 10;
  fs.utimesSync(file, clock, clock);
}

describe('the decomposition flow (PDR-012, ADR-119)', () => {
  let work: string;
  let bundle: string;
  const state = () => statusOf('decompose', bundle);
  const stateOf = (id: string) => state().steps.find((s) => s.id === id);
  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-'));
    bundle = path.join(work, 'evidence');
  });
  afterEach(() => fs.rmSync(work, { recursive: true, force: true }));

  it('starts at capture, and asks for the app’s URL', () => {
    expect(state().next).toEqual({ step: 'capture', command: `seans-mfe-tool decompose:capture <app-url> --out ${bundle} --explore 20`, placeholders: ['<app-url>'] });
  });

  it('walks capture → analyze → propose → present → approve, filling arguments from what each step recorded', () => {
    write(path.join(bundle, 'bundle.json'), JSON.stringify({ app: 'http://localhost:5090' }));
    expect(state().next?.step).toBe('capture');
    expect(stateOf('capture')?.detail).toBe('requests.json not written yet');
    write(path.join(bundle, 'requests.json'), '[]');
    expect(state().next).toEqual({ step: 'analyze', command: `seans-mfe-tool decompose:analyze <app-dir> --evidence ${bundle}`, placeholders: ['<app-dir>'] });

    write(path.join(bundle, 'source', 'project.json'), JSON.stringify({ dir: '/apps/monolith', name: 'app' }));
    write(path.join(bundle, 'source', 'graph.json'), '{}');
    write(path.join(bundle, 'source', 'join.json'), '{}');
    expect(state().next?.command).toBe(`seans-mfe-tool decompose:propose ${bundle}`);

    write(path.join(bundle, 'proposal', 'proposal.base.yaml'), dumpYaml(doc()));
    write(path.join(bundle, 'proposal', 'decomposition.yaml'), dumpYaml(doc()));
    expect(stateOf('shape')).toMatchObject({ state: 'optional', detail: 'no suggestions waiting' });
    expect(state().next?.command).toBe(`seans-mfe-tool decompose:present ${path.join(bundle, 'proposal')}`);

    write(path.join(bundle, 'proposal', 'PROPOSAL.md'), '# proposal');
    expect(stateOf('approve')).toMatchObject({ state: 'waiting', detail: 'not approved yet' });
    expect(state().next).toMatchObject({ step: 'approve', command: `seans-mfe-tool decompose:workspace ${path.join(bundle, 'proposal')}` });

    write(path.join(bundle, 'proposal', 'decomposition.yaml'), dumpYaml(applyEdits(doc(), [{ kind: 'approve', by: 'sean', at: '2026-10-25T12:00:00Z' }])));
    // The approval was written after PROPOSAL.md: the report no longer shows what was approved.
    expect(stateOf('present')?.state).toBe('stale');
    write(path.join(bundle, 'proposal', 'PROPOSAL.md'), '# proposal');
    expect(stateOf('approve')).toMatchObject({ state: 'done', detail: 'approved by sean' });
    expect(stateOf('scaffold')).toMatchObject({ state: 'unavailable', detail: 'not built yet (#410)' });
    expect(state().next).toBeNull();
    expect(state().summary).toMatch(/scaffold/);
  });

  it('says an approval is stale once the proposal changes after it', () => {
    const approved = applyEdits(doc(), [{ kind: 'approve', by: 'sean', at: '2026-10-25T12:00:00Z' }]);
    const changed = applyEdits(approved, [{ kind: 'rename-domain', from: 'shell', to: 'console' }]);
    for (const f of ['bundle.json', 'requests.json', 'source/project.json', 'source/graph.json', 'source/join.json']) write(path.join(bundle, f), '{}');
    write(path.join(bundle, 'proposal', 'proposal.base.yaml'), dumpYaml(doc()));
    write(path.join(bundle, 'proposal', 'PROPOSAL.md'), '# proposal');
    write(path.join(bundle, 'proposal', 'decomposition.yaml'), dumpYaml(changed));
    expect(stateOf('approve')).toMatchObject({ state: 'stale', detail: expect.stringContaining('changed after sean approved it') });
  });

  it('is not fooled by a checkout: an untouched proposal with a newer timestamp leaves the review package fresh', async () => {
    for (const f of ['bundle.json', 'requests.json', 'source/project.json', 'source/graph.json', 'source/join.json']) write(path.join(bundle, f), '{}');
    write(path.join(bundle, 'proposal', 'proposal.base.yaml'), dumpYaml(doc()));
    write(path.join(bundle, 'proposal', 'decomposition.yaml'), dumpYaml(doc()));
    write(path.join(bundle, 'proposal', 'PROPOSAL.md'), '# proposal');
    await writeProvenance(path.join(bundle, 'proposal', 'PROPOSAL.md'), [path.join(bundle, 'proposal', 'decomposition.yaml')]);
    // git checkout: every file gets a new mtime, in whatever order; the content is the same.
    const later = clock + 1000;
    fs.utimesSync(path.join(bundle, 'proposal', 'decomposition.yaml'), later, later);
    expect(stateOf('present')?.state).toBe('done');

    // A real edit is still seen, whatever the timestamps say.
    fs.writeFileSync(path.join(bundle, 'proposal', 'decomposition.yaml'), dumpYaml(applyEdits(doc(), [{ kind: 'rename-domain', from: 'shell', to: 'console' }])));
    fs.utimesSync(path.join(bundle, 'proposal', 'decomposition.yaml'), 1, 1);
    expect(stateOf('present')).toMatchObject({ state: 'stale', detail: 'proposal/decomposition.yaml changed since proposal/PROPOSAL.md was built' });
  });

  it('counts the agent’s suggestions waiting on the optional shaping step', () => {
    const suggested = applyEdits(doc(), [{ kind: 'suggest', by: 'agent', at: 't', explanation: 'x', edit: { kind: 'rename-domain', from: 'shell', to: 'console' } }]);
    write(path.join(bundle, 'proposal', 'decomposition.yaml'), dumpYaml(suggested));
    expect(flowChecks['suggestions-waiting'](bundle)).toMatchObject({ detail: '1 suggestion waiting' });
  });

  it('reports the proposal as the workspace reads it, for flow:status --proposal', async () => {
    write(path.join(bundle, 'proposal', 'decomposition.yaml'), dumpYaml(doc()));
    const proposal = path.join(bundle, 'proposal');
    const { warnings, ...expected } = await loadProposalStatus(proposal, { evidence: bundle });
    const got = await proposalStatusOf(bundle);
    expect(got).toEqual({ status: expected, warnings });
    expect(got?.status.approval.status).toBe('none');
  });

  it('has no proposal status before a proposal exists', async () => {
    await expect(proposalStatusOf(bundle)).resolves.toBeNull();
  });

  it('reports verify done only when the parity report says at parity', () => {
    write(path.join(work, 'verify', 'parity.json'), JSON.stringify({ parity: false }));
    expect(flowChecks['at-parity'](bundle)).toEqual({ done: false, detail: 'the last parity run failed — see verify/parity.md' });
    write(path.join(work, 'verify', 'parity.json'), JSON.stringify({ parity: true }));
    expect(flowChecks['at-parity'](bundle)).toEqual({ done: true, detail: 'at parity' });
  });
});

describe('every shipped flow is true to the CLI (ADR-119 §4)', () => {
  it.each(FLOW_IDS)('%s: names only commands the CLI has, and only checks it registers', (id) => {
    const flow = loadShippedFlow(id);
    for (const step of flow.steps.filter((s) => s.available)) {
      if (step.check) expect(Object.keys(flowChecks)).toContain(step.check);
      if (!step.command) continue;
      const [bin, command] = step.command.split(' ');
      expect(bin).toBe('seans-mfe-tool');
      const [topic, name] = command.split(':');
      expect(fs.existsSync(path.join(REPO, 'src', 'commands', topic, `${name}.ts`))).toBe(true);
    }
  });

  it('ships the decomposition flow', () => {
    expect(FLOW_IDS).toContain('decompose');
    expect(fsProbe.mtime(path.join(REPO, 'flows', 'decompose.yaml'))).not.toBeNull();
  });
});

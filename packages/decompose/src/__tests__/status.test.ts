import { applyEdits } from '../edit';
import { proposalStatus } from '../status';
import type { Decomposition, Domain } from '../model';
import type { EvidenceStep } from '../present';

const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };
const domain = (id: string, files: string[], caps: string[], extra: Partial<Domain> = {}): Domain => ({
  id, mfe: `app-${id}`, shell: false, files,
  capabilities: caps.map((name, i) => ({ name, file: files[i] ?? files[0], component: name })),
  backends: [], endpoints: [], evidence, reasons: [], ...extra,
});

function doc(): Decomposition {
  return {
    version: 1,
    app: { name: 'app', namespace: 'app', gateway: true },
    domains: [
      domain('shell', ['src/App.tsx'], ['App'], { shell: true }),
      domain('docking', ['src/Board.tsx'], ['Board']),
      domain('cargo', ['src/Manifest.tsx'], ['Manifest']),
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
  };
}

const at = '2026-10-25T12:00:00.000Z';
const steps: EvidenceStep[] = [
  {
    id: 'j.0',
    path: '/docking',
    screenshot: 'screens/j.0.png',
    regions: [
      { id: 'r0', component: 'App', file: 'src/App.tsx', parent: null, rect: { x: 0, y: 0, width: 800, height: 600 } },
      { id: 'r1', component: 'Board', file: 'src/Board.tsx', parent: 'r0', rect: { x: 200, y: 0, width: 600, height: 600 } },
    ],
  },
];

describe('proposalStatus — what the workspace renders (ADR-116 §3)', () => {
  it('returns the document, its validation and its approval state', () => {
    const approved = applyEdits(doc(), [{ kind: 'approve', by: 'sean', at }]);
    const status = proposalStatus(approved);
    expect(status.app).toEqual({ name: 'app', namespace: 'app' });
    expect(status.approval).toEqual({ status: 'current', by: 'sean', at, hash: approved.approval?.hash });
    expect(status.valid).toBe(true);
    expect(status.document.domains.map((d) => d.id)).toEqual(['shell', 'docking', 'cargo']);
    expect(status.screens).toBeNull();
  });

  it('checks each pending suggestion the way the oracle does: applied alone, then the fleet validated', () => {
    const suggested = applyEdits(doc(), [
      { kind: 'suggest', by: 'agent', at, explanation: 'one team', edit: { kind: 'merge-domains', domains: ['docking', 'cargo'], into: 'harbor' } },
      { kind: 'suggest', by: 'agent', at, explanation: 'no such domain', edit: { kind: 'rename-domain', from: 'crew', to: 'people' } },
    ]);
    const status = proposalStatus(suggested);
    expect(status.suggestions.map((s) => s.check.ok)).toEqual([true, false]);
    expect(status.suggestions[1].check.errors).toEqual(['no domain "crew" in the proposal']);
    expect(status.suggestions[0].check.domains).toEqual(['shell', 'harbor']);
  });

  it('draws the captured screens with each domain outlined, when there is evidence', () => {
    const status = proposalStatus(doc(), { steps, viewport: { width: 800, height: 600 } });
    expect(status.screens?.screens.map((s) => [s.path, s.boxes.map((b) => b.domain)])).toEqual([['/docking', ['shell', 'docking']]]);
    expect(status.screens?.legend.map((l) => l.domain)).toEqual(['shell', 'docking', 'cargo']);
  });
});

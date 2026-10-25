import { deriveFleet } from '../derive';
import { inferSpecs } from '../openapi';
import type { Decomposition } from '../model';

const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };

function doc(overrides: Partial<Decomposition> = {}): Decomposition {
  return {
    version: 1,
    app: { name: 'meridian', namespace: 'meridian' },
    domains: [
      {
        id: 'console', mfe: 'meridian-console', shell: true, files: ['src/App.tsx'],
        capabilities: [{ name: 'App', file: 'src/App.tsx', component: 'App' }],
        backends: [], endpoints: [], evidence, reasons: [],
      },
      {
        id: 'docking', mfe: 'meridian-docking', shell: false, files: ['src/DockingBoard.tsx', 'src/BerthTile.tsx'],
        capabilities: [
          { name: 'DockingBoard', file: 'src/DockingBoard.tsx', component: 'DockingBoard' },
          { name: 'BerthTile', file: 'src/BerthTile.tsx', component: 'BerthTile' },
        ],
        backends: ['harbormaster', 'ledger'], endpoints: ['GET /api/harbormaster/dockings', 'GET /api/ledger/charges'], evidence, reasons: [],
      },
    ],
    shared: [], unassigned: [], couplings: [],
    slots: [
      { id: 'main', provider: 'console', repeated: false },
      { id: 'berth-tile.{id}', provider: 'console', repeated: true },
    ],
    routes: [{ path: '/docking', stateKey: 'meridian.open.docking', place: [{ capability: 'DockingBoard', domain: 'docking', slot: 'main' }] }],
    repeated: [{ capability: 'BerthTile', domain: 'docking', slot: 'berth-tile.{id}', renderedBy: 'src/BerthStrip.tsx' }],
    tests: [], uncovered: [],
    ...overrides,
  };
}

describe('deriveFleet', () => {
  it('derives one valid manifest per domain and a composition that compiles', () => {
    const fleet = deriveFleet(doc());
    expect(Object.keys(fleet.manifests)).toEqual(['meridian-console', 'meridian-docking']);
    expect(fleet.validation).toEqual({ manifests: { 'meridian-console': [], 'meridian-docking': [] }, composition: [] });

    const docking = fleet.manifests['meridian-docking'] as Record<string, unknown>;
    expect(docking).toMatchObject({ name: 'meridian-docking', type: 'remote', framework: 'react', hosts: [{ id: 'meridian' }] });
    expect((docking.data as { sources: Array<{ name: string }> }).sources.map((s) => s.name)).toEqual(['harbormaster', 'ledger']);

    const shell = fleet.manifests['meridian-console'] as { providesSlots: Array<{ id: string }> };
    expect(shell.providesSlots.map((s) => s.id)).toEqual(['main', 'berth-tile.{id}']);
  });

  it('places the shell at the root and every route into the shell’s slots', () => {
    const { composition } = deriveFleet(doc());
    expect(composition).toEqual({
      project: 'meridian',
      namespace: 'meridian',
      mfes: ['meridian-console', 'meridian-docking'],
      routes: [
        { when: 'meridian.root', place: [{ capability: 'App', into: 'root' }] },
        { when: 'meridian.open.docking', place: [{ capability: 'DockingBoard', into: 'meridian-console/main' }] },
      ],
    });
  });

  it('reports what does not validate instead of throwing', () => {
    const broken = doc({
      routes: [{ path: '/x', stateKey: 'meridian.open.x', place: [{ capability: 'Nowhere', domain: 'docking', slot: 'main' }] }],
    });
    const { validation } = deriveFleet(broken);
    expect(validation.composition.map((f) => f.rule)).toContain('unknown-capability');
  });

  describe('with inferred specs (ADR-112)', () => {
    const inferred = inferSpecs({
      appUrl: 'http://localhost:5173',
      requests: [
        { id: 'a.0.r0', method: 'GET', url: '/api/harbormaster/dockings', status: 200 },
        { id: 'a.0.r1', method: 'GET', url: '/api/harbormaster/berths', status: 200 },
        { id: 'a.0.r2', method: 'GET', url: '/api/ledger/charges', status: 200 },
      ],
      responses: {
        'GET /api/harbormaster/dockings': { status: 200, mimeType: 'application/json', body: [{ docking_id: 4021 }] },
        'GET /api/harbormaster/berths': { status: 200, mimeType: 'application/json', body: [{ berth_id: 'b1' }] },
        'GET /api/ledger/charges': { status: 200, mimeType: 'application/json', body: { meta: { hasMore: false }, result: [{ chargeId: 'C-1' }] } },
      },
      code: [],
    });
    const specs = Object.fromEntries(Object.entries(inferred).map(([k, v]) => [k, v.document]));
    const mocks = Object.fromEntries(Object.entries(inferred).map(([k, v]) => [k, v.mocks]));
    const fleet = deriveFleet(doc(), { specs, mocks });

    it('gives each BFF only the operations its domain calls, and unwraps enveloped lists', () => {
      expect(fleet.validation.manifests['meridian-docking']).toEqual([]);
      expect(Object.keys(fleet.bff['meridian-docking'].specs.harbormaster.paths)).toEqual(['/dockings']);
      const sources = (fleet.manifests['meridian-docking'].data as { sources: Array<Record<string, unknown>> }).sources;
      expect(sources[0]).toEqual({ name: 'harbormaster', handler: { openapi: { source: './specs/harbormaster.yaml' } } });
      expect(sources[1].transforms).toEqual([
        { hoistField: [{ typeName: 'Query', pathConfig: ['listCharges', 'result'], newFieldName: 'charges' }] },
      ]);
      expect(fleet.manifests['meridian-docking'].data).toMatchObject({ mockSwitch: { enabled: true } });
    });

    it('turns the recorded responses into the BFF’s demo fixtures, the hoisted field included', () => {
      expect(fleet.bff['meridian-docking'].mocks).toEqual({
        listDockings: [{ docking_id: 4021 }],
        listCharges: { meta: { hasMore: false }, result: [{ chargeId: 'C-1' }] },
        charges: [{ chargeId: 'C-1' }],
      });
      // A domain with no backend has no BFF.
      expect(fleet.bff['meridian-console']).toBeUndefined();
    });
  });
});

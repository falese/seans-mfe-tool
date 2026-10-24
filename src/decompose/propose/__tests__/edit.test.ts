import { applyEdits, parseEditFlags } from '../edit';
import { deriveFleet } from '../derive';
import { diffProposals } from '../score';
import type { Decomposition, Domain } from '../model';

const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };
const domain = (id: string, files: string[], caps: string[], extra: Partial<Domain> = {}): Domain => ({
  id, mfe: `app-${id}`, shell: false, files,
  capabilities: caps.map((name, i) => ({ name, file: files[i] ?? files[0], component: name })),
  backends: [], endpoints: [], evidence, reasons: [], ...extra,
});

function doc(): Decomposition {
  return {
    version: 1,
    app: { name: 'app', namespace: 'app' },
    domains: [
      domain('shell', ['src/App.tsx'], ['App'], { shell: true }),
      domain('docking', ['src/Board.tsx'], ['Board'], { backends: ['harbormaster'], endpoints: ['GET /api/harbormaster/dockings'] }),
      domain('cargo', ['src/Manifest.tsx', 'src/Hazards.tsx'], ['Manifest', 'Hazards'], { backends: ['harbormaster', 'ledger'], endpoints: ['GET /api/ledger/valuations'] }),
    ],
    shared: [{ file: 'src/constants.ts', usedBy: ['shell'], suggestion: 'split by domain' }],
    unassigned: [],
    couplings: [{ file: 'src/Hazards.tsx', domain: 'cargo', field: 'dockings', endpoint: 'GET /api/harbormaster/dockings', owner: 'docking', kind: 'store-read', note: '' }],
    slots: [{ id: 'main', provider: 'shell', repeated: false }, { id: 'aside', provider: 'shell', repeated: false }],
    routes: [
      { path: '/docking', stateKey: 'app.open.docking', place: [{ capability: 'Board', domain: 'docking', slot: 'main' }] },
      { path: '/cargo', stateKey: 'app.open.cargo', place: [
        { capability: 'Manifest', domain: 'cargo', slot: 'main' },
        { capability: 'Hazards', domain: 'cargo', slot: 'aside' },
      ] },
    ],
    repeated: [],
    tests: [{ file: 'src/__tests__/Board.test.tsx', domain: 'docking', verdict: 'keep', reasons: [] }],
    uncovered: [{ capability: 'Manifest', domain: 'cargo', file: 'src/Manifest.tsx', reason: '' }],
  };
}

describe('applyEdits', () => {
  it('renames a domain everywhere it is referenced, and its MFE', () => {
    const out = applyEdits(doc(), [{ kind: 'rename-domain', from: 'shell', to: 'console' }]);
    expect(out.domains[0]).toMatchObject({ id: 'console', mfe: 'app-console' });
    expect(out.slots.map((s) => s.provider)).toEqual(['console', 'console']);
    expect(out.shared[0].usedBy).toEqual(['console']);
  });

  it('merges two domains into one consistent domain, and the fleet still derives and validates', () => {
    const out = applyEdits(doc(), [{ kind: 'merge-domains', domains: ['docking', 'cargo'], into: 'harbor' }]);
    expect(out.domains.map((d) => d.id)).toEqual(['shell', 'harbor']);
    const harbor = out.domains[1];
    expect(harbor.files).toEqual(['src/Board.tsx', 'src/Hazards.tsx', 'src/Manifest.tsx']);
    expect(harbor.capabilities.map((c) => c.name)).toEqual(['Board', 'Manifest', 'Hazards']);
    expect(harbor.backends).toEqual(['harbormaster', 'ledger']);
    expect(out.routes.flatMap((r) => r.place.map((p) => p.domain))).toEqual(['harbor', 'harbor', 'harbor']);
    // The coupling was between the two merged domains: it is internal now.
    expect(out.couplings).toEqual([]);
    expect(out.tests[0].domain).toBe('harbor');

    const fleet = deriveFleet(out);
    expect(Object.keys(fleet.manifests)).toEqual(['app-shell', 'app-harbor']);
    expect(fleet.validation.composition).toEqual([]);
    expect(Object.values(fleet.validation.manifests).flat()).toEqual([]);
  });

  it('moves a file between domains, or out of shared', () => {
    const out = applyEdits(doc(), [
      { kind: 'move-file', file: 'src/constants.ts', to: 'shell' },
      { kind: 'move-file', file: 'src/Hazards.tsx', to: 'docking' },
    ]);
    expect(out.shared).toEqual([]);
    expect(out.domains[0].files).toEqual(['src/App.tsx', 'src/constants.ts']);
    // A capability moves with its file, and so do its placements.
    expect(out.domains[1].capabilities.map((c) => c.name)).toEqual(['Board', 'Hazards']);
    expect(out.routes[1].place[1]).toEqual({ capability: 'Hazards', domain: 'docking', slot: 'aside' });
  });

  it('renames capabilities and slots, keeping placements consistent', () => {
    const out = applyEdits(doc(), [
      { kind: 'rename-capability', from: 'Manifest', to: 'CargoManifest' },
      { kind: 'rename-slot', from: 'aside', to: 'status' },
    ]);
    expect(out.routes[1].place).toEqual([
      { capability: 'CargoManifest', domain: 'cargo', slot: 'main' },
      { capability: 'Hazards', domain: 'cargo', slot: 'status' },
    ]);
    expect(out.uncovered[0].capability).toBe('CargoManifest');
    expect(out.slots.map((s) => s.id)).toEqual(['main', 'status']);
  });

  it('rejects an edit that names something the proposal does not have', () => {
    expect(() => applyEdits(doc(), [{ kind: 'rename-domain', from: 'nope', to: 'x' }])).toThrow(/no domain "nope"/);
    expect(() => applyEdits(doc(), [{ kind: 'rename-domain', from: 'cargo', to: 'docking' }])).toThrow(/already exists/);
    expect(() => applyEdits(doc(), [{ kind: 'move-file', file: 'src/Nope.tsx', to: 'cargo' }])).toThrow(/not in the proposal/);
    // A capability's file cannot become shared, and a refused edit changes nothing.
    const before = doc();
    expect(() => applyEdits(before, [{ kind: 'move-file', file: 'src/Board.tsx', to: 'shared' }])).toThrow(/holds a capability/);
    expect(before.domains[1].files).toEqual(['src/Board.tsx']);
  });

  it('round-trips with the scorer: the edits it lists are the edits that were applied', () => {
    const edits = [
      { kind: 'rename-domain' as const, from: 'shell', to: 'console' },
      { kind: 'move-file' as const, file: 'src/constants.ts', to: 'console' },
      { kind: 'rename-capability' as const, from: 'Manifest', to: 'CargoManifest' },
    ];
    expect(diffProposals(doc(), applyEdits(doc(), edits))).toEqual([
      { kind: 'rename-domain', from: 'shell', to: 'console' },
      { kind: 'move-file', file: 'src/constants.ts', from: 'shared', to: 'console' },
      { kind: 'rename-capability', domain: 'cargo', from: 'Manifest', to: 'CargoManifest' },
    ]);
  });
});

describe('parseEditFlags', () => {
  it('reads the command-line forms', () => {
    expect(
      parseEditFlags({
        'rename-domain': ['shell=console'],
        merge: ['docking,cargo=harbor'],
        move: ['src/constants.ts=console'],
        'rename-capability': ['App=Console'],
        'rename-slot': ['aside=status'],
      })
    ).toEqual([
      { kind: 'rename-domain', from: 'shell', to: 'console' },
      { kind: 'merge-domains', domains: ['docking', 'cargo'], into: 'harbor' },
      { kind: 'move-file', file: 'src/constants.ts', to: 'console' },
      { kind: 'rename-capability', from: 'App', to: 'Console' },
      { kind: 'rename-slot', from: 'aside', to: 'status' },
    ]);
    expect(() => parseEditFlags({ 'rename-domain': ['nope'] })).toThrow(/from=to/);
  });
});

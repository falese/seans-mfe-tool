import { applyEdits, approvalHash, approvalStatus, parseEditFlags, parseEditOps } from '../edit';
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

  it('reads a split as domain=into:file,file', () => {
    expect(parseEditFlags({ split: ['cargo=hazmat:src/Hazards.tsx,src/Labels.tsx'] })).toEqual([
      { kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['src/Hazards.tsx', 'src/Labels.tsx'] },
    ]);
    expect(() => parseEditFlags({ split: ['cargo=hazmat'] })).toThrow(/domain=into:file/);
  });
});

describe('the workspace edits (ADR-116)', () => {
  const withFileData = (): Decomposition => ({
    ...doc(),
    fileEndpoints: {
      'src/Board.tsx': ['GET /api/harbormaster/dockings'],
      'src/Manifest.tsx': ['GET /api/ledger/valuations'],
      'src/Hazards.tsx': ['GET /api/harbormaster/hazards'],
    },
  });
  const at = '2026-10-25T12:00:00.000Z';

  it('splits files out of a domain into a new one, with the data each half calls', () => {
    const out = applyEdits(withFileData(), [{ kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['src/Hazards.tsx'] }]);
    expect(out.domains.map((d) => d.id)).toEqual(['shell', 'docking', 'cargo', 'hazmat']);
    const [cargo, hazmat] = out.domains.slice(2);
    expect(cargo).toMatchObject({ files: ['src/Manifest.tsx'], endpoints: ['GET /api/ledger/valuations'], backends: ['ledger'] });
    expect(hazmat).toMatchObject({ mfe: 'app-hazmat', files: ['src/Hazards.tsx'], endpoints: ['GET /api/harbormaster/hazards'], backends: ['harbormaster'] });
    expect(hazmat.capabilities.map((c) => c.name)).toEqual(['Hazards']);
    expect(out.routes[1].place[1]).toEqual({ capability: 'Hazards', domain: 'hazmat', slot: 'aside' });
    expect(out.couplings[0].domain).toBe('hazmat');
    const fleet = deriveFleet(out);
    expect(Object.values(fleet.validation.manifests).flat()).toEqual([]);
    expect(fleet.validation.composition).toEqual([]);
  });

  it('refuses a split that would empty the domain, or name a file it does not own', () => {
    expect(() => applyEdits(withFileData(), [{ kind: 'split-domain', domain: 'cargo', into: 'x', files: ['src/Manifest.tsx', 'src/Hazards.tsx'] }])).toThrow(/would leave cargo empty/);
    expect(() => applyEdits(withFileData(), [{ kind: 'split-domain', domain: 'cargo', into: 'x', files: ['src/Board.tsx'] }])).toThrow(/not in cargo/);
  });

  it('moving a file carries its data with it when the proposal knows each file’s calls', () => {
    const out = applyEdits(withFileData(), [{ kind: 'move-file', file: 'src/Hazards.tsx', to: 'docking' }]);
    expect(out.domains[1].endpoints).toEqual(['GET /api/harbormaster/dockings', 'GET /api/harbormaster/hazards']);
    expect(out.domains[2]).toMatchObject({ endpoints: ['GET /api/ledger/valuations'], backends: ['ledger'] });
  });

  it('records comments with an id, author and time, about a domain or the whole proposal', () => {
    const out = applyEdits(doc(), [
      { kind: 'comment', by: 'sean', at, text: 'Hazards feels like its own product', about: 'cargo' },
      { kind: 'comment', by: 'sean', at, text: 'Looks right overall' },
    ]);
    expect(out.comments).toEqual([
      { id: 'c1', by: 'sean', at, text: 'Hazards feels like its own product', about: 'cargo' },
      { id: 'c2', by: 'sean', at, text: 'Looks right overall' },
    ]);
    expect(() => applyEdits(doc(), [{ kind: 'comment', by: 'sean', at, text: 'x', about: 'nowhere' }])).toThrow(/no domain "nowhere"/);
  });

  it('holds an agent’s edit as a suggestion until it is accepted or rejected', () => {
    const suggested = applyEdits(doc(), [
      { kind: 'suggest', by: 'agent', at, explanation: 'One harbor team owns both', edit: { kind: 'merge-domains', domains: ['docking', 'cargo'], into: 'harbor' } },
      { kind: 'suggest', by: 'agent', at, explanation: 'Clearer name', edit: { kind: 'rename-domain', from: 'shell', to: 'console' } },
    ]);
    // Nothing changed yet.
    expect(suggested.domains.map((d) => d.id)).toEqual(['shell', 'docking', 'cargo']);
    expect(suggested.suggestions?.map((s) => s.id)).toEqual(['s1', 's2']);

    const accepted = applyEdits(suggested, [{ kind: 'accept-suggestion', id: 's1' }, { kind: 'reject-suggestion', id: 's2' }]);
    expect(accepted.domains.map((d) => d.id)).toEqual(['shell', 'harbor']);
    expect(accepted.suggestions).toEqual([]);
    expect(() => applyEdits(suggested, [{ kind: 'accept-suggestion', id: 's9' }])).toThrow(/no suggestion "s9"/);
    // A suggestion cannot carry approval, or another suggestion.
    expect(() => applyEdits(doc(), [{ kind: 'suggest', by: 'agent', at, explanation: '', edit: { kind: 'approve', by: 'agent', at } }])).toThrow(/cannot be suggested/);
  });

  it('records approval with a hash of what was approved; a later change makes it stale, a comment does not', () => {
    const approved = applyEdits(doc(), [{ kind: 'approve', by: 'sean', at }]);
    expect(approved.approval).toEqual({ by: 'sean', at, hash: approvalHash(doc()) });
    expect(approvalStatus(approved)).toBe('current');
    expect(approvalStatus(applyEdits(approved, [{ kind: 'comment', by: 'pat', at, text: 'thanks' }]))).toBe('current');
    expect(approvalStatus(applyEdits(approved, [{ kind: 'rename-slot', from: 'aside', to: 'status' }]))).toBe('stale');
    expect(approvalStatus(doc())).toBe('none');
  });
});

describe('parseEditOps', () => {
  it('reads a JSON list of edits and rejects unknown kinds', () => {
    expect(parseEditOps('[{"kind":"rename-domain","from":"a","to":"b"}]')).toEqual([{ kind: 'rename-domain', from: 'a', to: 'b' }]);
    expect(() => parseEditOps('[{"kind":"delete-everything"}]')).toThrow(/not a known edit/);
    expect(() => parseEditOps('{')).toThrow(/not JSON/);
  });
});

import { compileControlPlane, DSLManifestSchema, validateFull, type DSLManifest } from '@seans-mfe/dsl';
import { deriveFleet, type Decomposition } from '@seans-mfe/decompose';
import {
  legacyCapabilityName,
  legacyComposition,
  legacyFeatureSource,
  legacyManifest,
  legacyMfeName,
  monolithFederationSnippet,
  remoteScope,
} from '../legacy';

const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };

function doc(): Decomposition {
  return {
    version: 1,
    app: { name: 'meridian-ops', namespace: 'meridian-ops', gateway: true },
    domains: [
      {
        id: 'console', mfe: 'meridian-ops-console', shell: true, files: ['src/App.tsx'],
        capabilities: [{ name: 'App', file: 'src/App.tsx', component: 'App' }],
        backends: [], endpoints: [], evidence, reasons: [],
      },
      {
        id: 'docking', mfe: 'meridian-ops-docking', shell: false, files: ['src/DockingBoard.tsx'],
        capabilities: [{ name: 'DockingBoard', file: 'src/DockingBoard.tsx', component: 'DockingBoard' }],
        backends: ['harbormaster'], endpoints: ['GET /api/harbormaster/dockings'], evidence, reasons: [],
      },
    ],
    shared: [], unassigned: [], couplings: [],
    slots: [{ id: 'main', provider: 'console', repeated: false }],
    routes: [
      { path: '/', stateKey: 'meridian-ops.root', place: [] },
      { path: '/docking', stateKey: 'meridian-ops.open.docking', place: [{ capability: 'DockingBoard', domain: 'docking', slot: 'main' }] },
    ],
    repeated: [], tests: [], uncovered: [],
  };
}

const parse = (m: Record<string, unknown>): DSLManifest => DSLManifestSchema.parse(m) as DSLManifest;

describe('the legacy wrapper (ADR-111 §1)', () => {
  it('is named after the app and has one domain capability', () => {
    expect(legacyMfeName(doc())).toBe('legacy-meridian-ops');
    expect(legacyCapabilityName(doc())).toBe('LegacyMeridianOps');
    expect(remoteScope(doc())).toBe('meridian_ops');
  });

  it('is a normal SMT manifest that validates', () => {
    const m = legacyManifest(doc(), { port: 5200 });
    expect(validateFull(m)).toMatchObject({ valid: true });
    expect(m).toMatchObject({ name: 'legacy-meridian-ops', type: 'remote', framework: 'react', hosts: [{ id: 'meridian-ops' }] });
    const domain = (m.capabilities as Array<Record<string, { type: string }>>).filter((c) => Object.values(c)[0].type === 'domain');
    expect(domain.map((c) => Object.keys(c)[0])).toEqual(['LegacyMeridianOps']);
    // The monolith calls its own backends: the wrapper fronts none.
    expect(m.data).toBeUndefined();
  });

  it('renders the monolith by loading its remote entry, as an island with its own React (ADR-111 §2, ADR-060)', () => {
    const src = legacyFeatureSource(doc(), { remoteEntry: 'http://localhost:5090/remoteEntry.js' });
    expect(src).toContain("const REMOTE_ENTRY = 'http://localhost:5090/remoteEntry.js'");
    expect(src).toContain("const SCOPE = 'meridian_ops'");
    expect(src).toContain('export const LegacyMeridianOps');
    expect(src).toContain('export interface LegacyMeridianOpsProps');
    expect(src).toContain('export default LegacyMeridianOps');
    // No text of its own: the parity gate allows a wrapper only if it draws nothing (ADR-113).
    expect(src).toMatch(/return <div ref=\{ref\} data-legacy-app="meridian-ops" data-composition="pending" \/>;/);
    // Pending until the monolith has mounted, so capture does not record a half-assembled page.
    expect(src).toContain("ref.current.dataset.composition = 'ready';");
    expect(src.match(/<\/\w+>/g)).toBeNull();
  });

  it('tells the monolith how to expose its root', () => {
    const s = monolithFederationSnippet(doc());
    expect(s.module).toContain('export function mount(element');
    expect(s.webpack).toContain("name: 'meridian_ops'");
    expect(s.webpack).toContain("'./mount'");
    expect(s.webpack).toContain("filename: 'remoteEntry.js'");
  });
});

describe('the strangler starting point (ADR-111 §3)', () => {
  it('places the legacy capability in the root for every state key the proposal routes, and compiles', () => {
    const d = doc();
    const fleet = deriveFleet(d);
    const legacy = legacyManifest(d, { port: 5200 });
    const composition = legacyComposition(d);
    expect(composition.mfes).toEqual(['meridian-ops-console', 'meridian-ops-docking', 'legacy-meridian-ops']);
    expect(composition.routes.map((r) => r.when)).toEqual(['meridian-ops.root', 'meridian-ops.open.docking']);
    for (const r of composition.routes) expect(r.place).toEqual([{ capability: 'LegacyMeridianOps', into: 'root' }]);
    const manifests = [...Object.values(fleet.manifests), legacy].map(parse);
    const { findings } = compileControlPlane({ document: composition, manifests });
    expect(findings.filter((f) => f.fatal)).toEqual([]);
  });

  it('adds a root state key when the proposal routes none', () => {
    const d = { ...doc(), routes: [] };
    expect(legacyComposition(d).routes.map((r) => r.when)).toEqual(['meridian-ops.root']);
  });
});

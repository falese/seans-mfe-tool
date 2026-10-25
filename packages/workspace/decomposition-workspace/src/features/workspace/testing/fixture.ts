import type { ProposalStatus } from '../types';

const evidence = { route: 1, data: 0.8, imports: 0.6, runtime: null, cochange: null, ownership: null };

/** A small proposal in the shape flow:status --proposal returns. */
export function fixtureStatus(over: Partial<ProposalStatus> = {}): ProposalStatus {
  return {
    proposal: '/p/decomposition.yaml',
    bundle: '/p/..',
    app: { name: 'meridian-ops', namespace: 'meridian-ops' },
    approval: { status: 'none' },
    valid: true,
    validation: { manifests: {}, composition: [] },
    suggestions: [],
    document: {
      domains: [
        { id: 'shell', mfe: 'meridian-ops-shell', shell: true, files: ['src/App.tsx'], capabilities: [{ name: 'App', file: 'src/App.tsx', component: 'App' }], backends: [], endpoints: [], evidence, reasons: ['files reached only from the entry'] },
        {
          id: 'cargo',
          mfe: 'meridian-ops-cargo',
          shell: false,
          files: ['src/pages/cargo/CargoManifest.tsx', 'src/pages/cargo/HazardSummary.tsx'],
          capabilities: [
            { name: 'CargoManifest', file: 'src/pages/cargo/CargoManifest.tsx', component: 'CargoManifest' },
            { name: 'HazardSummary', file: 'src/pages/cargo/HazardSummary.tsx', component: 'HazardSummary' },
          ],
          backends: ['harbormaster', 'ledger'],
          endpoints: ['GET /api/harbormaster/manifest_lines', 'GET /api/ledger/valuations'],
          evidence,
          reasons: ['route /cargo fills the main area'],
        },
        { id: 'docking', mfe: 'meridian-ops-docking', shell: false, files: ['src/pages/DockingBoard.tsx'], capabilities: [{ name: 'DockingBoard', file: 'src/pages/DockingBoard.tsx', component: 'DockingBoard' }], backends: ['harbormaster'], endpoints: ['GET /api/harbormaster/dockings'], evidence, reasons: [] },
      ],
      shared: [{ file: 'src/utils/constants.ts', usedBy: ['shell', 'cargo'], suggestion: 'split by domain' }],
      couplings: [{ file: 'src/pages/cargo/HazardSummary.tsx', domain: 'cargo', field: 'dockings', endpoint: 'GET /api/harbormaster/dockings', owner: 'docking', kind: 'store-read', note: '' }],
      comments: [],
    },
    screens: {
      screens: [
        {
          id: 'j.0',
          path: '/cargo',
          screenshot: 'screens/j.0.png',
          width: 1000,
          height: 500,
          boxes: [
            { domain: 'shell', mfe: 'meridian-ops-shell', capability: 'App', slot: 'root', label: 'shell · meridian-ops-shell · root', color: '#8a8f98', rect: { x: 0, y: 0, width: 1000, height: 500 } },
            { domain: 'cargo', mfe: 'meridian-ops-cargo', capability: 'CargoManifest', slot: 'main', label: 'cargo · meridian-ops-cargo · main', color: '#3b6ff5', rect: { x: 250, y: 100, width: 500, height: 300 } },
          ],
          couplings: [{ file: 'src/pages/cargo/HazardSummary.tsx', label: 'coupling: cargo reads docking’s dockings', rect: { x: 800, y: 100, width: 150, height: 100 } }],
        },
      ],
      legend: [
        { domain: 'shell', mfe: 'meridian-ops-shell', color: '#8a8f98' },
        { domain: 'cargo', mfe: 'meridian-ops-cargo', color: '#3b6ff5' },
        { domain: 'docking', mfe: 'meridian-ops-docking', color: '#8455d6' },
      ],
    },
    ...over,
  };
}

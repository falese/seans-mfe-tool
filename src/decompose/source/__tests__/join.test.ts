import { joinEvidence } from '../join';
import type { FileNode, SourceGraph } from '../graph';

const node = (file: string, extra: Partial<FileNode>): FileNode => ({
  file,
  components: [],
  imports: [],
  packages: [],
  endpoints: [],
  apiClient: false,
  storeReads: [],
  landmarks: [],
  renders: [],
  assignment: { category: 'shell', screens: [] },
  ...extra,
});

const graph: SourceGraph = {
  entries: ['src/index.tsx'],
  routes: [],
  files: [
    node('src/api/client.ts', {
      apiClient: true,
      endpoints: [
        { method: 'GET', url: '/api/harbormaster/dockings' },
        { method: 'GET', url: '/api/harbormaster/dockings/{id}' },
        { method: 'GET', url: '/api/ledger/payroll' },
      ],
    }),
    node('src/components/crew/PayStatus.tsx', { endpoints: [{ method: 'GET', url: '/api/ledger/payroll' }] }),
    node('src/pages/cargo/HazardSummary.tsx', {
      storeReads: [{ hook: 'useAppState', store: 'src/store/AppContext.tsx', field: 'dockings', endpoints: [{ method: 'GET', url: '/api/harbormaster/dockings' }] }],
    }),
  ],
};

describe('joinEvidence', () => {
  const join = joinEvidence(graph, {
    requests: [
      { method: 'GET', url: '/api/harbormaster/dockings?berth_id=b1', attributedTo: [{ region: 'src/components/DockingBoard.tsx#DockingBoard', via: 'data' }] },
      { method: 'GET', url: '/api/harbormaster/dockings', attributedTo: [] },
      { method: 'GET', url: '/api/harbormaster/dockings/4021', attributedTo: [] },
      { method: 'GET', url: '/api/unknown', attributedTo: [] },
    ],
    steps: [
      { path: '/docking', regions: [{ id: 'src/components/DockingBoard.tsx#DockingBoard', component: 'DockingBoard', file: 'src/components/DockingBoard.tsx' }] },
    ],
  });

  it('matches observed endpoints to source, query ignored, preferring the most literal template', () => {
    expect(join.endpoints).toEqual([
      {
        method: 'GET',
        url: '/api/harbormaster/dockings',
        observed: 2,
        template: '/api/harbormaster/dockings',
        clients: ['src/api/client.ts'],
        callers: [],
        storeReaders: ['src/pages/cargo/HazardSummary.tsx'],
      },
      {
        method: 'GET',
        url: '/api/harbormaster/dockings/4021',
        observed: 1,
        template: '/api/harbormaster/dockings/{id}',
        clients: ['src/api/client.ts'],
        callers: [],
        storeReaders: [],
      },
      { method: 'GET', url: '/api/unknown', observed: 1, template: null, clients: [], callers: [], storeReaders: [] },
    ]);
  });

  it('lists endpoints the source can call that no journey exercised', () => {
    expect(join.sourceOnly).toEqual([
      { method: 'GET', url: '/api/ledger/payroll', files: ['src/api/client.ts', 'src/components/crew/PayStatus.tsx'] },
    ]);
  });

  it('records what the capture saw of each file', () => {
    expect(join.files['src/components/DockingBoard.tsx']).toEqual({
      components: ['DockingBoard'],
      paths: ['/docking'],
      endpoints: [{ method: 'GET', url: '/api/harbormaster/dockings', via: 'data' }],
    });
    expect(join.summary).toEqual({
      observedEndpoints: 3,
      explained: 2,
      unexplained: 1,
      sourceOnly: 1,
      filesSeenAtRuntime: 1,
      sourceFiles: 3,
    });
  });
});

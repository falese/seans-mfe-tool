/**
 * #414 acceptance, statically, on the reference monolith: every source file is
 * assigned to a screen or flagged, and the API call sites are the backends the
 * M2 capture observed.
 */
import * as path from 'path';
import * as ts from 'typescript';
import { readProject } from '../load';
import { buildSourceGraph } from '../graph';

const MONOLITH = path.resolve(__dirname, '../../../../examples/meridian-monolith');

describe('decompose:analyze on meridian-monolith', () => {
  let graph: ReturnType<typeof buildSourceGraph>;
  let tests: string[];
  beforeAll(async () => {
    const project = await readProject(ts, MONOLITH);
    graph = buildSourceGraph(project.facts);
    tests = project.tests;
  });

  it('assigns every source file to a screen, the shell or shared — none unreached', () => {
    const unreached = graph.files.filter((f) => f.assignment.category === 'unreached').map((f) => f.file);
    expect(unreached).toEqual([]);
    expect(graph.entries).toEqual(['src/index.tsx']);
  });

  it('reads the route table, main and status-rail outlets both', () => {
    const route = (p: string) => graph.routes.find((r) => r.path === p);
    expect(route('/cargo')?.elements).toEqual([
      { component: 'CargoManifest', file: 'src/pages/cargo/CargoManifest.tsx', container: 'main' },
      { component: 'HazardSummary', file: 'src/pages/cargo/HazardSummary.tsx', container: 'aside' },
    ]);
    expect(graph.routes.map((r) => r.path)).toEqual(['*', '/', '/cargo', '/concourse', '/crew', '/docking', '/life-support', '/simulator']);
  });

  it('finds the 13 endpoints the M2 capture observed (16 requests), all in the one API client', () => {
    const client = graph.files.find((f) => f.file === 'src/api/client.ts');
    expect(client?.apiClient).toBe(true);
    expect(client?.endpoints.map((e) => `${e.method} ${e.url}`)).toEqual([
      'GET /api/harbormaster/berths',
      'GET /api/harbormaster/dockings',
      'GET /api/harbormaster/manifest_lines',
      'GET /api/ledger/charges',
      'GET /api/ledger/payroll',
      'GET /api/ledger/settlements',
      'GET /api/ledger/valuations',
      'GET /api/stationos/certifications',
      'GET /api/stationos/crew',
      'GET /api/stationos/modules',
      'GET /api/stationos/stalls',
      'GET /api/stationos/telemetry',
      'GET /api/stationos/vendors',
    ]);
  });

  it('sees the store couplings the answer key names, including the one no screen shows', () => {
    const reads = (file: string) => graph.files.find((f) => f.file === file)?.storeReads.map((r) => r.field);
    expect(reads('src/pages/cargo/HazardSummary.tsx')).toEqual(['dockings']);
    expect(reads('src/pages/ConcoursePage.tsx')).toEqual(['dockings']);
    expect(reads('src/layout/Sidebar.tsx')).toEqual(['telemetry']);
  });

  it('finds the test suite', () => {
    expect(tests).toContain('e2e/smoke.spec.ts');
    expect(tests).toContain('src/components/__tests__/DockingBoard.test.tsx');
  });
});

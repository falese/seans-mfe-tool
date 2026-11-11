/**
 * #419 on the reference monolith (ADR-126): the approved deterministic proposal,
 * scaffolded, then ported — every domain's code into its MFE, the shell's route
 * blocks into slots, the proposal composed directly.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as ts from 'typescript';
import { applyEdits, dumpYaml, writeSpecs, type Decomposition, type OpenApiDocument } from '@seans-mfe/decompose';
import { readProject } from '../../source/load';
import { buildSourceGraph } from '../../source/graph';
import { inventoryTests } from '../../source/tests';
import { propose } from '../../propose/cluster';
import { scaffoldFleet } from '../../scaffold/scaffold';
import { portFleet, type PortResult } from '../port';

const MONOLITH = path.resolve(__dirname, '../../../../examples/meridian-monolith');
jest.setTimeout(120_000);

describe('decompose:port on meridian-monolith', () => {
  let work: string;
  let proposalDir: string;
  let fleet: string;
  let doc: Decomposition;
  let result: PortResult;
  const read = (...p: string[]) => fs.readFileSync(path.join(fleet, ...p), 'utf8');

  beforeAll(async () => {
    const project = await readProject(ts, MONOLITH);
    const tests = await inventoryTests(ts, MONOLITH, project.tests, new Set(project.facts.map((f) => f.file)), false);
    doc = applyEdits(propose({ appName: 'meridian-ops', namespace: 'meridian-ops', graph: buildSourceGraph(project.facts), tests }), [
      { kind: 'approve', by: 'Sean', at: '2026-11-11T00:00:00Z' },
    ]);
    work = await fs.mkdtemp(path.join(os.tmpdir(), 'port-'));
    proposalDir = path.join(work, 'evidence', 'proposal');
    await fs.ensureDir(proposalDir);
    await fs.writeFile(path.join(proposalDir, 'decomposition.yaml'), dumpYaml(doc));
    // Each backend's spec, as decompose:propose would infer it: one list operation per endpoint called.
    const specs: Record<string, OpenApiDocument> = {};
    for (const e of [...new Set([...doc.domains.flatMap((d) => d.endpoints), ...Object.values(doc.fileEndpoints ?? {}).flat()])]) {
      const [, backend, ...rest] = (e.split(' ')[1] ?? '').split('/').filter(Boolean);
      const p = `/${rest.join('/')}`;
      const id = `list${rest.map((r) => r.replace(/(^|_)([a-z])/g, (_m, _u, c: string) => c.toUpperCase())).join('')}`;
      specs[backend] ??= { openapi: '3.0.3', info: { title: backend, version: '1' }, paths: {} };
      specs[backend].paths[p] = {
        get: { operationId: id, responses: { '200': { description: 'ok', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } } } } } } },
      };
    }
    await writeSpecs(proposalDir, { specs });
    fleet = path.join(work, 'fleet');
    await scaffoldFleet({ proposalDir, outDir: fleet, appDir: MONOLITH });
    await fs.writeJson(path.join(proposalDir, 'scaffold.json'), { fleetDir: fleet });
    result = await portFleet({ proposalDir, appDir: MONOLITH });
  });
  afterAll(() => fs.remove(work));

  it('turns the shell\'s two route blocks into the slots the proposal places into', () => {
    expect(result.slots).toEqual(['src/App.tsx: main', 'src/App.tsx: aside']);
    const app = read('meridian-ops-shell', 'src', 'monolith', 'src', 'App.tsx');
    expect(app).toContain('<PortedSlot id="main" />');
    expect(app).toContain('<PortedSlot id="aside" />');
    expect(app).toContain("import { PortedSlot } from '../__port__/slots';");
    // The pages it no longer renders are no longer imported, so they are not copied into the shell.
    expect(app).not.toMatch(/DockingBoard|CargoPage|react-router-dom/);
    expect(result.mfes.find((m) => m.domain === 'shell')?.files).not.toContain('src/components/DockingBoard.tsx');
    expect(app).toContain('<Sidebar />');
  });

  it('copies each domain\'s closure, unchanged, and says what more than one MFE now carries', () => {
    const cargo = result.mfes.find((m) => m.domain === 'cargo') as PortResult['mfes'][number];
    expect(cargo.files).toEqual(expect.arrayContaining(['src/pages/cargo/CargoManifest.tsx', 'src/store/AppContext.tsx', 'src/api/client.ts']));
    expect(read('meridian-ops-cargo', 'src', 'monolith', 'src', 'pages', 'cargo', 'CargoManifest.tsx')).toBe(
      fs.readFileSync(path.join(MONOLITH, 'src', 'pages', 'cargo', 'CargoManifest.tsx'), 'utf8')
    );
    expect(result.duplicated.map((d) => d.file)).toEqual(expect.arrayContaining(['src/api/client.ts', 'src/store/AppContext.tsx']));
  });

  it('renders each capability inside the providers the monolith\'s entry renders', () => {
    const f = read('meridian-ops-cargo', 'src', 'features', 'CargoManifest', 'CargoManifest.tsx');
    expect(f).toContain("import { BrowserRouter } from 'react-router-dom';");
    expect(f).toContain("import { AppProvider } from '../../monolith/src/store/AppContext';");
    expect(f).toMatch(/<BrowserRouter>\s*<AppProvider>\s*<Ported \{\.\.\.props\} \/>\s*<\/AppProvider>\s*<\/BrowserRouter>/);
    const shellApp = read('meridian-ops-shell', 'src', 'features', 'App', 'App.tsx');
    expect(shellApp).toContain('<SlotRegistrar.Provider value={provideSlot}>');
  });

  it('adds the packages the copied code imports, at the monolith\'s versions', async () => {
    const pkg = (await fs.readJson(path.join(fleet, 'meridian-ops-cargo', 'package.json'))) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['react-router-dom']).toBe('^6.23.1');
    expect(pkg.dependencies.axios).toBe('^1.7.2');
  });

  it('composes the proposal directly: the legacy wrapper is placed nowhere', async () => {
    const cp = yaml.load(read('control-plane', 'control-plane.yaml')) as { mfes: string[]; routes: Array<{ when: string; place: Array<{ capability: string; into: string }> }> };
    expect(cp.mfes).not.toContain('legacy-meridian-ops');
    expect(cp.routes[0]).toMatchObject({ when: 'meridian-ops.root', place: expect.arrayContaining([{ capability: 'App', into: 'root' }]) });
    expect(JSON.stringify(cp)).not.toContain('LegacyMeridianOps');
    expect(read('shell', 'src', 'routes.ts')).toContain('"stateKey": "meridian-ops.open.cargo"');
  });

  it('gives the shell a capability that renders nothing, and places it where a state leaves a slot empty (ADR-126 §4a)', () => {
    expect(read('meridian-ops-shell', 'src', 'features', 'EmptySlot', 'EmptySlot.tsx')).toContain('export const EmptySlot: React.FC<EmptySlotProps> = () => null;');
    expect(result.mfes.find((m) => m.domain === 'shell')?.capabilities).toEqual(['App', 'EmptySlot']);
    const cp = yaml.load(read('control-plane', 'control-plane.yaml')) as { routes: Array<{ when: string; place: Array<{ capability: string; into: string }> }> };
    const simulator = cp.routes.find((r) => r.when === 'meridian-ops.open.simulator');
    expect(simulator?.place).toEqual([
      { capability: 'SimulatorPage', into: 'meridian-ops-shell/main' },
      { capability: 'EmptySlot', into: 'meridian-ops-shell/aside' },
    ]);
  });

  it('reroutes the monolith\'s HTTP instance to the MFE\'s BFF, and leaves the client above it unchanged (ADR-127 §2)', () => {
    const client = read('meridian-ops-cargo', 'src', 'monolith', 'src', 'api', 'client.ts');
    expect(client).toContain('const http = bffHttp;');
    expect(client).toContain("import { bffHttp } from '../../__port__/bff-http';");
    expect(client).not.toMatch(/from 'axios'/);
    expect(read('meridian-ops-cargo', 'src', 'monolith', '__port__', 'bff-http.ts')).toContain("import { query } from '../../platform/bff/bff';");
    const cargo = result.mfes.find((m) => m.domain === 'cargo');
    expect(cargo?.bff.rerouted).toEqual(['src/api/client.ts']);
    expect(cargo?.bff.operations).toEqual(['GET /api/harbormaster/dockings', 'GET /api/harbormaster/manifest_lines', 'GET /api/ledger/valuations']);
  });

  it('fronts what the shell reads across a coupling and through the tiles it renders, and leaves the rest empty (ADR-127 §1, §3)', () => {
    const shell = result.mfes.find((m) => m.domain === 'shell');
    expect(shell?.bff.operations).toEqual(['GET /api/harbormaster/berths', 'GET /api/harbormaster/dockings', 'GET /api/ledger/charges', 'GET /api/stationos/telemetry']);
    const ops = read('meridian-ops-shell', 'src', 'monolith', '__port__', 'bff-operations.ts');
    expect(ops).toMatch(/"path": "\/api\/stationos\/modules",\s*"value": \[\]/);
    expect(fs.existsSync(path.join(fleet, 'meridian-ops-shell', 'specs', 'stationos.yaml'))).toBe(true);
  });

  it('reports what it leaves to the agent: couplings and the repeated tile', () => {
    expect(result.warnings.filter((w) => w.startsWith('coupling kept'))).toHaveLength(3);
    expect(result.warnings.some((w) => w.startsWith('BerthTile'))).toBe(true);
  });

  it('keeps a feature file a developer has changed, and rewrites one it wrote itself', async () => {
    const mine = path.join(fleet, 'meridian-ops-crew', 'src', 'features', 'CrewRoster', 'CrewRoster.tsx');
    await fs.writeFile(mine, '// mine\n');
    const again = await portFleet({ proposalDir, appDir: MONOLITH });
    expect(await fs.readFile(mine, 'utf8')).toBe('// mine\n');
    expect(again.mfes.find((m) => m.domain === 'crew')?.kept).toEqual(['CrewRoster']);
    expect(again.mfes.find((m) => m.domain === 'cargo')?.capabilities).toEqual(['CargoManifest', 'HazardSummary']);
  });
});

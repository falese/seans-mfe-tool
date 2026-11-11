/**
 * test:generate over a small MFE and a capture written by hand (ADR-129):
 * what it writes, what it keeps, and what it moves from a monolith.
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { decodePng } from '../../decompose/verify/png';
import { encodePng } from '../png';
import { generateTests, testTarget } from '../generate';
import type { Decomposition } from '@seans-mfe/decompose';

const screenshot = () => {
  const width = 40;
  const height = 30;
  const data = new Uint8Array(width * height * 4).fill(200);
  return encodePng({ width, height, data });
};

const region = (id: string, component: string, parent: string | null, ownText: string, rect: { x: number; y: number; width: number; height: number }) => ({
  id,
  component,
  file: `src/${component}.tsx`,
  landmark: null,
  parent,
  rect,
  ownText,
  data: {},
});

async function fixture(root: string): Promise<{ mfe: string; evidence: string; proposal: string; app: string }> {
  const evidence = path.join(root, 'evidence');
  const mfe = path.join(root, 'fleet', 'ops-docking');
  const app = path.join(root, 'monolith');
  await fs.outputJson(path.join(evidence, 'bundle.json'), { app: 'http://localhost:5090', clock: '2026-11-11T00:00:00.000Z', viewport: { width: 40, height: 30 }, journeys: ['tour'] });
  await fs.outputFile(path.join(evidence, 'journeys.yaml'), yaml.dump({ journeys: [{ name: 'tour', steps: [{ goto: '/docking' }] }] }));
  await fs.outputJson(path.join(evidence, 'journeys', 'tour.json'), {
    name: 'tour',
    steps: [
      {
        id: 'tour.0',
        path: '/docking',
        regions: [region('App', 'App', null, '', { x: 0, y: 0, width: 40, height: 30 }), region('Board', 'DockingBoard', 'App', 'Docking board 3 vessels', { x: 5, y: 5, width: 20, height: 10 })],
        requests: ['tour.0.r0'],
        console: [],
        pageErrors: [],
        screenshot: 'screens/tour.0.png',
      },
    ],
  });
  await fs.outputFile(path.join(evidence, 'screens', 'tour.0.png'), screenshot());
  await fs.outputJson(path.join(evidence, 'requests.json'), [{ id: 'tour.0.r0', method: 'GET', url: '/api/harbormaster/dockings', attributedTo: [{ region: 'Board', via: 'values' }] }]);
  await fs.outputJson(path.join(evidence, 'responses.json'), { 'GET /api/harbormaster/dockings': { status: 200, mimeType: 'application/json', body: [{ id: 'd1' }] } });

  await fs.outputFile(
    path.join(mfe, 'mfe-manifest.yaml'),
    yaml.dump({ name: 'ops-docking', capabilities: [{ DockingBoard: { type: 'domain' } }, { load: { type: 'platform' } }] })
  );
  await fs.outputJson(path.join(mfe, 'package.json'), { name: 'ops-docking', scripts: { test: 'jest' }, devDependencies: {}, jest: { preset: 'ts-jest' } });
  await fs.outputFile(
    path.join(mfe, 'specs', 'harbormaster.yaml'),
    yaml.dump({
      openapi: '3.0.3',
      info: { title: 'harbormaster', version: '1' },
      paths: { '/dockings': { get: { operationId: 'listDockings', responses: { '200': { description: 'ok', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } } } } } } } } },
    })
  );
  await fs.outputFile(path.join(mfe, 'src', 'monolith', 'src', 'components', 'DockingBoard.tsx'), 'export const DockingBoard = () => null;\n');

  await fs.outputFile(path.join(app, 'src', 'components', '__tests__', 'DockingBoard.test.tsx'), "import { DockingBoard } from '../DockingBoard';\nit('renders', () => expect(DockingBoard).toBeDefined());\n");
  await fs.outputFile(path.join(app, 'jest.config.js'), "module.exports = { setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'] };\n");
  await fs.outputFile(path.join(app, 'src', 'setupTests.ts'), "import '@testing-library/jest-dom';\n");
  await fs.outputFile(path.join(app, 'src', 'utils', '__tests__', 'other.test.ts'), "import { x } from '../other';\nit('x', () => expect(x).toBe(1));\n");

  const proposal = path.join(evidence, 'proposal');
  const doc: Partial<Decomposition> = {
    version: 1,
    app: { name: 'ops', namespace: 'ops', gateway: true },
    domains: [
      { id: 'shell', mfe: 'ops-shell', shell: true, files: [], capabilities: [{ name: 'App', file: 'src/App.tsx', component: 'App' }], backends: [], endpoints: [], evidence: { route: null, data: null, imports: null, runtime: null, cochange: null, ownership: null }, reasons: [] },
      { id: 'docking', mfe: 'ops-docking', shell: false, files: [], capabilities: [{ name: 'DockingBoard', file: 'src/components/DockingBoard.tsx', component: 'DockingBoard' }], backends: [], endpoints: [], evidence: { route: null, data: null, imports: null, runtime: null, cochange: null, ownership: null }, reasons: [] },
    ],
    shared: [],
    unassigned: [],
    couplings: [],
    slots: [],
    routes: [{ path: '/docking', stateKey: 'ops.open.docking', place: [{ capability: 'DockingBoard', domain: 'docking', slot: 'main' }] }],
    repeated: [],
    tests: [
      { file: 'src/components/__tests__/DockingBoard.test.tsx', domain: 'docking', verdict: 'keep', reasons: ['behavioral, and runs'] },
      { file: 'src/utils/__tests__/other.test.ts', domain: 'docking', verdict: 'keep', reasons: ['behavioral, and runs'] },
      { file: 'src/components/__tests__/Snap.test.tsx', domain: 'docking', verdict: 'rewrite', reasons: ['snapshot-only: pins markup, not behavior'] },
    ],
    uncovered: [],
  };
  await fs.outputFile(path.join(proposal, 'decomposition.yaml'), yaml.dump(doc));
  return { mfe, evidence, proposal, app };
}

describe('generateTests', () => {
  let root: string;
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'testgen-'));
    f = await fixture(root);
  });
  afterEach(() => fs.remove(root));

  const run = (force = false) => generateTests({ mfeDir: f.mfe, evidenceDir: f.evidence, proposalDir: f.proposal, appDir: f.app, force });

  it('writes each kind of test, with the data each reads', async () => {
    const r = await run();
    expect(r.alone).toEqual([{ capability: 'DockingBoard', cases: 1 }]);
    expect(r.journeys).toEqual({ journeys: 1, checks: 1, baselines: 1 });
    expect(r.contract).toEqual({ operations: 1, unrecorded: [] });
    expect(r.written).toEqual(
      expect.arrayContaining([
        'src/__smt__/recorded-network.ts',
        'src/features/DockingBoard/DockingBoard.characterization.test.tsx',
        'src/features/DockingBoard/__characterization__/DockingBoard.json',
        'e2e/characterization.spec.ts',
        'e2e/characterization/baselines/tour-0-DockingBoard.png',
        'playwright.characterization.config.ts',
        'src/platform/bff/__tests__/contract.test.ts',
        'src/platform/bff/contract/connector.contract.ts',
        'TESTS.md',
      ])
    );
    const cases = (await fs.readJson(path.join(f.mfe, 'src/features/DockingBoard/__characterization__/DockingBoard.json'))) as { cases: Array<{ calls: string[] }> };
    expect(cases.cases[0].calls).toEqual(['GET /api/harbormaster/dockings']);
    const baseline = decodePng(await fs.readFile(path.join(f.mfe, 'e2e/characterization/baselines/tour-0-DockingBoard.png')));
    expect([baseline.width, baseline.height]).toEqual([20, 10]);
  });

  it('moves a kept test to every MFE that carries what it imports, and records the rest', async () => {
    const r = await run();
    expect(r.migrated.kept).toEqual(['src/components/__tests__/DockingBoard.test.tsx']);
    const moved = await fs.readFile(path.join(f.mfe, 'src/monolith/src/components/__tests__/DockingBoard.test.tsx'), 'utf8');
    // It ran inside the monolith's Jest setup, which moves with it.
    expect(moved.split('\n')[0]).toBe("import '../../setupTests'; // the monolith's Jest setup, moved with this test (ADR-129 §6)");
    expect(moved).toContain("import { DockingBoard } from '../DockingBoard';");
    expect(await fs.readFile(path.join(f.mfe, 'src/monolith/src/setupTests.ts'), 'utf8')).toBe("import '@testing-library/jest-dom';\n");
    expect(r.migrated.rewritten).toEqual([{ file: 'src/components/__tests__/Snap.test.tsx', reasons: ['snapshot-only: pins markup, not behavior'] }]);
    expect(await fs.readFile(r.report, 'utf8')).toContain('rewritten as the characterization tests above');
  });

  it('adds the scripts and keeps Jest off the Playwright spec, once', async () => {
    await run();
    await run();
    const pkg = (await fs.readJson(path.join(f.mfe, 'package.json'))) as { scripts: Record<string, string>; devDependencies: Record<string, string>; jest: { testPathIgnorePatterns: string[] } };
    expect(pkg.scripts['test:e2e']).toBe('playwright test -c playwright.characterization.config.ts');
    expect(pkg.scripts['test:contract']).toContain('mesh build');
    expect(pkg.devDependencies['@playwright/test']).toBeDefined();
    expect(pkg.jest.testPathIgnorePatterns).toEqual(['/node_modules/', '<rootDir>/e2e/']);
  });

  it('never replaces a file a developer changed, unless forced', async () => {
    await run();
    const test = path.join(f.mfe, 'src/features/DockingBoard/DockingBoard.characterization.test.tsx');
    await fs.appendFile(test, '// mine\n');
    const again = await run();
    expect(again.kept).toEqual(['src/features/DockingBoard/DockingBoard.characterization.test.tsx']);
    expect(await fs.readFile(test, 'utf8')).toContain('// mine');
    await run(true);
    expect(await fs.readFile(test, 'utf8')).not.toContain('// mine');
  });

  it('refreshes what is still as generated when the capture changes', async () => {
    await run();
    const responses = path.join(f.evidence, 'responses.json');
    await fs.writeJson(responses, { 'GET /api/harbormaster/dockings': { status: 200, mimeType: 'application/json', body: [{ id: 'd2' }] } });
    const again = await run();
    expect(again.kept).toEqual([]);
    expect(await fs.readFile(path.join(f.mfe, 'src/__smt__/recorded.json'), 'utf8')).toContain('d2');
  });
});

describe('testTarget', () => {
  it('stops a view at every placed capability and names the shell root', () => {
    const doc = {
      domains: [
        { id: 'shell', mfe: 's', shell: true, capabilities: [{ name: 'App', file: 'a', component: 'App' }] },
        { id: 'docking', mfe: 'd', shell: false, capabilities: [{ name: 'Board', file: 'b', component: 'DockingBoard' }, { name: 'BerthTile', file: 't', component: 'BerthTile' }] },
      ],
      routes: [{ path: '/', stateKey: 'x', place: [{ capability: 'Board', domain: 'docking', slot: 'main' }] }],
      repeated: [{ capability: 'BerthTile', domain: 'docking', slot: 'strip', renderedBy: 'src/layout/BerthStrip.tsx' }],
    } as unknown as Decomposition;
    const t = testTarget({ name: 'd', capabilities: [{ Board: { type: 'domain' } }, { BerthTile: { type: 'domain' } }, { load: { type: 'platform' } }] }, doc);
    expect(t.boundaries).toEqual(['App', 'DockingBoard']);
    expect(t.capabilities.map((c) => [c.name, c.component, Boolean(c.notAlone)])).toEqual([
      ['Board', 'DockingBoard', false],
      ['BerthTile', 'BerthTile', true],
    ]);
  });
});

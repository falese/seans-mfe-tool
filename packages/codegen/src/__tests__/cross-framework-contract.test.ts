import { generateAllFiles } from '../unified-generator';
import type { DSLManifest } from '@seans-mfe/dsl';
import * as fs from 'fs-extra';
import path from 'path';

/**
 * #281 — structural guard on the shared BaseMFE lifecycle contract.
 *
 * The React (`base-mfe/`) and Angular (`base-mfe-angular/`) template trees encode
 * the SAME lifecycle contract twice and are edited independently, so they drift in
 * both directions (DX-REPORT "Meta-finding: the React and Angular templates drift").
 * PR #280 fixed specific instances with point assertions; this suite is the generic
 * guard: generate BOTH lanes from one logical manifest and assert the shared
 * lifecycle surface stays equivalent. A new divergence in the contract surface
 * (bootstrap Context shape, emitted platform files, BFF gating, expose key) fails
 * here regardless of which lane introduced it.
 *
 * Scope: the framework-independent surface only. Genuinely framework-specific code
 * (rspack vs webpack config, .tsx vs .component.ts) is expected to differ and is not
 * asserted here.
 */
describe('cross-framework lifecycle-contract parity (#281)', () => {
  const react: DSLManifest = {
    name: 'ParityMFE',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    description: 'Parity manifest (react)',
    endpoint: 'http://localhost:3001',
    capabilities: [
      { DataAnalysis: { type: 'domain', description: 'Analyze data' } },
      { Health: { type: 'platform', description: 'Health check' } },
    ],
  };
  const angular: DSLManifest = {
    ...react,
    framework: 'angular',
    bundler: 'webpack',
    description: 'Parity manifest (angular)',
    endpoint: 'http://localhost:3101',
  };
  const withData = <T extends DSLManifest>(m: T): T =>
    ({
      ...m,
      data: {
        sources: [{ name: 'TestAPI', handler: { openapi: { source: './test.yaml' } } }],
        serve: { endpoint: '/graphql', playground: true },
      },
    }) as T;

  const reactDir = path.join(__dirname, 'output-parity-react');
  const angularDir = path.join(__dirname, 'output-parity-angular');

  afterAll(async () => {
    await fs.remove(reactDir);
    await fs.remove(angularDir);
  });

  async function gen(manifest: DSLManifest, dir: string) {
    const { files } = await generateAllFiles(manifest, dir, { force: true });
    const get = (relPath: string) =>
      files.find((f) => f.path === path.join(dir, relPath));
    return { files, get };
  }

  // The shared lifecycle files both lanes MUST emit at the same paths (ADR-040).
  const SHARED_LIFECYCLE_FILES = [
    path.join('src', 'platform', 'base-mfe', 'mfe.ts'),
    path.join('src', 'platform', 'base-mfe', 'bootstrap.ts'),
    path.join('src', 'platform', 'base-mfe', 'types.ts'),
    path.join('src', 'platform', 'base-mfe', 'mfe.test.ts'),
  ];

  it('both lanes emit the same shared lifecycle files', async () => {
    const r = await gen(react, reactDir);
    const a = await gen(angular, angularDir);
    for (const f of SHARED_LIFECYCLE_FILES) {
      expect(r.get(f)).toBeDefined();
      expect(a.get(f)).toBeDefined();
    }
  });

  it('both bootstrap.ts call load() with the identical Context shape', async () => {
    const r = await gen(react, reactDir);
    const a = await gen(angular, angularDir);
    const rb = r.get(path.join('src', 'platform', 'base-mfe', 'bootstrap.ts'))!.content;
    const ab = a.get(path.join('src', 'platform', 'base-mfe', 'bootstrap.ts'))!.content;

    // Same instantiation + export surface (the imperative-render contract).
    for (const content of [rb, ab]) {
      expect(content).toContain("import { ParityMFEMFE } from './mfe'");
      expect(content).toContain('export const mfe = new ParityMFEMFE(manifest)');
      expect(content).toContain('export const mfeReady: Promise<void>');
      // The load() Context must carry request identity — a partial literal fails
      // typecheck in a fresh project (DX punch list #17). Both lanes must agree.
      expect(content).toContain('.load({');
      expect(content).toContain('requestId:');
      expect(content).toContain('timestamp: new Date()');
      expect(content).toContain('inputs: {');
      expect(content).toContain('remoteEntry: manifest.remoteEntry');
    }
  });

  it('both lanes gate the BFF identically on the data: section (#271)', async () => {
    // No data → neither lane emits a BFF server or mesh config.
    const rNo = await gen(react, reactDir);
    const aNo = await gen(angular, angularDir);
    for (const g of [rNo, aNo]) {
      expect(g.get('server.ts')).toBeUndefined();
      expect(g.get('.meshrc.yaml')).toBeUndefined();
      expect(g.get('package.json')!.content).not.toContain('"build:server"');
    }

    // With data → both lanes emit the BFF server, mesh config and BFF scripts.
    const rYes = await gen(withData(react), reactDir);
    const aYes = await gen(withData(angular), angularDir);
    for (const g of [rYes, aYes]) {
      expect(g.get('server.ts')).toBeDefined();
      expect(g.get('.meshrc.yaml')).toBeDefined();
      expect(g.get('package.json')!.content).toContain('"build:server"');
    }
  });

  it('both lanes expose the remote under ./App (#272)', async () => {
    const r = await gen(react, reactDir);
    const a = await gen(angular, angularDir);
    const rCfg = r.get('rspack.config.js')!.content;
    const aCfg = a.get('webpack.config.js')!.content;
    expect(rCfg).toContain("'./App'");
    expect(aCfg).toContain("'./App'");
    expect(aCfg).not.toContain("'./Component'");
  });

  it('both lanes emit a .gitignore (#274)', async () => {
    const r = await gen(react, reactDir);
    const a = await gen(angular, angularDir);
    expect(r.get('.gitignore')).toBeDefined();
    expect(a.get('.gitignore')).toBeDefined();
  });

  it('every emitted strict-JSON root file parses in both lanes', async () => {
    // package.json / angular.json must be strict JSON (tsconfig* are JSONC and
    // excluded). A malformed key/trailing comma in either lane fails here.
    const strictJson = ['package.json', 'angular.json'];
    for (const manifest of [react, angular, withData(react), withData(angular)]) {
      const dir = manifest.framework === 'angular' ? angularDir : reactDir;
      const { get } = await gen(manifest, dir);
      for (const name of strictJson) {
        const file = get(name);
        if (!file) continue; // angular.json only exists for the angular lane
        expect(() => JSON.parse(file.content)).not.toThrow();
      }
    }
  });
});

import { generateAllFiles, extractManifestVars } from '../unified-generator';
import * as fs from 'fs-extra';
import path from 'path';

describe('unified-generator angular-webpack variant', () => {
  const baseManifest = {
    name: 'NgTest',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'angular' as const,
    bundler: 'webpack' as const,
    description: 'Angular test manifest',
    endpoint: 'http://localhost:3101',
    capabilities: [
      { DataAnalysis: { type: 'domain', description: 'Analyze data' } },
      { Health: { type: 'platform', description: 'Health check' } },
    ],
    dependencies: {
      runtime: {
        '@angular/core': '^17.0.0',
        '@angular/common': '^17.0.0',
        '@angular/platform-browser': '^17.0.0',
        rxjs: '^7.8.0',
        'zone.js': '~0.14.0',
      },
    },
  };
  const basePath = path.join(__dirname, 'output-angular');

  beforeAll(async () => {
    await fs.remove(basePath);
  });

  afterAll(async () => {
    await fs.remove(basePath);
  });

  it('emits angular.json + webpack partial + tsconfig pair (not rspack.config.js)', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(path.join(basePath, 'angular.json'));
    expect(paths).toContain(path.join(basePath, 'webpack.config.js'));
    expect(paths).toContain(path.join(basePath, 'tsconfig.json'));
    expect(paths).toContain(path.join(basePath, 'tsconfig.app.json'));
    expect(paths).not.toContain(path.join(basePath, 'rspack.config.js'));
  });

  it('emits an Angular-aware tsconfig.json (not the BFF/React one)', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const tsconfig = files.find((f) => f.path === path.join(basePath, 'tsconfig.json'));
    expect(tsconfig).toBeDefined();
    expect(tsconfig!.content).toContain('experimentalDecorators');
    expect(tsconfig!.content).toContain('angularCompilerOptions');
    expect(tsconfig!.content).not.toContain('react-jsx');
  });

  it('emits Angular entry files instead of App.tsx / index.tsx', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(path.join(basePath, 'src', 'main.ts'));
    expect(paths).toContain(path.join(basePath, 'src', 'bootstrap.ts'));
    expect(paths).toContain(path.join(basePath, 'src', 'app', 'app.component.ts'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'App.tsx'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'index.tsx'));
  });

  it('configures angular.json with the custom-webpack builder pointing at the MF partial', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const angularJson = files.find((f) => f.path === path.join(basePath, 'angular.json'));

    expect(angularJson).toBeDefined();
    expect(angularJson!.content).toContain('@angular-builders/custom-webpack:browser');
    expect(angularJson!.content).toContain('@angular-builders/custom-webpack:dev-server');
    expect(angularJson!.content).toContain('./webpack.config.js');
    expect(angularJson!.content).toContain('"zone.js"');
  });

  it('emits feature components as .component.ts (Angular convention)', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(
      path.join(basePath, 'src', 'features', 'DataAnalysis', 'DataAnalysis.component.ts')
    );
    expect(paths).toContain(
      path.join(basePath, 'src', 'features', 'DataAnalysis', 'DataAnalysis.component.spec.ts')
    );
    expect(paths).not.toContain(
      path.join(basePath, 'src', 'features', 'DataAnalysis', 'DataAnalysis.tsx')
    );
  });

  it('emits src/remote.ts (not remote.tsx) as the MF expose target', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(path.join(basePath, 'src', 'remote.ts'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'remote.tsx'));
  });

  it('renders webpack.config.js as an MF partial with Angular singletons in shared scope', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const webpackConfig = files.find((f) => f.path.endsWith('webpack.config.js'));

    expect(webpackConfig).toBeDefined();
    expect(webpackConfig!.content).toContain("require('@angular-architects/module-federation/webpack')");
    expect(webpackConfig!.content).toContain('withModuleFederationPlugin');
    expect(webpackConfig!.content).toContain("'@angular/core':");
    expect(webpackConfig!.content).toContain('strictVersion: true');
    // No react in shared scope
    expect(webpackConfig!.content).not.toContain("'react':");
    // No raw webpack instance (avoids two-instance 'tap' crash)
    expect(webpackConfig!.content).not.toContain("require('webpack')");
  });

  it('renders package.json with Angular CLI builder deps (and no react/rspack/ngtools)', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const pkg = files.find((f) => f.path === path.join(basePath, 'package.json'));

    expect(pkg).toBeDefined();
    expect(pkg!.content).toContain('"@angular/core"');
    // Pinned so jest-preset-angular's peer resolves to Angular 17 (not 19+) — avoids ERESOLVE.
    expect(pkg!.content).toContain('"@angular/platform-browser-dynamic"');
    expect(pkg!.content).toContain('"@angular-builders/custom-webpack"');
    expect(pkg!.content).toContain('"@angular-devkit/build-angular"');
    expect(pkg!.content).toContain('"@angular-architects/module-federation"');
    expect(pkg!.content).not.toContain('"webpack"');
    // prebff:dev builds the GraphQL Mesh artifacts so `npm run dev` works cold
    // (server.ts imports ./.mesh, which only exists after `mesh build`).
    expect(pkg!.content).toContain('"prebff:dev"');
    expect(pkg!.content).not.toContain('"@ngtools/webpack"');
    expect(pkg!.content).not.toContain('"react":');
    expect(pkg!.content).not.toContain('"@rspack/core"');
  });

  it('generates mfe.ts that extends AngularRemoteMFE (not RemoteMFE)', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const mfeFile = files.find((f) =>
      f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts')
    );

    expect(mfeFile).toBeDefined();
    expect(mfeFile!.content).toContain('extends AngularRemoteMFE');
    expect(mfeFile!.content).toContain('AngularRemoteMFE');
    expect(mfeFile!.content).not.toContain('extends RemoteMFE {');
  });
});

describe('extractManifestVars — plugin-driven variant selection (ADR-071, #176)', () => {
  it('react manifest → react-rspack plugin fields', () => {
    const manifest = {
      name: 'ReactMFE', version: '1.0.0', description: '', endpoint: 'http://localhost:3001',
      framework: 'react' as const, bundler: 'rspack' as const, capabilities: [],
    };
    const vars = extractManifestVars(manifest as any);
    expect(vars.framework).toBe('react');
    expect(vars.bundler).toBe('rspack');
    expect(vars.templateVariant).toBe('react-rspack');
  });

  it('angular manifest → angular-webpack plugin fields', () => {
    const manifest = {
      name: 'NgMFE', version: '1.0.0', description: '', endpoint: 'http://localhost:3101',
      framework: 'angular' as const, bundler: 'webpack' as const, capabilities: [],
    };
    const vars = extractManifestVars(manifest as any);
    expect(vars.framework).toBe('angular');
    expect(vars.bundler).toBe('webpack');
    expect(vars.templateVariant).toBe('angular-webpack');
  });

  it('bundler:webpack alone (no framework field) → angular-webpack (backward compat)', () => {
    const manifest = {
      name: 'BundlerOnly', version: '1.0.0', description: '', endpoint: 'http://localhost:3101',
      bundler: 'webpack' as const, capabilities: [],
    };
    const vars = extractManifestVars(manifest as any);
    expect(vars.framework).toBe('angular');
    expect(vars.bundler).toBe('webpack');
    expect(vars.templateVariant).toBe('angular-webpack');
  });
});

describe('unified-generator react-rspack regression (no framework/bundler set)', () => {
  // Guard: a manifest without framework/bundler must produce the same output
  // as before so existing MFEs in the wild keep generating identically.
  const reactManifest = {
    name: 'ReactTest',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    description: 'React back-compat manifest',
    endpoint: 'http://localhost:3001',
    capabilities: [{ DataAnalysis: { type: 'domain', description: 'Analyze data' } }],
    dependencies: {
      'design-system': { '@mui/material': '^5.15.0' },
      mfes: {},
    },
  };
  const basePath = path.join(__dirname, 'output-react-regress');

  beforeAll(async () => {
    await fs.remove(basePath);
  });

  afterAll(async () => {
    await fs.remove(basePath);
  });

  it('still emits rspack.config.js and React entry files', async () => {
    const files = await generateAllFiles(reactManifest as any, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(path.join(basePath, 'rspack.config.js'));
    expect(paths).toContain(path.join(basePath, 'src', 'App.tsx'));
    expect(paths).toContain(path.join(basePath, 'src', 'index.tsx'));
    expect(paths).toContain(
      path.join(basePath, 'src', 'features', 'DataAnalysis', 'DataAnalysis.tsx')
    );
    expect(paths).not.toContain(path.join(basePath, 'webpack.config.js'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'main.ts'));
  });
});

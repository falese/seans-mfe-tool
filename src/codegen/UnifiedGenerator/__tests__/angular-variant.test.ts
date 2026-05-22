import { generateAllFiles } from '../unified-generator';
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
    expect(webpackConfig!.content).toContain("require('webpack').container");
    expect(webpackConfig!.content).toContain('ModuleFederationPlugin');
    expect(webpackConfig!.content).toContain("'@angular/core':");
    expect(webpackConfig!.content).toContain('strictVersion: true');
    // runtimeChunk:false is mandatory for Module Federation
    expect(webpackConfig!.content).toContain('runtimeChunk: false');
    // CORS headers so a cross-origin shell can fetch remoteEntry.js
    expect(webpackConfig!.content).toContain('Access-Control-Allow-Origin');
    // No react in shared scope
    expect(webpackConfig!.content).not.toContain("'react':");
  });

  it('renders package.json with Angular CLI builder deps (and no react/rspack/ngtools)', async () => {
    const files = await generateAllFiles(baseManifest as any, basePath, { force: true });
    const pkg = files.find((f) => f.path === path.join(basePath, 'package.json'));

    expect(pkg).toBeDefined();
    expect(pkg!.content).toContain('"@angular/core"');
    expect(pkg!.content).toContain('"@angular-builders/custom-webpack"');
    expect(pkg!.content).toContain('"@angular-devkit/build-angular"');
    expect(pkg!.content).toContain('"webpack"');
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

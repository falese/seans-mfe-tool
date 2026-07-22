import { generateAllFiles, extractManifestVars, DEPENDENCY_VERSIONS } from '../unified-generator';
import type { DSLManifest } from '@seans-mfe/dsl';
import * as fs from 'fs-extra';
import path from 'path';

describe('unified-generator angular-webpack variant', () => {
  const baseManifest: DSLManifest = {
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
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(path.join(basePath, 'angular.json'));
    expect(paths).toContain(path.join(basePath, 'webpack.config.js'));
    expect(paths).toContain(path.join(basePath, 'tsconfig.json'));
    expect(paths).toContain(path.join(basePath, 'tsconfig.app.json'));
    expect(paths).not.toContain(path.join(basePath, 'rspack.config.js'));
  });

  it('single-sources federation shared + runtime versions from DEPENDENCY_VERSIONS (#293)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const webpack = files.find((f) => f.path === path.join(basePath, 'webpack.config.js'));
    const pkg = files.find((f) => f.path === path.join(basePath, 'package.json'));

    expect(webpack).toBeDefined();
    expect(webpack!.content).toContain(`requiredVersion: '${DEPENDENCY_VERSIONS.angular.core}'`);
    expect(webpack!.content).toContain(`requiredVersion: '${DEPENDENCY_VERSIONS.angular.rxjs}'`);
    expect(webpack!.content).toContain(`requiredVersion: '${DEPENDENCY_VERSIONS.angular.platformBrowser}'`);

    expect(pkg).toBeDefined();
    expect(JSON.parse(pkg!.content).devDependencies['@seans-mfe-tool/runtime']).toBe(
      DEPENDENCY_VERSIONS.runtime.package,
    );
  });

  it('emits an Angular-aware tsconfig.json (not the BFF/React one)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const tsconfig = files.find((f) => f.path === path.join(basePath, 'tsconfig.json'));
    expect(tsconfig).toBeDefined();
    expect(tsconfig!.content).toContain('experimentalDecorators');
    expect(tsconfig!.content).toContain('angularCompilerOptions');
    expect(tsconfig!.content).not.toContain('react-jsx');
  });

  // #273: GraphQL Mesh derives its artifact module system from the ROOT tsconfig.
  // ESM there makes .mesh/index.js use import.meta.url, which the CommonJS BFF
  // server.js cannot require(). Root must be commonjs; the Angular app build
  // gets ES modules from tsconfig.app.json instead.
  it('emits a commonjs root tsconfig (for the Mesh BFF) and an ES2022 app tsconfig', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const root = files.find((f) => f.path === path.join(basePath, 'tsconfig.json'));
    const app = files.find((f) => f.path === path.join(basePath, 'tsconfig.app.json'));
    expect(root).toBeDefined();
    expect(app).toBeDefined();
    expect(root!.content).toMatch(/"module"\s*:\s*"commonjs"/);
    expect(root!.content).not.toMatch(/"module"\s*:\s*"ES2022"/);
    expect(app!.content).toMatch(/"module"\s*:\s*"ES2022"/);
  });

  // ADR-067: an Angular MFE that declares providesSlots gets the slot sugar as
  // src/slots.ts (a DeclaredSlotDirective with the contract pre-bound), never the
  // React src/slots.tsx.
  it('emits src/slots.ts (not slots.tsx) with the pre-bound DeclaredSlotDirective when providesSlots present', async () => {
    const withSlots: DSLManifest = {
      ...baseManifest,
      providesSlots: [
        { id: 'main', description: 'Primary region' },
        { id: 'info', description: 'Info region' },
      ],
    };
    const { files } = await generateAllFiles(withSlots, basePath, { force: true });
    const paths = files.map((f) => f.path);
    expect(paths).toContain(path.join(basePath, 'src', 'slots.ts'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'slots.tsx'));

    const slots = files.find((f) => f.path === path.join(basePath, 'src', 'slots.ts'));
    expect(slots).toBeDefined();
    expect(slots!.content).toContain('createSlotContract');
    expect(slots!.content).toContain('DeclaredSlotDirective');
    expect(slots!.content).toContain('@angular/core');
    // The manifest's providesSlots are mirrored into the data layer.
    expect(slots!.content).toContain('"main"');
    expect(slots!.content).toContain('"info"');
  });

  it('emits Angular entry files instead of App.tsx / index.tsx', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(path.join(basePath, 'src', 'main.ts'));
    expect(paths).toContain(path.join(basePath, 'src', 'bootstrap.ts'));
    expect(paths).toContain(path.join(basePath, 'src', 'app', 'app.component.ts'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'App.tsx'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'index.tsx'));
  });

  it('configures angular.json with the custom-webpack builder pointing at the MF partial', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const angularJson = files.find((f) => f.path === path.join(basePath, 'angular.json'));

    expect(angularJson).toBeDefined();
    expect(angularJson!.content).toContain('@angular-builders/custom-webpack:browser');
    expect(angularJson!.content).toContain('@angular-builders/custom-webpack:dev-server');
    expect(angularJson!.content).toContain('./webpack.config.js');
    expect(angularJson!.content).toContain('"zone.js"');
  });

  it('emits feature components as .component.ts (Angular convention)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
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
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const paths = files.map((f) => f.path);

    expect(paths).toContain(path.join(basePath, 'src', 'remote.ts'));
    expect(paths).not.toContain(path.join(basePath, 'src', 'remote.tsx'));
  });

  it('renders webpack.config.js as an MF partial with Angular singletons in shared scope', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
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

  // #272: the MF expose key is standardized on './App' across frameworks (React
  // exposes './App' too), so hosts register any MFE without per-framework casing.
  it('exposes the remote under ./App (not ./Component) for cross-framework parity (#272)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const webpackConfig = files.find((f) => f.path.endsWith('webpack.config.js'));

    expect(webpackConfig).toBeDefined();
    expect(webpackConfig!.content).toContain("'./App': './src/remote.ts'");
    expect(webpackConfig!.content).not.toContain("'./Component'");
  });

  it('renders package.json with Angular CLI builder deps (and no react/rspack/ngtools)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const pkg = files.find((f) => f.path === path.join(basePath, 'package.json'));

    expect(pkg).toBeDefined();
    expect(pkg!.content).toContain('"@angular/core"');
    expect(pkg!.content).toContain('"@angular/platform-browser"');
    // platform-browser-dynamic is not used at runtime (bootstrapApplication from
    // platform-browser is), but jest-preset-angular's TestBed requires
    // @angular/platform-browser-dynamic/testing — so it lives in devDependencies.
    expect(pkg!.content).toContain('"@angular/platform-browser-dynamic"');
    expect(pkg!.content).toContain('"@angular-builders/custom-webpack"');
    expect(pkg!.content).toContain('"@angular-devkit/build-angular"');
    expect(pkg!.content).toContain('"@angular-architects/module-federation"');
    expect(pkg!.content).not.toContain('"webpack"');
    expect(pkg!.content).not.toContain('"@ngtools/webpack"');
    expect(pkg!.content).not.toContain('"react":');
    expect(pkg!.content).not.toContain('"@rspack/core"');
  });

  // #271: an Angular MFE with no data: section must not emit a Mesh BFF — the
  // React template already gates this behind hasBff; the Angular template used to
  // emit build:server / bff:dev / mesh deps unconditionally, so `tsc server.ts`
  // (build:server) failed on a missing ./.mesh for every no-data Angular MFE.
  it('omits BFF scripts and mesh deps when the manifest has no data: section (#271)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const pkg = files.find((f) => f.path === path.join(basePath, 'package.json'));

    expect(pkg).toBeDefined();
    expect(pkg!.content).not.toContain('"build:server"');
    expect(pkg!.content).not.toContain('"bff:dev"');
    expect(pkg!.content).not.toContain('"prebff:dev"');
    expect(pkg!.content).not.toContain('"mesh:validate"');
    expect(pkg!.content).not.toContain('@graphql-mesh/cli');
    expect(pkg!.content).not.toContain('@graphql-mesh/openapi');
    expect(pkg!.content).not.toContain('"express"');
    // Angular framework deps are always present regardless of BFF.
    expect(pkg!.content).toContain('"@angular/core"');
  });

  // #271: with a data: section the Angular BFF scripts + mesh deps come back.
  it('emits BFF scripts and mesh deps when the manifest has a data: section (#271)', async () => {
    const withData: DSLManifest = {
      ...baseManifest,
      data: {
        sources: [{ name: 'TestAPI', handler: { openapi: { source: './test.yaml' } } }],
        serve: { endpoint: '/graphql', playground: true },
      },
    } as DSLManifest;
    const { files } = await generateAllFiles(withData, basePath, { force: true });
    const pkg = files.find((f) => f.path === path.join(basePath, 'package.json'));

    expect(pkg).toBeDefined();
    // mesh CLI is a build tool — must be in devDependencies
    expect(pkg!.content).toContain('"@graphql-mesh/cli"');
    expect(pkg!.content).not.toContain('"dependencies":\n    "@graphql-mesh/cli"');
    // prebff:dev builds the GraphQL Mesh artifacts so `npm run dev` works cold
    // (server.ts imports ./.mesh, which only exists after `mesh build`).
    expect(pkg!.content).toContain('"prebff:dev"');
    expect(pkg!.content).toContain('"bff:dev"');
    expect(pkg!.content).toContain('"build:server"');
    expect(pkg!.content).toContain('"express"');
    expect(pkg!.content).toContain('"@angular/core"');
  });

  // #274: the Angular variant also emits a .gitignore keeping build artifacts
  // (.angular/, out-tsc/, .mesh/, compiled server.js) out of the tree.
  it('emits a .gitignore that ignores Angular + BFF build artifacts (#274)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const gitignore = files.find((f) => f.path === path.join(basePath, '.gitignore'));
    expect(gitignore).toBeDefined();
    expect(gitignore!.content).toContain('.mesh/');
    expect(gitignore!.content).toContain('out-tsc/');
    expect(gitignore!.content).toContain('.angular/');
    expect(gitignore!.content).toContain('/server.js');
    expect(gitignore!.content).not.toMatch(/^\*\.js\s*$/m);
  });

  it('generates mfe.ts that extends AngularRemoteMFE (not RemoteMFE)', async () => {
    const { files } = await generateAllFiles(baseManifest, basePath, { force: true });
    const mfeFile = files.find((f) =>
      f.path === path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts')
    );

    expect(mfeFile).toBeDefined();
    expect(mfeFile!.content).toContain('extends AngularRemoteMFE');
    expect(mfeFile!.content).toContain('AngularRemoteMFE');
    expect(mfeFile!.content).not.toContain('extends RemoteMFE {');
  });
});

describe('extractManifestVars — plugin-driven variant selection (ADR-036, #176)', () => {
  it('react manifest → react-rspack plugin fields', () => {
    const manifest: DSLManifest = {
      name: 'ReactMFE', version: '1.0.0', type: 'remote', language: 'typescript',
      description: '', endpoint: 'http://localhost:3001',
      framework: 'react', bundler: 'rspack', capabilities: [],
    };
    const vars = extractManifestVars(manifest);
    expect(vars.framework).toBe('react');
    expect(vars.bundler).toBe('rspack');
    expect(vars.templateVariant).toBe('react-rspack');
  });

  it('angular manifest → angular-webpack plugin fields', () => {
    const manifest: DSLManifest = {
      name: 'NgMFE', version: '1.0.0', type: 'remote', language: 'typescript',
      description: '', endpoint: 'http://localhost:3101',
      framework: 'angular', bundler: 'webpack', capabilities: [],
    };
    const vars = extractManifestVars(manifest);
    expect(vars.framework).toBe('angular');
    expect(vars.bundler).toBe('webpack');
    expect(vars.templateVariant).toBe('angular-webpack');
  });

  it('bundler:webpack alone (no framework field) → angular-webpack (backward compat)', () => {
    const manifest: DSLManifest = {
      name: 'BundlerOnly', version: '1.0.0', type: 'remote', language: 'typescript',
      description: '', endpoint: 'http://localhost:3101',
      bundler: 'webpack', capabilities: [],
    };
    const vars = extractManifestVars(manifest);
    expect(vars.framework).toBe('angular');
    expect(vars.bundler).toBe('webpack');
    expect(vars.templateVariant).toBe('angular-webpack');
  });
});

describe('unified-generator react-rspack regression (no framework/bundler set)', () => {
  // Guard: a manifest without framework/bundler must produce the same output
  // as before so existing MFEs in the wild keep generating identically.
  const reactManifest: DSLManifest = {
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
    const { files } = await generateAllFiles(reactManifest, basePath, { force: true });
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

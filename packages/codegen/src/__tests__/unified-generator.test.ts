import { generateAllFiles, writeGeneratedFiles, DEPENDENCY_VERSIONS } from '../unified-generator';
import * as fs from 'fs-extra';
import path from 'path';

describe('unified-generator', () => {
  const manifest = {
    name: 'TestMFE',
    version: '1.0.0',
    description: 'Test manifest',
    endpoint: 'http://localhost:3001',
    capabilities: [
      {
        DataAnalysis: { type: 'domain', description: 'Analyze data' }
      },
      {
        Health: { type: 'platform', description: 'Health check' }
      }
    ],
    dependencies: {
      'design-system': { '@mui/material': '^5.15.0' },
      mfes: {}
    },
    data: { sources: [{ name: 'TestAPI', handler: { openapi: { source: './test.yaml' } } }] }
  };
  const basePath = path.join(__dirname, 'output');

  beforeAll(async () => {
    await fs.remove(basePath);
  });

  afterAll(async () => {
    await fs.remove(basePath);
  });

  it('generates all expected files', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    expect(files.length).toBeGreaterThan(0);
    // Check for key files
    const filePaths = files.map(f => f.path);
    expect(filePaths).toContain(path.join(basePath, 'package.json'));
    expect(filePaths).toContain(path.join(basePath, 'rspack.config.js'));
    expect(filePaths).toContain(path.join(basePath, 'src', 'features', 'DataAnalysis', 'DataAnalysis.tsx'));
    expect(filePaths).toContain(path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'));
    expect(filePaths).toContain(path.join(basePath, '.meshrc.yaml'));
  });

  it('generates src/index.tsx with React bootstrap', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    expect(indexTsx?.content).toContain('import { createRoot } from \'react-dom/client\'');
    expect(indexTsx?.content).toContain('const container = document.getElementById(\'root\')');
    expect(indexTsx?.content).toContain('root.render(');
    expect(indexTsx?.content).toContain('StandaloneApp');
    expect(indexTsx?.content).toContain('REQ-RUNTIME-002: Context integration');
  });

  it('generates src/index.tsx with capability imports', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    // Only domain capabilities should be imported (not platform capabilities like Health)
    expect(indexTsx?.content).toContain('import { DataAnalysis } from \'./features/DataAnalysis/DataAnalysis\'');
    expect(indexTsx?.content).not.toContain('import { Health }'); // Health is platform, not domain
    expect(indexTsx?.content).toContain('<DataAnalysis />');
  });

  it('generates src/index.tsx with Material-UI tabbed interface', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    expect(indexTsx?.content).toContain('import { Tabs, Tab, Box, Container, Typography } from \'@mui/material\'');
    expect(indexTsx?.content).toContain('interface TabPanelProps');
    expect(indexTsx?.content).toContain('function TabPanel');
    expect(indexTsx?.content).toContain('Module Federation MFE - Standalone Mode');
  });

  it('generates public/demo.html for runtime demonstration', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const demoHtml = files.find(f => f.path === path.join(basePath, 'public', 'demo.html'));
    
    expect(demoHtml).toBeDefined();
    expect(demoHtml?.content).toContain('RemoteMFE Runtime Demo');
    expect(demoHtml?.content).toContain('REQ-RUNTIME-001: Load capability demonstration');
    expect(demoHtml?.content).toContain('REQ-RUNTIME-004: Render capability demonstration');
    expect(demoHtml?.content).toContain('REQ-RUNTIME-008');
    expect(demoHtml?.content).toContain('window.testLoad');
    expect(demoHtml?.content).toContain('window.testRender');
  });

  it('generates public/demo.html with MFE name in title', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const demoHtml = files.find(f => f.path === path.join(basePath, 'public', 'demo.html'));
    
    expect(demoHtml).toBeDefined();
    expect(demoHtml?.content).toContain('TestMFE MFE - Runtime Demo');
    expect(demoHtml?.content).toContain('the TestMFE MFE via Module Federation');
  });

  it('calculates BFF port as MFE port + 1000', async () => {
    const manifestWithPort = {
      ...manifest,
      endpoint: 'http://localhost:3002'
    };
    
    const { files } = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
    const serverTs = files.find(f => f.path === path.join(basePath, 'server.ts'));
    
    expect(serverTs).toBeDefined();
    // BFF should be on port 4002 (3002 + 1000)
    expect(serverTs?.content).toContain('const port = process.env.PORT || 4002');
    expect(serverTs?.content).toContain('MFE assets served by rspack dev server on port 3002');
  });

  it('calculates BFF port correctly for different MFE ports', async () => {
    const manifestWithPort = {
      ...manifest,
      endpoint: 'http://localhost:3005'
    };
    
    const { files } = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
    const serverTs = files.find(f => f.path === path.join(basePath, 'server.ts'));
    
    expect(serverTs).toBeDefined();
    // BFF should be on port 4005 (3005 + 1000)
    expect(serverTs?.content).toContain('const port = process.env.PORT || 4005');
    expect(serverTs?.content).toContain('MFE assets served by rspack dev server on port 3005');
  });

  it('generates rspack.config.js with named entry point', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const rspackConfig = files.find(f => f.path === path.join(basePath, 'rspack.config.js'));
    
    expect(rspackConfig).toBeDefined();
    expect(rspackConfig?.content).toContain('entry: {');
    expect(rspackConfig?.content).toContain('main: \'./src/index.tsx\'');
    expect(rspackConfig?.content).not.toContain('entry: \'./src/remote.tsx\'');
  });

  it('generates rspack.config.js with eager MUI dependencies', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const rspackConfig = files.find(f => f.path === path.join(basePath, 'rspack.config.js'));
    
    expect(rspackConfig).toBeDefined();
    // All MUI packages should have eager: true
    expect(rspackConfig?.content).toMatch(/@mui\/material['"]:\s*\{[^}]*eager:\s*true/);
    expect(rspackConfig?.content).toMatch(/@mui\/system['"]:\s*\{[^}]*eager:\s*true/);
    expect(rspackConfig?.content).toMatch(/@emotion\/react['"]:\s*\{[^}]*eager:\s*true/);
    expect(rspackConfig?.content).toMatch(/@emotion\/styled['"]:\s*\{[^}]*eager:\s*true/);
  });

  it('single-sources the module-federation shared versions from DEPENDENCY_VERSIONS', async () => {
    // Divergence prevention (#293): the federation `shared` requiredVersions must
    // come from the one platform-defaults source, not scattered literals — so a
    // bump to DEPENDENCY_VERSIONS can never leave the shared block behind.
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const rspackConfig = files.find(f => f.path === path.join(basePath, 'rspack.config.js'));

    expect(rspackConfig).toBeDefined();
    expect(rspackConfig?.content).toContain(`requiredVersion: '${DEPENDENCY_VERSIONS.react.react}'`);
    expect(rspackConfig?.content).toContain(`requiredVersion: '${DEPENDENCY_VERSIONS.react.reactDom}'`);
    expect(rspackConfig?.content).toContain(`requiredVersion: '${DEPENDENCY_VERSIONS.mui.emotionReact}'`);
    expect(rspackConfig?.content).toContain(`requiredVersion: '${DEPENDENCY_VERSIONS.mui.emotionStyled}'`);
    // No hardcoded framework version literals should remain in the shared block.
    expect(rspackConfig?.content).not.toContain("requiredVersion: '^18.2.0'");
  });

  it('single-sources the @seans-mfe-tool/runtime dependency spec', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const pkg = files.find(f => f.path === path.join(basePath, 'package.json'));

    expect(pkg).toBeDefined();
    expect(JSON.parse(pkg!.content).devDependencies['@seans-mfe-tool/runtime']).toBe(
      DEPENDENCY_VERSIONS.runtime.package,
    );
  });

  describe('manifest-driven client dependencies + federation shared (#294)', () => {
    it('emits declared runtime deps into package.json but NOT into shared', async () => {
      const withRuntime = {
        ...manifest,
        dependencies: {
          runtime: { react: '^18.0.0', 'react-dom': '^18.0.0', '@babylonjs/core': '^9.17.0' },
          'design-system': { 'styled-components': '^6.1.0' },
        },
      };
      const { files } = await generateAllFiles(withRuntime as any, basePath, { force: true });
      const pkg = JSON.parse(
        files.find((f) => f.path === path.join(basePath, 'package.json'))!.content,
      );
      const rspack = files.find((f) => f.path === path.join(basePath, 'rspack.config.js'))!.content;

      // Declared library lands in package.json...
      expect(pkg.dependencies['@babylonjs/core']).toBe('^9.17.0');
      // ...framework versions still come from platform defaults (#293), not the manifest.
      expect(pkg.dependencies.react).toBe(DEPENDENCY_VERSIONS.react.react);
      // ...but a heavy runtime lib is NOT force-shared as a singleton.
      expect(rspack).not.toContain('@babylonjs/core');
    });

    it('lets a non-MUI design-system replace MUI in deps and shared', async () => {
      const styled = {
        ...manifest,
        dependencies: { 'design-system': { 'styled-components': '^6.1.0' }, mfes: {} },
      };
      const { files } = await generateAllFiles(styled as any, basePath, { force: true });
      const pkg = JSON.parse(
        files.find((f) => f.path === path.join(basePath, 'package.json'))!.content,
      );
      const rspack = files.find((f) => f.path === path.join(basePath, 'rspack.config.js'))!.content;

      expect(pkg.dependencies['styled-components']).toBe('^6.1.0');
      expect(pkg.dependencies['@mui/material']).toBeUndefined();
      expect(rspack).toContain("'styled-components'");
      expect(rspack).not.toContain('@mui/material');
    });

    it('keeps MUI (with emotion peers) as the default when no design-system is declared', async () => {
      const { 'design-system': _omit, ...deps } = manifest.dependencies as any;
      const { files } = await generateAllFiles(
        { ...manifest, dependencies: deps } as any,
        basePath,
        { force: true },
      );
      const pkg = JSON.parse(
        files.find((f) => f.path === path.join(basePath, 'package.json'))!.content,
      );
      expect(pkg.dependencies['@mui/material']).toBe(DEPENDENCY_VERSIONS.mui.material);
      expect(pkg.dependencies['@emotion/react']).toBe(DEPENDENCY_VERSIONS.mui.emotionReact);
    });
  });

  it('generates rspack.config.js with static demo configuration', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const rspackConfig = files.find(f => f.path === path.join(basePath, 'rspack.config.js'));
    
    expect(rspackConfig).toBeDefined();
    expect(rspackConfig?.content).toContain('static: {');
    expect(rspackConfig?.content).toContain('directory: path.join(__dirname, \'public\')');
    expect(rspackConfig?.content).toContain('publicPath: \'/static\'');
  });

  it('generates public/index.html without manual script tags', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexHtml = files.find(f => f.path === path.join(basePath, 'public', 'index.html'));
    
    expect(indexHtml).toBeDefined();
    expect(indexHtml?.content).toContain('<div id="root"></div>');
    expect(indexHtml?.content).toContain('HtmlRspackPlugin injects scripts automatically');
    expect(indexHtml?.content).not.toContain('<script src="/main.js"></script>');
  });

  it('generates Dockerfile with correct BFF port', async () => {
    const manifestWithPort = {
      ...manifest,
      endpoint: 'http://localhost:3002'
    };

    const { files } = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
    const dockerfile = files.find(f => f.path === path.join(basePath, 'Dockerfile'));

    expect(dockerfile).toBeDefined();
    // BFF port should be 4002 (3002 + 1000)
    expect(dockerfile?.content).toContain('EXPOSE 4002');
    expect(dockerfile?.content).toContain("process.env.PORT || 4002");
  });

  it('Dockerfile always includes .mesh artifact copy — no hasData conditional (#189)', async () => {
    // Dockerfile is only emitted when manifest.data exists (fixed in #149).
    // Within that block hasData is always true, so the template must not
    // use a conditional — the .mesh COPY step should always be present.
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const dockerfile = files.find((f) => f.path === path.join(basePath, 'Dockerfile'));
    expect(dockerfile).toBeDefined();
    expect(dockerfile!.content).toContain('COPY --from=builder /app/.mesh ./.mesh');
  });

  it('generates docker-compose.yaml with correct BFF port', async () => {
    const manifestWithPort = {
      ...manifest,
      endpoint: 'http://localhost:3002'
    };
    
    const { files } = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
    const dockerCompose = files.find(f => f.path === path.join(basePath, 'docker-compose.yaml'));
    
    expect(dockerCompose).toBeDefined();
    // BFF port should be 4002 (3002 + 1000)
    expect(dockerCompose?.content).toContain('"4002:4002"');
    expect(dockerCompose?.content).toContain('PORT=4002');
    expect(dockerCompose?.content).toContain('http://localhost:4002/health');
  });

  it('writes files to disk', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const result = await writeGeneratedFiles(files, { force: true });
    expect(result.files.length).toBe(files.length);
    // Check that files exist
    for (const file of files) {
      expect(await fs.pathExists(file.path)).toBe(true);
    }
  });

  it('handles empty/malformed capability entries gracefully', async () => {
    const manifestWithEmptyEntries = {
      ...manifest,
      capabilities: [
        { DataAnalysis: { type: 'domain', description: 'Valid capability' } },
        {},    // Empty entry (should be skipped)
        { '': { type: 'domain' } },  // Empty name (should be skipped)
        { Health: { type: 'platform' } },  // Platform (should be filtered)
      ]
    };
    
    const { files } = await generateAllFiles(manifestWithEmptyEntries as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    // Should only import DataAnalysis (the one valid domain capability)
    expect(indexTsx?.content).toContain('import { DataAnalysis }');
    expect(indexTsx?.content).not.toContain('import {  }'); // No empty imports
    expect(indexTsx?.content).not.toContain('from \'./features//\''); // No empty paths
    
    // Verify only one domain capability was processed and platform was filtered.
    // DataAnalysis already exists (from the previous test run against the same
    // basePath), so capabilityImplemented returns true and preserves it — it
    // won't appear in `files` but IS represented in the remote entrypoint and
    // index imports (domainCapabilities drove those).
    const healthFeature = files.find(f => f.path.includes('features/Health'));
    expect(healthFeature).toBeUndefined(); // Platform capability must not generate feature
    // DataAnalysis is either preserved (file exists) or newly emitted — either
    // way it must appear in the generated index.tsx import list.
    expect(indexTsx?.content).toContain('DataAnalysis');
  });

  it('filters out empty data sources from manifest', async () => {
    const manifestWithEmptySources = {
      ...manifest,
      data: {
        sources: [
          { name: 'ValidAPI', handler: { openapi: { source: './valid.yaml' } } },
          {},    // Empty source (should be skipped)
          { name: '', handler: { openapi: { source: './empty-name.yaml' } } },  // Empty name (should be skipped)
          { name: 'NoHandler' },  // Missing handler (should be skipped)
        ]
      }
    };
    
    const { files } = await generateAllFiles(manifestWithEmptySources as any, basePath, { force: true });
    const meshrc = files.find(f => f.path === path.join(basePath, '.meshrc.yaml'));
    
    expect(meshrc).toBeDefined();
    // Should only include ValidAPI
    expect(meshrc?.content).toContain('ValidAPI');
    expect(meshrc?.content).not.toContain('NoHandler');
    // Verify sources array has exactly 1 valid entry
    expect((meshrc?.content.match(/name:/g) || []).length).toBe(1);
  });

  it('generates server.ts with correct Mesh handler integration', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const serverTs = files.find(f => f.path === path.join(basePath, 'server.ts'));
    
    expect(serverTs).toBeDefined();
    
    // Verify Mesh imports
    expect(serverTs?.content).toContain('import { createBuiltMeshHTTPHandler } from \'./.mesh\';');
    
    // Verify MeshContext interface (documents injected fields for resolvers/operationHeaders)
    expect(serverTs?.content).toContain('interface MeshContext {');
    expect(serverTs?.content).toContain('jwt?: string;');
    expect(serverTs?.content).toContain('requestId: string;');
    expect(serverTs?.content).toContain('userId?: string;');
    
    // Verify handler instantiation — ADR-027: zero-arg call; context injected via
    // mesh-context.js Envelop plugin (additionalEnvelopPlugins in .meshrc.yaml)
    expect(serverTs?.content).toContain('const meshHandler = createBuiltMeshHTTPHandler();');

    // Verify direct middleware registration (no wrapper function needed)
    expect(serverTs?.content).toContain('app.use(\'/graphql\', meshHandler);');

    // Verify OLD broken patterns are NOT present
    expect(serverTs?.content).not.toContain('next: NextFunction');
    expect(serverTs?.content).not.toContain('(req as any).meshContext');
    expect(serverTs?.content).not.toContain('next();');
    expect(serverTs?.content).not.toContain('requestWithContext as any, res as any, context');
    expect(serverTs?.content).not.toContain('createBuiltMeshHTTPHandler<MeshContext>({');
    expect(serverTs?.content).not.toContain('context: (req: Request) => ({');
    
    // extractUserIdFromToken lives in mesh-context.js, not server.ts
    expect(serverTs?.content).not.toContain('function extractUserIdFromToken(');
  });

  it('generates mesh-context.js with Envelop plugin for context injection', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const meshContextJs = files.find(f => f.path === path.join(basePath, 'src', 'platform', 'bff', 'mesh-context.js'));

    expect(meshContextJs).toBeDefined();
    expect(meshContextJs!.overwrite).toBe(true);

    // Verify plugin shape
    expect(meshContextJs?.content).toContain('onContextBuilding');
    expect(meshContextJs?.content).toContain('extendContext');
    expect(meshContextJs?.content).toContain('context.request');

    // Verify all four fields are injected
    expect(meshContextJs?.content).toContain('jwt:');
    expect(meshContextJs?.content).toContain('requestId:');
    expect(meshContextJs?.content).toContain('userId:');
    expect(meshContextJs?.content).toContain('headers,');

    // Verify helper function lives here
    expect(meshContextJs?.content).toContain('function extractUserIdFromToken(');
    expect(meshContextJs?.content).toContain('Buffer.from(token.split(\'.\')[1], \'base64\')');
  });

  it('wires additionalEnvelopPlugins in generated .meshrc.yaml', async () => {
    const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
    const meshrc = files.find(f => f.path === path.join(basePath, '.meshrc.yaml'));

    expect(meshrc).toBeDefined();
    expect(meshrc?.content).toContain('additionalEnvelopPlugins: ./src/platform/bff/mesh-context.js');
  });

  describe('BFF root files do not clobber MFE root templates', () => {
    it('emits exactly one package.json entry, from the MFE hybrid template (with MUI deps)', async () => {
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });

      const pkgEntries = files.filter(
        (f) => f.path === path.join(basePath, 'package.json'),
      );

      // Only ONE package.json should be emitted. Previously two were pushed
      // (BFF first with overwrite:true, MFE second with overwrite:false) and
      // BFF won, dropping MUI deps that `src/App.tsx` imports.
      expect(pkgEntries).toHaveLength(1);

      // The surviving entry must be the MFE hybrid template — assert by content
      // since the MFE template is the only one that emits MUI deps + the
      // generator build script.
      const pkg = pkgEntries[0]!;
      expect(pkg.content).toContain('"@mui/material"');
      expect(pkg.content).toContain('"@mui/system"');
      expect(pkg.content).toContain('"@emotion/react"');
      expect(pkg.content).toContain('"@emotion/styled"');
      expect(pkg.content).toContain('seans-mfe-tool remote:generate');
      expect(pkg.content).toContain('GraphQL BFF + MFE generated by seans-mfe-tool');

      // And the BFF template's narrower description must not have leaked through.
      expect(pkg.content).not.toMatch(/"description":\s*"GraphQL BFF generated by seans-mfe-tool/);
    });

    it('marks BFF-shipped user-facing root files as overwrite:false', async () => {
      // These files do not have an MFE-template equivalent, so the BFF template
      // is the source of truth — but they must NOT clobber prior generations
      // (matching the convention used by package.json + rspack.config.js).
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });

      for (const name of ['tsconfig.json', 'Dockerfile', 'docker-compose.yaml', 'README.md']) {
        const entry = files.find((f) => f.path === path.join(basePath, name));
        expect(entry).toBeDefined();
        expect(entry!.overwrite).toBe(false);
      }
    });

    it('README documents the unpublished-runtime staging workaround (DX punch list #7)', async () => {
      // Generated package.json pins @seans-mfe-tool/runtime, which is not on
      // npm yet (ADR-064) — a plain `npm install` 404s with no hint. Until the
      // runtime ships, the README must carry the staging workaround.
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
      const readme = files.find((f) => f.path === path.join(basePath, 'README.md'));
      expect(readme).toBeDefined();
      expect(readme!.content).toContain('@seans-mfe-tool/runtime` is not published yet');
      expect(readme!.content).toContain('dist/runtime node_modules/@seans-mfe-tool/runtime');
      // Must warn against file:/symlink staging — resolution escapes the project.
      expect(readme!.content).toMatch(/real directory/i);
    });

    it('keeps server.ts as overwrite:true so BFF runtime refresh stays automatic', async () => {
      // server.ts is generated BFF runtime, not user-customised — regeneration
      // must keep delivering the latest version.
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
      const serverTs = files.find((f) => f.path === path.join(basePath, 'server.ts'));
      expect(serverTs).toBeDefined();
      expect(serverTs!.overwrite).toBe(true);
    });
  });

  describe('BFF endpoint derivation (single deployable unit)', () => {
    it('bakes manifest.endpoint + data.serve.endpoint into the generated connector', async () => {
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
      const bff = files.find((f) => f.path.endsWith('src/platform/bff/bff.ts'));
      expect(bff).toBeDefined();
      // The MFE and its BFF ship as ONE deployable unit on the manifest's
      // endpoint origin; a relative '/graphql' would resolve against the
      // SHELL's origin once the MFE is composed remotely.
      expect(bff!.content).toContain("'http://localhost:3001/graphql'");
      expect(bff!.content).not.toContain("|| '/graphql'");
    });

    it('honors a custom data.serve.endpoint path against the manifest origin', async () => {
      const custom = {
        ...manifest,
        data: { ...(manifest as any).data, serve: { endpoint: '/api/graph' } },
      };
      const { files } = await generateAllFiles(custom as any, basePath, { force: true });
      const bff = files.find((f) => f.path.endsWith('src/platform/bff/bff.ts'));
      expect(bff!.content).toContain("'http://localhost:3001/api/graph'");
    });

    it('falls back to the relative serve path when the manifest has no endpoint', async () => {
      const { endpoint: _omitted, ...noEndpoint } = manifest as any;
      const { files } = await generateAllFiles(noEndpoint, basePath, { force: true });
      const bff = files.find((f) => f.path.endsWith('src/platform/bff/bff.ts'));
      expect(bff!.content).toContain("'/graphql'");
    });
  });

  describe('generated code is tsc-clean (DX punch list #17)', () => {
    it('bootstrap load() passes a complete Context (requestId + timestamp)', async () => {
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
      const bootstrap = files.find((f) => f.path.endsWith('base-mfe/bootstrap.ts'));
      expect(bootstrap).toBeDefined();
      // Context requires requestId and timestamp; a partial literal fails
      // `tsc --noEmit` in every generated project (swc builds masked it).
      expect(bootstrap!.content).toMatch(/requestId:\s*[`']bootstrap-load/);
      expect(bootstrap!.content).toContain('timestamp: new Date()');
    });

    it('remote entry imports are extensionless (no allowImportingTsExtensions)', async () => {
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
      const remote = files.find((f) => f.path.endsWith('src/remote.tsx'));
      expect(remote).toBeDefined();
      expect(remote!.content).not.toMatch(/from '\.[^']*\.tsx'/);
      // Explicit annotation: inference would name the staged runtime's
      // bundled contracts copy (TS2742, non-portable) under file: installs.
      expect(remote!.content).toContain('handles: { imperative: ImperativeMountHandle }');
    });
  });

  describe('generated Dockerfile stages the runtime as a real directory (#274)', () => {
    it('copies dist/runtime into node_modules instead of a file: dep', async () => {
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
      const dockerfile = files.find((f) => f.path.endsWith('Dockerfile'));
      expect(dockerfile).toBeDefined();
      // A file: dep resolves as a SYMLINK, so module resolution escapes the
      // project and Angular builds fail with "Can't resolve
      // '@angular/platform-browser' in dist/runtime". The proven pattern
      // (abc-kids' hand-patched Dockerfiles) copies a real directory.
      expect(dockerfile!.content).toContain(
        "cp -r /seans-mfe-tool/dist/runtime node_modules/@seans-mfe-tool/runtime"
      );
      expect(dockerfile!.content).not.toContain("file:/seans-mfe-tool/dist/runtime");
    });
  });

  describe('BFF files omitted when manifest has no data: section (#149)', () => {
    const noDataManifest = {
      name: 'NoDataMFE',
      version: '1.0.0',
      description: 'Manifest with no data section',
      endpoint: 'http://localhost:3001',
      capabilities: [{ Health: { type: 'platform', description: 'Health check' } }],
      dependencies: { 'design-system': { '@mui/material': '^5.15.0' }, mfes: {} },
      // no data: key
    };

    it('does not emit bff.ts when manifest has no data section', async () => {
      const { files } = await generateAllFiles(noDataManifest as any, basePath, { force: true });
      const bffTs = files.find((f) => f.path.includes('bff.ts') && !f.path.includes('bff.test'));
      expect(bffTs).toBeUndefined();
    });

    it('does not emit bff.test.ts when manifest has no data section', async () => {
      const { files } = await generateAllFiles(noDataManifest as any, basePath, { force: true });
      const bffTest = files.find((f) => f.path.includes('bff.test.ts'));
      expect(bffTest).toBeUndefined();
    });

    it('does not emit server.ts when manifest has no data section', async () => {
      const { files } = await generateAllFiles(noDataManifest as any, basePath, { force: true });
      const serverTs = files.find((f) => f.path === path.join(basePath, 'server.ts'));
      expect(serverTs).toBeUndefined();
    });

    it('does not emit .meshrc.yaml when manifest has no data section', async () => {
      const { files } = await generateAllFiles(noDataManifest as any, basePath, { force: true });
      const meshrc = files.find((f) => f.path.includes('.meshrc.yaml'));
      expect(meshrc).toBeUndefined();
    });

    it('emits tsconfig.json for a non-BFF React MFE', async () => {
      const { files } = await generateAllFiles(noDataManifest as any, basePath, { force: true });
      const tsconfig = files.find((f) => f.path === path.join(basePath, 'tsconfig.json'));
      expect(tsconfig).toBeDefined();
      expect(tsconfig!.content).toContain('"jsx": "react-jsx"');
      expect(tsconfig!.content).toContain('"DOM"');
      expect(tsconfig!.content).toContain('tsx');
      expect(tsconfig!.overwrite).toBe(false);
    });
  });

  describe('demo-mode mock switch — ADR-052', () => {
    const withMock = {
      ...manifest,
      data: {
        sources: [{ name: 'TestAPI', handler: { openapi: { source: './test.yaml' } } }],
        serve: { endpoint: '/graphql', playground: true },
        mockSwitch: { enabled: true },
      },
    };

    it('emits mock-switch.js (overwrite) and mocks.json (developer-owned) when enabled', async () => {
      const { files } = await generateAllFiles(withMock as any, basePath, { force: true });
      const composer = files.find((f) => f.path === path.join(basePath, 'src', 'platform', 'bff', 'mock-switch.js'));
      const fixtures = files.find((f) => f.path === path.join(basePath, 'src', 'platform', 'bff', 'mocks.json'));
      expect(composer).toBeDefined();
      expect(composer!.overwrite).toBe(true);
      expect(composer!.content).toContain('x-bff-mode');
      expect(composer!.content).toContain("process.env.DEMO_MODE === 'true'");
      expect(fixtures).toBeDefined();
      expect(fixtures!.overwrite).toBe(false); // never clobber developer fixtures
    });

    it('emits the resolversComposition transform over Query.* in .meshrc.yaml', async () => {
      const { files } = await generateAllFiles(withMock as any, basePath, { force: true });
      const meshrc = files.find((f) => f.path === path.join(basePath, '.meshrc.yaml'));
      expect(meshrc!.content).toContain('resolversComposition');
      expect(meshrc!.content).toContain("resolver: 'Query.*'");
      expect(meshrc!.content).toContain('./src/platform/bff/mock-switch#mockSwitch');
    });

    it('adds the resolvers-composition dependency to package.json', async () => {
      const { files } = await generateAllFiles(withMock as any, basePath, { force: true });
      const pkg = files.find((f) => f.path === path.join(basePath, 'package.json'));
      expect(pkg!.content).toContain('@graphql-mesh/transform-resolvers-composition');
    });

    it('emits nothing mock-related when mockSwitch is absent', async () => {
      const { files } = await generateAllFiles(manifest as any, basePath, { force: true });
      expect(files.find((f) => f.path.endsWith('mock-switch.js'))).toBeUndefined();
      expect(files.find((f) => f.path.endsWith('mocks.json'))).toBeUndefined();
      const meshrc = files.find((f) => f.path.endsWith('.meshrc.yaml'));
      expect(meshrc!.content).not.toContain('mock-switch');
    });
  });
});

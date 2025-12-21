import { generateAllFiles, writeGeneratedFiles } from '../unified-generator';
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
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    expect(files.length).toBeGreaterThan(0);
    // Check for key files
    const filePaths = files.map(f => f.path);
    expect(filePaths).toContain(path.join(basePath, 'package.json'));
    expect(filePaths).toContain(path.join(basePath, 'rspack.config.js'));
    expect(filePaths).toContain(path.join(basePath, 'src', 'features', 'DataAnalysis', 'DataAnalysis.tsx'));
    expect(filePaths).toContain(path.join(basePath, 'src', 'platform', 'base-mfe', 'mfe.ts'));
    expect(filePaths).toContain(path.join(basePath, 'mesh.config.ts'));
  });

  it('generates src/index.tsx with React bootstrap', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    expect(indexTsx?.content).toContain('import { createRoot } from \'react-dom/client\'');
    expect(indexTsx?.content).toContain('const container = document.getElementById(\'root\')');
    expect(indexTsx?.content).toContain('root.render(');
    expect(indexTsx?.content).toContain('StandaloneApp');
    expect(indexTsx?.content).toContain('REQ-RUNTIME-002: Context integration');
  });

  it('generates src/index.tsx with capability imports', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    // Only domain capabilities should be imported (not platform capabilities like Health)
    expect(indexTsx?.content).toContain('import { DataAnalysis } from \'./features/DataAnalysis/DataAnalysis\'');
    expect(indexTsx?.content).not.toContain('import { Health }'); // Health is platform, not domain
    expect(indexTsx?.content).toContain('<DataAnalysis />');
  });

  it('generates src/index.tsx with Material-UI tabbed interface', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    expect(indexTsx?.content).toContain('import { Tabs, Tab, Box, Container, Typography } from \'@mui/material\'');
    expect(indexTsx?.content).toContain('interface TabPanelProps');
    expect(indexTsx?.content).toContain('function TabPanel');
    expect(indexTsx?.content).toContain('Module Federation MFE - Standalone Mode');
  });

  it('generates public/demo.html for runtime demonstration', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
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
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
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
    
    const files = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
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
    
    const files = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
    const serverTs = files.find(f => f.path === path.join(basePath, 'server.ts'));
    
    expect(serverTs).toBeDefined();
    // BFF should be on port 4005 (3005 + 1000)
    expect(serverTs?.content).toContain('const port = process.env.PORT || 4005');
    expect(serverTs?.content).toContain('MFE assets served by rspack dev server on port 3005');
  });

  it('generates rspack.config.js with named entry point', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const rspackConfig = files.find(f => f.path === path.join(basePath, 'rspack.config.js'));
    
    expect(rspackConfig).toBeDefined();
    expect(rspackConfig?.content).toContain('entry: {');
    expect(rspackConfig?.content).toContain('main: \'./src/index.tsx\'');
    expect(rspackConfig?.content).not.toContain('entry: \'./src/remote.tsx\'');
  });

  it('generates rspack.config.js with eager MUI dependencies', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const rspackConfig = files.find(f => f.path === path.join(basePath, 'rspack.config.js'));
    
    expect(rspackConfig).toBeDefined();
    // All MUI packages should have eager: true
    expect(rspackConfig?.content).toMatch(/@mui\/material['"]:\s*\{[^}]*eager:\s*true/);
    expect(rspackConfig?.content).toMatch(/@mui\/system['"]:\s*\{[^}]*eager:\s*true/);
    expect(rspackConfig?.content).toMatch(/@emotion\/react['"]:\s*\{[^}]*eager:\s*true/);
    expect(rspackConfig?.content).toMatch(/@emotion\/styled['"]:\s*\{[^}]*eager:\s*true/);
  });

  it('generates rspack.config.js with static demo configuration', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const rspackConfig = files.find(f => f.path === path.join(basePath, 'rspack.config.js'));
    
    expect(rspackConfig).toBeDefined();
    expect(rspackConfig?.content).toContain('static: {');
    expect(rspackConfig?.content).toContain('directory: path.join(__dirname, \'public\')');
    expect(rspackConfig?.content).toContain('publicPath: \'/static\'');
  });

  it('generates public/index.html without manual script tags', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
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
    
    const files = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
    const dockerfile = files.find(f => f.path === path.join(basePath, 'Dockerfile'));
    
    expect(dockerfile).toBeDefined();
    // BFF port should be 4002 (3002 + 1000)
    expect(dockerfile?.content).toContain('EXPOSE 4002');
    expect(dockerfile?.content).toContain('http://localhost:4002/health');
  });

  it('generates docker-compose.yaml with correct BFF port', async () => {
    const manifestWithPort = {
      ...manifest,
      endpoint: 'http://localhost:3002'
    };
    
    const files = await generateAllFiles(manifestWithPort as any, basePath, { force: true });
    const dockerCompose = files.find(f => f.path === path.join(basePath, 'docker-compose.yaml'));
    
    expect(dockerCompose).toBeDefined();
    // BFF port should be 4002 (3002 + 1000)
    expect(dockerCompose?.content).toContain('"4002:4002"');
    expect(dockerCompose?.content).toContain('PORT=4002');
    expect(dockerCompose?.content).toContain('http://localhost:4002/health');
  });

  it('writes files to disk', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
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
    
    const files = await generateAllFiles(manifestWithEmptyEntries as any, basePath, { force: true });
    const indexTsx = files.find(f => f.path === path.join(basePath, 'src', 'index.tsx'));
    
    expect(indexTsx).toBeDefined();
    // Should only import DataAnalysis (the one valid domain capability)
    expect(indexTsx?.content).toContain('import { DataAnalysis }');
    expect(indexTsx?.content).not.toContain('import {  }'); // No empty imports
    expect(indexTsx?.content).not.toContain('from \'./features//\''); // No empty paths
    
    // Verify only one domain capability was processed
    const dataAnalysisFeature = files.find(f => f.path.includes('features/DataAnalysis/DataAnalysis.tsx'));
    const healthFeature = files.find(f => f.path.includes('features/Health'));
    expect(dataAnalysisFeature).toBeDefined();
    expect(healthFeature).toBeUndefined(); // Platform capability should not generate feature
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
    
    const files = await generateAllFiles(manifestWithEmptySources as any, basePath, { force: true });
    const meshConfig = files.find(f => f.path === path.join(basePath, 'mesh.config.ts'));
    
    expect(meshConfig).toBeDefined();
    // Should only include ValidAPI
    expect(meshConfig?.content).toContain('ValidAPI');
    expect(meshConfig?.content).not.toContain('NoHandler');
    // Verify sources array has exactly 1 valid entry
    expect((meshConfig?.content.match(/name: 'ValidAPI'/g) || []).length).toBe(1);
  });

  it('generates server.ts with correct Mesh handler integration', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const serverTs = files.find(f => f.path === path.join(basePath, 'server.ts'));
    
    expect(serverTs).toBeDefined();
    
    // Verify Mesh imports
    expect(serverTs?.content).toContain('import { createBuiltMeshHTTPHandler } from \'./.mesh\';');
    
    // Verify MeshContext interface
    expect(serverTs?.content).toContain('interface MeshContext {');
    expect(serverTs?.content).toContain('jwt?: string;');
    expect(serverTs?.content).toContain('requestId: string;');
    expect(serverTs?.content).toContain('userId?: string;');
    
    // Verify handler instantiation
    expect(serverTs?.content).toContain('const meshHandler = createBuiltMeshHTTPHandler<MeshContext>();');
    
    // Verify context injection pattern (NOT the old middleware pattern)
    expect(serverTs?.content).toContain('app.use(\'/graphql\', (req: Request, res: Response) => {');
    expect(serverTs?.content).toContain('const context: MeshContext = {');
    expect(serverTs?.content).toContain('const requestWithContext = Object.assign(req, { context });');
    expect(serverTs?.content).toContain('return meshHandler(requestWithContext as any, res as any, context);');
    
    // Verify OLD broken pattern is NOT present
    expect(serverTs?.content).not.toContain('next: NextFunction');
    expect(serverTs?.content).not.toContain('(req as any).meshContext');
    expect(serverTs?.content).not.toContain('next();');
    
    // Verify JWT extraction helper
    expect(serverTs?.content).toContain('function extractUserIdFromToken(authHeader?: string): string | undefined');
    expect(serverTs?.content).toContain('Buffer.from(token.split(\'.\')[1], \'base64\')');
  });
});

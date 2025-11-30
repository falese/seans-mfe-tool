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
        DataAnalysis: { type: 'domain', description: 'Analyze data' },
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
    expect(filePaths).toContain(path.join(basePath, '.meshrc.yaml'));
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
});

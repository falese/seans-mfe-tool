import { generateAllFiles } from '../unified-generator';
import path from 'path';

describe('unified-generator public/index.html', () => {
  const manifest = {
    name: 'TestMFE',
    version: '1.0.0',
    description: 'Test manifest',
    endpoint: 'http://localhost:3001',
    capabilities: [
      { DataAnalysis: { type: 'domain', description: 'Analyze data' } }
    ],
    dependencies: {
      'design-system': { '@mui/material': '^5.15.0' },
      mfes: {}
    },
    data: null
  };
  const basePath = path.join(__dirname, 'output-index-html');

  afterAll(async () => {
    const fs = await import('fs-extra');
    await fs.remove(basePath);
  });

  it('generates public/index.html with correct title and root div', async () => {
    const files = await generateAllFiles(manifest as any, basePath, { force: true });
    const indexFile = files.find(f => f.path.endsWith('public/index.html'));
    expect(indexFile).toBeDefined();
    expect(indexFile!.content).toContain('<title>TestMFE MFE</title>');
    expect(indexFile!.content).toContain('<div id="root"></div>');
    expect(indexFile!.content).toContain('<link rel="icon" href="/favicon.ico"');
  });
});

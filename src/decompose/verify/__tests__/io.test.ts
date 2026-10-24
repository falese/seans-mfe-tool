import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readBundleView, renderParityMarkdown, screenshotReader } from '../io';
import type { ParityReport } from '../parity';

describe('readBundleView', () => {
  it('reads a bundle’s journeys and request index, and refuses a directory that is not a bundle', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'view-'));
    await expect(readBundleView(dir)).rejects.toThrow(/not an evidence bundle/);
    fs.writeFileSync(path.join(dir, 'bundle.json'), JSON.stringify({ format: 'smt-evidence/1', app: 'http://localhost:5090', journeys: ['j'] }));
    fs.mkdirSync(path.join(dir, 'journeys'));
    fs.mkdirSync(path.join(dir, 'screens'));
    fs.writeFileSync(
      path.join(dir, 'journeys', 'j.json'),
      JSON.stringify({ name: 'j', steps: [{ id: 'j.0', path: '/', regions: [], requests: ['j.0.r0'], console: [], pageErrors: [], screenshot: 'screens/j.0.png' }] })
    );
    fs.writeFileSync(path.join(dir, 'requests.json'), JSON.stringify([{ id: 'j.0.r0', method: 'GET', url: '/api/hm/berths' }]));
    fs.writeFileSync(path.join(dir, 'screens', 'j.0.png'), 'png');
    const view = await readBundleView(dir);
    expect(view.app).toBe('http://localhost:5090');
    expect(view.journeys[0].steps[0].requests).toEqual(['j.0.r0']);
    expect(view.requests).toEqual({ 'j.0.r0': { method: 'GET', url: '/api/hm/berths' } });
    const read = screenshotReader(dir, dir);
    expect(read('baseline', view.journeys[0].steps[0])?.toString()).toBe('png');
    expect(read('candidate', { ...view.journeys[0].steps[0], screenshot: 'screens/none.png' })).toBeUndefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('renderParityMarkdown', () => {
  const report: ParityReport = {
    parity: false,
    journeys: [
      {
        name: 'home',
        ok: false,
        steps: [
          { id: 'home.0', ok: true, content: { missing: [], changed: [], moved: [], added: [] }, network: { missing: [], extra: [] }, console: { new: [] }, visual: { compared: 3, failed: [] } },
          {
            id: 'home.1',
            ok: false,
            path: { baseline: '/docking', candidate: '/' },
            content: { missing: ['Tile#1'], changed: [{ region: 'Board#0', baseline: 'Docking', candidate: 'Dock' }], moved: [], added: [] },
            network: { missing: ['GET /api/hm/berths'], extra: [] },
            console: { new: ['error: boom'] },
            visual: { compared: 2, failed: ['Board#0'] },
          },
        ],
      },
    ],
    summary: { steps: 2, stepsAtParity: 1, regions: 5, regionsAtParity: 3, requests: 1, newConsoleErrors: 1, visualFailures: 1 },
  };
  it('leads with the verdict and lists each failing step’s differences', () => {
    const md = renderParityMarkdown(report, { routes: ['/cargo'] });
    expect(md).toContain('# Parity: ✗ not at parity');
    expect(md).toContain('| 2 | 1 | 5 | 3 | 1 | 1 |');
    expect(md).toContain('### home.1');
    expect(md).toContain('- path: `/docking` → `/`');
    expect(md).toContain('- missing region: Tile#1');
    expect(md).toContain('- text changed in Board#0: “Docking” → “Dock”');
    expect(md).toContain('- call not made: GET /api/hm/berths');
    expect(md).toContain('- new console error: error: boom');
    expect(md).toContain('- pixels changed: Board#0');
    expect(md).not.toContain('### home.0');
    expect(md).toContain('- route `/cargo`');
  });
});

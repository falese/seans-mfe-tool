import type { Image } from '../png';
import { compareBundles, routeGaps, type BundleView, type StepView } from '../parity';
import { encodePng } from './encode-png';

const region = (id: string, ownText: string, parent: string | null = null, rect = { x: 0, y: 0, width: 4, height: 4 }) => ({
  id,
  component: id.split('#')[1].replace(/@\d+$/, ''),
  file: id.split('#')[0],
  landmark: null,
  parent,
  rect,
  ownText,
  data: {},
});

function step(over: Partial<StepView> = {}): StepView {
  return {
    id: 'j.0',
    path: '/docking',
    regions: [
      region('src/App.tsx#App', ''),
      region('src/Board.tsx#Board', 'Docking board', 'src/App.tsx#App'),
      region('src/Tile.tsx#Tile@0', 'B1  occupied', 'src/Board.tsx#Board'),
      region('src/Tile.tsx#Tile@1', 'B2 free', 'src/Board.tsx#Board'),
    ],
    requests: ['j.0.r0'],
    console: [{ type: 'warning', text: 'deprecated' }, { type: 'error', text: 'known failure' }],
    pageErrors: [],
    screenshot: 'screens/j.0.png',
    ...over,
  };
}

function bundle(s: StepView, requests: Record<string, { method: string; url: string }> = { 'j.0.r0': { method: 'GET', url: '/api/hm/berths' } }): BundleView {
  return { journeys: [{ name: 'j', steps: [s] }], requests };
}

describe('compareBundles', () => {
  it('reports parity when the same journeys produce the same regions, calls and console', () => {
    const report = compareBundles(bundle(step()), bundle(step()));
    expect(report.parity).toBe(true);
    expect(report.summary).toEqual({ steps: 1, stepsAtParity: 1, regions: 4, regionsAtParity: 4, requests: 1, newConsoleErrors: 0, visualFailures: 0 });
  });

  it('matches regions by component and order, not by source file — the composed app moves files', () => {
    const moved = step({
      regions: [
        region('shell/App.tsx#App', ''),
        // A wrapper the composed shell adds, with no text of its own: not a difference.
        region('runtime/DeclaredSlot.tsx#DeclaredSlot', '', 'shell/App.tsx#App'),
        region('mfe/Board.tsx#Board', 'Docking board', 'runtime/DeclaredSlot.tsx#DeclaredSlot'),
        region('mfe/Tile.tsx#Tile@0', 'B1 occupied', 'mfe/Board.tsx#Board'),
        region('mfe/Tile.tsx#Tile@1', 'B2 free', 'mfe/Board.tsx#Board'),
      ],
    });
    const report = compareBundles(bundle(step()), bundle(moved));
    expect(report.parity).toBe(true);
    expect(report.journeys[0].steps[0].content.added).toEqual([]);
  });

  it('fails on a missing region, changed text, new visible text and a region under a different parent', () => {
    const changed = step({
      regions: [
        region('src/App.tsx#App', ''),
        region('src/Board.tsx#Board', 'Docking board', 'src/App.tsx#App'),
        region('src/Tile.tsx#Tile@0', 'B1 vacant', 'src/App.tsx#App'),
        region('src/Banner.tsx#Banner', 'Maintenance tonight', 'src/App.tsx#App'),
      ],
    });
    const s = compareBundles(bundle(step()), bundle(changed)).journeys[0].steps[0];
    expect(s.ok).toBe(false);
    expect(s.content).toEqual({
      missing: ['Tile#1'],
      changed: [{ region: 'Tile#0', baseline: 'B1 occupied', candidate: 'B1 vacant' }],
      moved: [{ region: 'Tile#0', baseline: 'Board#0', candidate: 'App#0' }],
      added: ['Banner#0: Maintenance tonight'],
    });
  });

  it('fails on calls the candidate dropped or added, and on console errors the baseline did not have', () => {
    const cand = step({
      requests: ['j.0.r0', 'j.0.r1'],
      console: [{ type: 'error', text: 'known failure' }, { type: 'error', text: 'TypeError: x is undefined' }],
      pageErrors: ['boom'],
    });
    const s = compareBundles(
      bundle(step()),
      bundle(cand, { 'j.0.r0': { method: 'GET', url: '/api/hm/dockings' }, 'j.0.r1': { method: 'GET', url: '/api/hm/berths' } })
    ).journeys[0].steps[0];
    expect(s.network).toEqual({ missing: [], extra: ['GET /api/hm/dockings'] });
    expect(s.console).toEqual({ new: ['error: TypeError: x is undefined', 'pageerror: boom'] });
    expect(s.ok).toBe(false);
  });

  it('fails a step whose path differs, and a journey or step the candidate never ran', () => {
    const base: BundleView = { journeys: [{ name: 'j', steps: [step(), step({ id: 'j.1' })] }, { name: 'k', steps: [step({ id: 'k.0' })] }], requests: bundle(step()).requests };
    const cand: BundleView = { journeys: [{ name: 'j', steps: [step({ path: '/cargo' })] }], requests: base.requests };
    const report = compareBundles(base, cand);
    expect(report.parity).toBe(false);
    expect(report.journeys.map((j) => [j.name, j.ok, j.steps.map((s) => s.ok)])).toEqual([
      ['j', false, [false, false]],
      ['k', false, [false]],
    ]);
    expect(report.journeys[0].steps[0].path).toEqual({ baseline: '/docking', candidate: '/cargo' });
    expect(report.journeys[0].steps[1].missing).toBe(true);
  });

  it('fails the region that drew changed pixels, not the regions around it', () => {
    const img = (dark: boolean): Image => {
      const data = new Uint8Array(8 * 8 * 4).fill(255);
      // One pixel at (6, 6): inside Board (4,4 4x4) but outside its tiles.
      if (dark) data.set([0, 0, 0, 255], (6 * 8 + 6) * 4);
      return { width: 8, height: 8, data };
    };
    const layout = (s: StepView): StepView => ({
      ...s,
      regions: s.regions.map((r) =>
        r.component === 'App'
          ? { ...r, rect: { x: 0, y: 0, width: 8, height: 8 } }
          : r.component === 'Board'
            ? { ...r, rect: { x: 4, y: 4, width: 4, height: 4 } }
            : { ...r, rect: { x: 4, y: r.id.endsWith('@0') ? 4 : 5, width: 2, height: 1 } }
      ),
    });
    const shots = { base: encodePng(img(false)), cand: encodePng(img(true)) };
    const screenshot = (side: 'baseline' | 'candidate') => (side === 'baseline' ? shots.base : shots.cand);
    const report = compareBundles(bundle(layout(step())), bundle(layout(step())), { screenshot });
    const s = report.journeys[0].steps[0];
    expect(s.visual).toEqual({ compared: 4, failed: ['Board#0'] });
    expect(s.ok).toBe(false);
    expect(report.summary.visualFailures).toBe(1);
    // A pixel budget lets a known amount through.
    expect(compareBundles(bundle(layout(step())), bundle(layout(step())), { screenshot, maxDiffPixels: 1 }).parity).toBe(true);
  });
});

describe('routeGaps', () => {
  it('lists the routes no journey visited', () => {
    expect(routeGaps(['/', '/docking', '/berths/:id', '/cargo'], ['/', '/docking', '/berths/b7'])).toEqual(['/cargo']);
  });
});

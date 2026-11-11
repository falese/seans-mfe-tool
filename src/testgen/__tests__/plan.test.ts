import type { Region } from '../../decompose/regions';
import { baselineName, planTests, type Evidence, type EvidenceStep } from '../plan';

const region = (id: string, component: string, parent: string | null, ownText: string, rect = { x: 0, y: 0, width: 100, height: 50 }): Region => ({
  id,
  component,
  file: `src/${component}.tsx`,
  landmark: null,
  parent,
  rect,
  ownText,
  data: {},
});

const step = (id: string, path: string, regions: Region[], requests: string[] = [], errors: string[] = []): EvidenceStep => ({
  id,
  path,
  regions,
  requests,
  console: errors.map((text) => ({ type: 'error', text })),
  pageErrors: [],
  screenshot: `screens/${id}.png`,
});

const shell = region('App', 'App', null, 'Meridian', { x: 0, y: 0, width: 1440, height: 900 });
const board = region('Board', 'DockingBoard', 'App', 'Docking board', { x: 200, y: 100, width: 600, height: 400 });

const evidence: Evidence = {
  app: 'http://localhost:5090',
  clock: '2026-11-11T22:48:00.000Z',
  viewport: { width: 1440, height: 900 },
  journeys: [
    {
      name: 'tour',
      actions: [{ goto: '/' }, { goto: '/docking' }, { click: 'text=Docking' }],
      steps: [
        step('tour.0', '/', [shell], ['tour.0.r0']),
        step('tour.1', '/docking', [shell, board], ['tour.1.r0'], ['known boom']),
        step('tour.2', '/docking', [shell, board]),
      ],
    },
  ],
  requests: [
    { id: 'tour.0.r0', method: 'GET', url: '/api/berths', attributedTo: [{ region: 'App' }] },
    { id: 'tour.1.r0', method: 'GET', url: '/api/dockings', attributedTo: [{ region: 'Board' }] },
  ],
};

describe('planTests', () => {
  const plan = planTests(evidence, {
    mfe: 'docking',
    capabilities: [
      { name: 'DockingBoard', component: 'DockingBoard' },
      { name: 'BerthTile', component: 'BerthTile', notAlone: 'drawn by BerthStrip' },
    ],
    boundaries: ['App', 'DockingBoard'],
  });

  it('gives a capability one alone case per path it was first reached at', () => {
    const board = plan.capabilities[0];
    expect(board.cases.map((c) => [c.step, c.path])).toEqual([['tour.1', '/docking']]);
    expect(board.cases[0].regions).toEqual([{ region: 'Board', text: 'Docking board' }]);
  });

  it('expects only the calls behind what the capability shows, made by that step', () => {
    expect(plan.capabilities[0].cases[0].calls).toEqual(['GET /api/dockings']);
  });

  it('carries the console errors the baseline already had, so they are not new', () => {
    expect(plan.capabilities[0].cases[0].consoleErrors).toEqual(['known boom']);
  });

  it('says why a capability has no alone test', () => {
    expect(plan.capabilities[1]).toMatchObject({ capability: 'BerthTile', cases: [], skipped: 'drawn by BerthStrip' });
  });

  it('checks every step the capability is on screen in, each with its baseline', () => {
    const checks = plan.journeys[0].steps.map((s) => s.capabilities.map((c) => c.visual?.name ?? null));
    expect(checks).toEqual([[], ['tour-1-DockingBoard'], ['tour-2-DockingBoard']]);
    expect(plan.journeys[0].steps[1].capabilities[0].visual?.rect).toEqual({ x: 200, y: 100, width: 600, height: 400 });
  });

  it('masks another placement drawn inside the shell', () => {
    const shellPlan = planTests(evidence, { mfe: 'shell', capabilities: [{ name: 'App', component: 'App' }], boundaries: ['App', 'DockingBoard'] });
    expect(shellPlan.journeys[0].steps[1].capabilities[0].visual?.exclude).toEqual([{ x: 200, y: 100, width: 600, height: 400 }]);
    expect(shellPlan.capabilities[0].cases.map((c) => c.path)).toEqual(['/', '/docking']);
  });

  it('says when a capability never appeared', () => {
    const p = planTests(evidence, { mfe: 'crew', capabilities: [{ name: 'CrewRoster', component: 'CrewRoster' }], boundaries: [] });
    expect(p.capabilities[0].skipped).toBe('not on screen in any captured step');
  });

  it('names baselines as Playwright looks them up', () => {
    expect(baselineName('explore.3', 'A/B')).toBe('explore-3-A-B');
    expect(baselineName('every-route.0', 'App')).toBe('every-route-0-App');
  });
});

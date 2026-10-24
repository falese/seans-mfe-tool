import { buildBundle, normalizeConsoleText, stableStringify, type JourneyRun } from '../bundle';
import type { Region } from '../regions';

const region = (id: string, file: string, ownText: string): Region => ({
  id,
  component: id.split('#')[1],
  file,
  landmark: 'main',
  parent: null,
  rect: { x: 0, y: 0, width: 1, height: 1 },
  ownText,
  data: {},
});

const APP = 'http://localhost:5090/';

function run(): JourneyRun {
  return {
    journey: { name: 'docking', steps: [{ goto: '/' }, { click: 'text=Docking' }] },
    steps: [
      {
        path: '/',
        regions: [region('src/layout/Sidebar.tsx#Sidebar', 'src/layout/Sidebar.tsx', 'Docking Cargo')],
        coverage: { visibleElements: 10, mappedToSource: 9 },
        navigations: ['/'],
        console: [],
        pageErrors: [],
        screenshot: Buffer.from('png0'),
      },
      {
        path: '/docking',
        regions: [
          region('src/layout/Sidebar.tsx#Sidebar', 'src/layout/Sidebar.tsx', 'Docking Cargo'),
          region('src/components/DockingBoard.tsx#DockingBoard', 'src/components/DockingBoard.tsx', 'VR-88213 Kestrel'),
        ],
        coverage: { visibleElements: 20, mappedToSource: 19 },
        navigations: ['/docking'],
        console: [{ type: 'error', text: 'Warning: each child needs a key' }],
        pageErrors: [],
        screenshot: Buffer.from('png1'),
      },
    ],
    requests: [
      // Out of order within the step, as parallel requests arrive.
      {
        step: 0,
        method: 'GET',
        url: 'http://localhost:5090/api/stationos/modules',
        initiator: ['src/api/client.ts', 'src/store/AppContext.tsx'],
        status: 200,
        mimeType: 'application/json',
        body: { Data: [{ ModuleName: 'Hydroponics Bay' }] },
      },
      {
        step: 0,
        method: 'GET',
        url: 'http://localhost:5090/api/harbormaster/dockings',
        initiator: ['src/api/client.ts', 'src/store/AppContext.tsx'],
        status: 200,
        mimeType: 'application/json',
        body: [{ vessel_registry_no: 'VR-88213', vessel_name: 'Kestrel' }],
      },
      {
        step: 1,
        method: 'GET',
        url: 'http://localhost:5090/api/harbormaster/dockings',
        initiator: ['src/api/client.ts', 'src/components/DockingBoard.tsx'],
        status: 200,
        mimeType: 'application/json',
        body: [{ vessel_registry_no: 'VR-00000' }],
      },
    ],
  };
}

describe('buildBundle', () => {
  const bundle = buildBundle([run()], { appUrl: APP, viewport: { width: 1440, height: 900 }, clock: '2026-10-24T00:00:00.000Z' });

  it('numbers requests by step, sorted by method and URL, with app-relative URLs', () => {
    const requests = bundle.files['requests.json'] as Array<{ id: string; url: string; step: string }>;
    expect(requests.map((r) => [r.id, r.url, r.step])).toEqual([
      ['docking.0.r0', '/api/harbormaster/dockings', 'docking.0'],
      ['docking.0.r1', '/api/stationos/modules', 'docking.0'],
      ['docking.1.r0', '/api/harbormaster/dockings', 'docking.1'],
    ]);
  });

  it('attributes data loaded in an earlier step to the region that shows it later', () => {
    const requests = bundle.files['requests.json'] as Array<{ id: string; attributedTo: unknown[] }>;
    expect(requests[0].attributedTo).toEqual([{ region: 'src/components/DockingBoard.tsx#DockingBoard', via: 'data' }]);
    expect(requests[2].attributedTo).toEqual([{ region: 'src/components/DockingBoard.tsx#DockingBoard', via: 'initiator' }]);
    expect(requests[1].attributedTo).toEqual([]);
  });

  it('records the first response for each request, keyed for replay', () => {
    const responses = bundle.files['responses.json'] as Record<string, { body: unknown }>;
    expect(Object.keys(responses).sort()).toEqual([
      'GET /api/harbormaster/dockings',
      'GET /api/stationos/modules',
    ]);
    expect(responses['GET /api/harbormaster/dockings'].body).toEqual([{ vessel_registry_no: 'VR-88213', vessel_name: 'Kestrel' }]);
  });

  it('writes per-journey steps that point at their requests and screenshots', () => {
    const journey = bundle.files['journeys/docking.json'] as { steps: Array<Record<string, unknown>> };
    expect(journey.steps[1]).toMatchObject({
      id: 'docking.1',
      action: 'click text=Docking',
      path: '/docking',
      requests: ['docking.1.r0'],
      screenshot: 'screens/docking.1.png',
    });
    expect(bundle.screenshots['screens/docking.1.png'].toString()).toBe('png1');
  });

  it('summarizes the run in bundle.json without wall-clock data', () => {
    expect(bundle.files['bundle.json']).toEqual({
      format: 'smt-evidence/1',
      app: APP,
      viewport: { width: 1440, height: 900 },
      clock: '2026-10-24T00:00:00.000Z',
      journeys: ['docking'],
      stats: {
        steps: 2,
        regions: 2,
        requests: 3,
        attributedRequests: 2,
        sourceCoverage: { visibleElements: 30, mappedToSource: 28 },
        consoleErrors: 1,
        pageErrors: 0,
      },
    });
  });

  it('emits the journeys that ran, so a replay can repeat them', () => {
    expect(bundle.files['journeys.yaml']).toContain('name: docking');
    expect(bundle.files['journeys.yaml']).toContain('click: text=Docking');
  });
});

describe('stableStringify', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 2 } })).toBe(
      '{\n  "a": {\n    "c": 2,\n    "d": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n'
    );
  });
});

describe('normalizeConsoleText', () => {
  it('masks memory addresses, which differ on every run', () => {
    expect(normalizeConsoleText('[.WebGL-0x265400118e00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High)')).toBe(
      '[.WebGL-0x…]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High)'
    );
    expect(normalizeConsoleText('Failed to load resource: 404 (Not Found)')).toBe('Failed to load resource: 404 (Not Found)');
  });
});

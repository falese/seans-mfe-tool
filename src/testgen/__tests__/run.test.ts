import { compositionOf, remoteServed, renderRunReport, replayLookup, type RunReport } from '../run';
import { bodyKey } from '../../decompose/bundle';

const rules = [
  { registration: { name: 'console', remoteEntryUrl: 'http://localhost:5001/remoteEntry.js' }, routes: [{ when: { stateKey: 'meridian.root' }, resolve: { capability: 'StationConsole', props: { slot: 'root' } } }] },
  {
    registration: { name: 'arrivals' },
    routes: [
      { when: { stateKey: 'meridian.open.arrivals' }, resolve: { capability: 'VesselRegistry', props: { slot: 'console/main' } } },
      { when: { stateKey: 'meridian.open.arrivals' }, resolve: { capability: 'PassengerManifest', props: { slot: 'console/status' } } },
    ],
  },
  { registration: { name: 'docking' }, routes: [{ when: { stateKey: 'meridian.berth.b1' }, resolve: { capability: 'BerthTile', props: { slot: 'console/berth.b1' } } }] },
];

describe('compositionOf', () => {
  const c = compositionOf(rules);

  it('finds the root action: the one that places into the root slot', () => {
    expect(c.root).toBe('meridian.root');
  });

  it('lists each action with every placement it makes, root first', () => {
    expect(c.actions.map((a) => [a.stateKey, a.placements.map((p) => `${p.mfe}/${p.capability}→${p.slot}`)])).toEqual([
      ['meridian.root', ['console/StationConsole→root']],
      ['meridian.berth.b1', ['docking/BerthTile→console/berth.b1']],
      ['meridian.open.arrivals', ['arrivals/VesselRegistry→console/main', 'arrivals/PassengerManifest→console/status']],
    ]);
  });

  it('carries each placement\'s remote entry, to tell an unserved remote from a broken one', () => {
    expect(c.actions[0].placements[0].remoteEntryUrl).toBe('http://localhost:5001/remoteEntry.js');
  });
});

describe('remoteServed', () => {
  const answer = (status: number, type: string) => jest.fn(async () => new Response('x', { status, headers: { 'content-type': type } }));

  it('is null when the entry answers with JavaScript', async () => {
    expect(await remoteServed('http://localhost:5001/remoteEntry.js', answer(200, 'application/javascript; charset=utf-8'))).toBeNull();
  });

  it('says why when it does not: an error status, an HTML fallback page, or no answer', async () => {
    expect(await remoteServed('http://x/remoteEntry.js', answer(404, 'text/plain'))).toBe('its remote entry http://x/remoteEntry.js answers 404');
    expect(await remoteServed('http://x/remoteEntry.js', answer(200, 'text/html'))).toBe('its remote entry http://x/remoteEntry.js answers text/html, not JavaScript: not built or not served');
    const down = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await remoteServed('http://x/remoteEntry.js', down)).toBe('its remote entry http://x/remoteEntry.js does not answer: is it running?');
  });
});

describe('replayLookup', () => {
  const responses = new Map([
    [
      'http://localhost:5008',
      {
        'POST /graphql': { status: 200, mimeType: 'application/json', body: { data: { a: 1 } } },
        [bodyKey('POST', '/graphql', '{"query":"{ b }"}')]: { status: 200, mimeType: 'application/json', body: { data: { b: 2 } } },
      },
    ],
  ]);

  it('answers a request to an MFE\'s origin from that MFE\'s recording, by body first', () => {
    expect(replayLookup('POST', 'http://localhost:5008/graphql', '{"query":"{ b }"}', responses)?.body).toEqual({ data: { b: 2 } });
    expect(replayLookup('POST', 'http://localhost:5008/graphql', '{"query":"{ a }"}', responses)?.body).toEqual({ data: { a: 1 } });
  });

  it('lets anything else through', () => {
    expect(replayLookup('POST', 'http://localhost:4504/graphql', '{}', responses)).toBeUndefined();
    expect(replayLookup('GET', 'http://localhost:5008/remoteEntry.js', undefined, responses)).toBeUndefined();
  });
});

describe('renderRunReport', () => {
  const report: RunReport = {
    project: 'meridian-station',
    ok: false,
    mfes: [
      { mfe: 'arrivals', dir: 'meridian-arrivals', unit: { passed: 72, failed: 0 }, contract: { passed: 62, failed: 0 } },
      { mfe: 'console', dir: 'meridian-console', unit: { passed: 30, failed: 0 }, contract: { skipped: 'no BFF' } },
      { mfe: 'docking-wasm', dir: null, unit: { skipped: 'no MFE directory: a second build of another MFE' }, contract: { skipped: 'no MFE directory: a second build of another MFE' } },
    ],
    composed: {
      actions: [{ stateKey: 'meridian.open.arrivals', placements: [{ mfe: 'arrivals', capability: 'VesselRegistry', slot: 'console/main', mounted: true }], consoleErrors: ['TypeError: berths is undefined\n  at Board (http://x/main.js:1:1)'] }],
      packs: [{ mfe: 'arrivals', capability: 'PassengerManifest', slot: 'console/status', stateKey: 'meridian.open.arrivals', cases: [{ name: 'crawl-012', ok: false, failure: 'PassengerManifest#0: "Nobody"' }] }],
      unpacked: [{ mfe: 'console', capability: 'StationConsole' }],
    },
  };

  it('says the verdict first, then one line per MFE and suite, then every failing case', () => {
    const md = renderRunReport(report);
    expect(md.split('\n')[0]).toBe('# meridian-station — ✗ not every test passes');
    expect(md).toContain('| arrivals | 72 / 0 | 62 / 0 |');
    expect(md).toContain('| console | 30 / 0 | no BFF |');
    expect(md).toContain('- ✗ `meridian.open.arrivals` → arrivals / PassengerManifest in `console/status`, case crawl-012: PassengerManifest#0: "Nobody"');
    expect(md).toContain('console / StationConsole — no pack: run test:generate in it');
    expect(md).toContain('| `meridian.open.arrivals` | 1 / 1 | 1 |');
    expect(md).toContain('- ✗ `meridian.open.arrivals` raised a console error on mounting: TypeError: berths is undefined');
  });
});

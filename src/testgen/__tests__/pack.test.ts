import { consoleKey, planPacks } from '../pack';
import type { TestPlan } from '../plan';
import type { JourneyStep } from '../../decompose/journeys';

const cap = (capability: string, text: string) => ({ capability, regions: [{ region: `${capability}#0`, text }], calls: [], visual: null });

/** A standalone page with two tabs; the manifest tab has a search box. */
const plan = {
  mfe: 'arrivals',
  app: 'http://localhost:5008',
  clock: '2026-11-11T00:00:00.000Z',
  viewport: { width: 1440, height: 900 },
  capabilities: [],
  calls: [],
  journeys: [
    {
      name: 'crawl-005',
      steps: [
        { id: 'crawl-005.0', action: { goto: '/' }, path: '/', capabilities: [cap('VesselRegistry', '8 vessels')], consoleErrors: [] },
        { id: 'crawl-005.1', action: { click: 'role=tab[name="Manifest"s]' }, path: '/', capabilities: [cap('PassengerManifest', 'Rosa Ivo')], consoleErrors: [] },
        { id: 'crawl-005.2', action: { fill: { selector: 'role=searchbox[name="Search"s]', value: 'Ivo' } }, path: '/', capabilities: [cap('PassengerManifest', 'Ivo')], consoleErrors: ['Warning: Each child in a list should have a unique "key" prop.\n    at Row (http://localhost:5008/main.4f1e.js:120:9)'] },
        { id: 'crawl-005.3', action: { click: 'role=tab[name="Vessels"s]' }, path: '/', capabilities: [cap('VesselRegistry', '8 vessels')], consoleErrors: [] },
      ],
    },
    {
      name: 'crawl-006',
      steps: [
        { id: 'crawl-006.0', action: { goto: '/' }, path: '/', capabilities: [cap('VesselRegistry', '8 vessels')], consoleErrors: [] },
        { id: 'crawl-006.1', action: { click: 'role=tab[name="Manifest"s]' }, path: '/', capabilities: [cap('PassengerManifest', 'Rosa Ivo')], consoleErrors: [] },
      ],
    },
  ],
} as unknown as TestPlan;

describe('planPacks', () => {
  const packs = planPacks(plan);
  const manifest = packs.find((p) => p.capability === 'PassengerManifest');

  it('starts each case where the capability is first on screen: how the host got there is the host\'s', () => {
    expect(manifest?.cases.map((c) => c.steps.map((s) => s.action))).toEqual([
      [{ fill: { selector: 'role=searchbox[name="Search"s]', value: 'Ivo' } }],
      [],
    ]);
  });

  it('stops a case when the capability leaves the screen', () => {
    // crawl-005's last step shows the other tab: not PassengerManifest's to test.
    expect(manifest?.cases[0].steps).toHaveLength(1);
  });

  it('expects what the capability showed when it appeared, and after each of its steps', () => {
    expect(manifest?.cases[0].expect).toEqual([{ region: 'PassengerManifest#0', text: 'Rosa Ivo' }]);
    expect(manifest?.cases[0].steps[0].expect).toEqual([{ region: 'PassengerManifest#0', text: 'Ivo' }]);
  });

  it('carries the console errors its recording already had, masked: characterization pins them', () => {
    expect(manifest?.cases[0].knownConsole).toEqual(['Warning: Each child in a list should have a unique "key" prop. at Row (<src>)']);
    expect(manifest?.cases[1].knownConsole).toEqual([]);
  });

  it('keeps one case per distinct sequence of steps', () => {
    const vessels = packs.find((p) => p.capability === 'VesselRegistry');
    expect(vessels?.cases.map((c) => c.steps.length)).toEqual([0]);
  });

  it('carries what a host needs to replay the MFE\'s data and clock', () => {
    expect(manifest).toMatchObject({ mfe: 'arrivals', app: 'http://localhost:5008', clock: '2026-11-11T00:00:00.000Z' });
  });

  it('never carries a goto: navigation is the host\'s', () => {
    const steps = packs.flatMap((p) => p.cases.flatMap((c) => c.steps.map((s) => s.action as JourneyStep)));
    expect(steps.some((s) => 'goto' in s)).toBe(false);
  });
});

describe('planPacks — props', () => {
  it('records the props a hosted capability was mounted with, from its route', () => {
    const hosted = {
      ...plan,
      journeys: [
        { name: 'b2', steps: [{ id: 'b2.0', action: { goto: '/#/BerthTile?berthId=b2' }, path: '/BerthTile?berthId=b2', capabilities: [cap('BerthTile', 'b2 DOCKED')], consoleErrors: [] }] },
        { name: 'plain', steps: [{ id: 'p.0', action: { goto: '/' }, path: '/', capabilities: [cap('BerthTile', 'b1 DOCKED')], consoleErrors: [] }] },
      ],
    } as unknown as TestPlan;
    const tile = planPacks(hosted).find((p) => p.capability === 'BerthTile');
    expect(tile?.cases.map((c) => [c.name, c.props])).toEqual([
      ['b2', { berthId: 'b2' }],
      ['plain', {}],
    ]);
  });
});

describe('consoleKey', () => {
  it('masks sources and whitespace, so a rebuilt bundle\'s line numbers do not make an old error new', () => {
    expect(consoleKey('TypeError: x is undefined\n   at f (http://localhost:5000/main.cf64.js:49245:14)')).toBe(consoleKey('TypeError: x is undefined at f (http://localhost:5000/main.aa01.js:7:1)'));
  });
});

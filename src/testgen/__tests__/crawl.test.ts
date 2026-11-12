import { crawl, journeysYaml, selectorFor, stateSignature, type CrawlDriver, type CrawlState } from '../crawl';
import { parseJourneys, type JourneyStep } from '../../decompose/journeys';

describe('selectorFor', () => {
  it('addresses a control by its role and exact accessible name', () => {
    expect(selectorFor({ role: 'tab', name: 'Passengers', index: 0, of: 1 })).toBe('role=tab[name="Passengers"s]');
  });
  it('picks one of several same-named controls by position', () => {
    expect(selectorFor({ role: 'button', name: 'Open', index: 1, of: 3 })).toBe('role=button[name="Open"s] >> nth=1');
  });
  it('escapes quotes in a name', () => {
    expect(selectorFor({ role: 'button', name: 'Say "hi"', index: 0, of: 1 })).toBe('role=button[name="Say \\"hi\\""s]');
  });
});

describe('stateSignature', () => {
  it('is the same for the same path, text and controls, whitespace aside', () => {
    expect(stateSignature({ path: '/', text: 'A  b', controls: ['tab:X'] })).toBe(stateSignature({ path: '/', text: 'A b', controls: ['tab:X'] }));
  });
  it('differs when what is shown differs', () => {
    expect(stateSignature({ path: '/', text: 'A', controls: [] })).not.toBe(stateSignature({ path: '/', text: 'B', controls: [] }));
  });
});

/** A tiny app: two tabs; the second shows a button that opens a dialog with a Close button. */
function fakeApp(): CrawlDriver & { opened: number } {
  const states: Record<string, CrawlState> = {
    vessels: { path: '/', text: 'Vessels table', controls: [{ role: 'tab', name: 'Vessels', index: 0, of: 1 }, { role: 'tab', name: 'Passengers', index: 0, of: 1 }] },
    passengers: {
      path: '/',
      text: 'Passengers list',
      controls: [
        { role: 'tab', name: 'Vessels', index: 0, of: 1 },
        { role: 'tab', name: 'Passengers', index: 0, of: 1 },
        { role: 'button', name: 'Details', index: 0, of: 1 },
      ],
    },
    dialog: { path: '/', text: 'Passengers list Details of Rosa', controls: [{ role: 'button', name: 'Close', index: 0, of: 1 }] },
  };
  const next = (at: string, step: JourneyStep): string => {
    if (!('click' in step)) return at;
    if (step.click.includes('"Vessels"')) return 'vessels';
    if (step.click.includes('"Passengers"')) return 'passengers';
    if (step.click.includes('"Details"')) return 'dialog';
    if (step.click.includes('"Close"')) return 'passengers';
    return at;
  };
  const app = {
    opened: 0,
    async open(steps: JourneyStep[]) {
      app.opened += 1;
      let at = 'vessels';
      for (const s of steps) at = next(at, s);
      return states[at];
    },
  };
  return app;
}

describe('crawl', () => {
  it('reaches every state and exercises every control in each, as replayable journeys', async () => {
    const result = await crawl(fakeApp(), { start: '/', maxInteractions: 50 });
    expect(result.states).toBe(3);
    // Every (state, control) pair once: 2 + 3 + 1.
    expect(result.interactions).toBe(6);
    const toDialog = result.journeys.find((j) => j.steps.some((s) => 'click' in s && s.click.includes('"Details"')));
    expect(toDialog?.steps).toEqual([{ goto: '/' }, { click: 'role=tab[name="Passengers"s]' }, { click: 'role=button[name="Details"s]' }]);
    // Each journey starts from the start URL, so each replays on its own.
    expect(result.journeys.every((j) => 'goto' in j.steps[0])).toBe(true);
  });

  it('stops at the interaction budget and says so', async () => {
    const result = await crawl(fakeApp(), { start: '/', maxInteractions: 2 });
    expect(result.interactions).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it('leaves out controls whose names match an exclusion', async () => {
    const result = await crawl(fakeApp(), { start: '/', maxInteractions: 50, exclude: /details/i });
    expect(result.states).toBe(2);
    expect(JSON.stringify(result.journeys)).not.toContain('Details');
  });

  it('writes a journey file the DSL parser accepts', async () => {
    const result = await crawl(fakeApp(), { start: '/', maxInteractions: 50 });
    const text = journeysYaml(result, 'http://localhost:5008');
    expect(text).toContain('# Crawled from http://localhost:5008');
    expect(parseJourneys(text)).toEqual(result.journeys);
    // Written for people to edit: every step spelled out, no YAML anchors shared between journeys.
    expect(text).not.toMatch(/[&*]ref_/);
  });
});


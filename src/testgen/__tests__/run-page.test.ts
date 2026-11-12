/**
 * @jest-environment jsdom
 *
 * test:run's browser half against a fake browser over jsdom: the daemon is a stubbed fetch
 * that, like the real shell, mounts each action's placements into stamped slots.
 */
import { NetworkError } from '@seans-mfe/contracts';
import { fireAction, runComposed } from '../run-page';
import type { ChromiumLike } from '../../design/dom-capture';
import type { CapabilityPack } from '../pack';
import type { Composition } from '../run';

/** A Playwright locator over jsdom. A string handed to evaluate is returned as itself, as
 * Playwright evaluates it as an expression and never calls it on the element. */
function locator(selector: string, root: ParentNode = document): unknown {
  const all = () => Array.from(root.querySelectorAll(selector));
  const at = (i: number) => {
    const e = all()[i];
    if (!e) throw new Error(`no ${selector}`);
    return e as HTMLElement;
  };
  return {
    first: () => locator(selector, root),
    count: async () => all().length,
    locator: (s: string) => locator(s, at(0)),
    evaluate: async (fn: unknown) => (typeof fn === 'function' ? (fn as (e: Element) => unknown)(at(0)) : fn),
    getAttribute: async (n: string) => at(0).getAttribute(n),
    click: async () => at(0).click(),
    fill: async (v: string) => {
      const input = at(0) as HTMLInputElement;
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    press: async () => undefined,
    selectOption: async () => undefined,
  };
}

/** The current page's console: what the shell and its MFEs log, per scenario. */
let consoleOf: Array<(m: { type(): string; text(): string }) => void> = [];
const noise = { root: [] as string[], open: [] as string[], click: [] as string[] };
const logError = (text: string) => consoleOf.forEach((h) => h({ type: () => 'error', text: () => text }));

const page = () => ({
  goto: async () => {
    document.body.innerHTML = '';
    consoleOf = consoleOf.slice(-1);
  },
  waitForLoadState: async () => undefined,
  waitForTimeout: async () => undefined,
  locator: (s: string) => locator(s),
  route: async () => undefined,
  on: (event: string, h: (m: { type(): string; text(): string }) => void) => {
    if (event === 'console') consoleOf.push(h);
  },
  clock: { setFixedTime: async () => undefined },
  close: async () => undefined,
});

const chromium = {
  launch: async () => ({ newContext: async () => ({ newPage: async () => page(), close: async () => undefined }), close: async () => undefined }),
} as unknown as ChromiumLike;

const composition: Composition = {
  root: 'm.root',
  actions: [
    { stateKey: 'm.root', placements: [{ mfe: 'console', capability: 'Console', slot: 'root' }] },
    {
      stateKey: 'm.open',
      placements: [
        { mfe: 'arrivals', capability: 'Registry', slot: 'console/main' },
        { mfe: 'broken', capability: 'Thing', slot: 'console/side' },
      ],
    },
  ],
};

/** The shell: what each action mounts. */
function mount(stateKey: string): void {
  if (stateKey === 'm.root') {
    document.body.innerHTML = '<div data-smt-mfe="console" data-smt-capability="Console"><nav><button id="tab">Tabs</button></nav></div>';
    noise.root.forEach(logError);
    return;
  }
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div data-smt-mfe="arrivals" data-smt-capability="Registry" data-slot-state="ready">
       <h2>Vessel Registry</h2><p id="count">8 vessels</p><button id="flagged">Flagged</button>
     </div>
     <div data-smt-mfe="broken" data-smt-capability="Thing" data-slot-state="error"><div role="alert">Failed to load module</div></div>`
  );
  noise.open.forEach(logError);
  document.getElementById('flagged')?.addEventListener('click', () => {
    (document.getElementById('count') as HTMLElement).textContent = '2 vessels';
    noise.click.forEach(logError);
  });
}

const posted: string[] = [];
beforeEach(() => {
  jest.useRealTimers();
  posted.length = 0;
  consoleOf = [];
  noise.root = [];
  noise.open = [];
  noise.click = [];
  global.fetch = jest.fn(async (_url: unknown, init?: { body?: string }) => {
    const m = JSON.parse(JSON.parse(init?.body ?? '{}').variables.m) as { payload: { stateKey: string } };
    posted.push(m.payload.stateKey);
    mount(m.payload.stateKey);
    return { ok: true, status: 200 } as Response;
  }) as unknown as typeof fetch;
});

const region = 'src/Registry.tsx#Registry';
const pack = (steps: CapabilityPack['cases'][number]['steps'], knownConsole: string[] = []): CapabilityPack => ({
  mfe: 'arrivals',
  capability: 'Registry',
  app: 'http://localhost:5008',
  clock: '2026-11-12T04:06:00.000Z',
  cases: [{ name: 'crawl-000', expect: [{ region, text: 'Vessel Registry 8 vessels' }], steps, knownConsole }],
});

describe('fireAction', () => {
  it('posts the action to the daemon as a sendMessage envelope', async () => {
    await fireAction('http://localhost:4504/', 'm.open');
    expect(posted).toEqual(['m.open']);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://localhost:4504/graphql');
  });

  it('throws a NetworkError when the daemon refuses it', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 502 }) as Response) as unknown as typeof fetch;
    await expect(fireAction('http://localhost:4504', 'm.open')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('runComposed', () => {
  const opts = (packs: CapabilityPack[]) => ({ shellUrl: 'http://localhost:5000', daemonUrl: 'http://localhost:4504', composition, packs, responses: new Map(), mountTimeout: 50 });

  it('fires the root action before the others, and checks every placement mounts', async () => {
    const r = await runComposed(opts([]), chromium);
    expect(posted.slice(0, 3)).toEqual(['m.root', 'm.root', 'm.open']);
    expect(r.actions.map((a) => a.placements.map((p) => [p.capability, p.mounted]))).toEqual([[['Console', true]], [['Registry', true], ['Thing', false]]]);
  });

  it('quotes the slot\'s own error when a placement does not mount', async () => {
    const r = await runComposed(opts([]), chromium);
    expect(r.actions[1].placements[1].error).toBe('the slot reports an error: "Failed to load module"');
  });

  it('runs a pack\'s case inside the slot: its text, then each step and what it shows after', async () => {
    const r = await runComposed(opts([pack([{ action: { click: '#flagged' }, expect: [{ region, text: 'Vessel Registry 2 vessels' }] }])]), chromium);
    expect(r.packs[0].cases).toEqual([{ name: 'crawl-000', ok: true }]);
  });

  it('fails a case on text the slot does not show, and says what it shows instead', async () => {
    const r = await runComposed(opts([pack([{ action: { click: '#flagged' }, expect: [{ region, text: 'Vessel Registry 3 vessels' }] }])]), chromium);
    expect(r.packs[0].cases[0].ok).toBe(false);
    expect(r.packs[0].cases[0].failure).toContain('"3" not shown (the slot shows "Vessel Registry2 vesselsFlagged")');
  }, 20_000);

  it('skips a step on the host\'s own chrome when it changed nothing the capability shows, and fails it otherwise', async () => {
    const same = await runComposed(opts([pack([{ action: { click: '#tab' }, expect: [{ region, text: 'Vessel Registry 8 vessels' }] }])]), chromium);
    expect(same.packs[0].cases[0].ok).toBe(true);
    const changed = await runComposed(opts([pack([{ action: { click: '#tab' }, expect: [{ region, text: 'Vessel Registry 2 vessels' }] }])]), chromium);
    expect(changed.packs[0].cases[0].failure).toBe('the control of a step that changed it is not inside the capability: #tab');
  });

  it('lists placed capabilities with no pack', async () => {
    const r = await runComposed(opts([pack([])]), chromium);
    expect(r.unpacked).toEqual([
      { mfe: 'console', capability: 'Console' },
      { mfe: 'broken', capability: 'Thing' },
    ]);
  });

  describe('console errors, each reported once, at the first tier that sees it', () => {
    const flagged = [{ action: { click: '#flagged' }, expect: [{ region, text: 'Vessel Registry 2 vessels' }] }];

    it('never blames an MFE for the shell\'s own: the root action alone is the baseline', async () => {
      noise.root = ['Warning: Failed prop type: Invalid prop `children` supplied to `ThemeProvider`\n  at ThemeProvider (http://localhost:5000/main.cf64.js:49245:14)'];
      const r = await runComposed(opts([pack(flagged)]), chromium);
      expect(r.actions.map((a) => a.consoleErrors)).toEqual([[], []]);
      expect(r.packs[0].cases[0]).toEqual({ name: 'crawl-000', ok: true });
    });

    it('reports an error raised by mounting an action against the action, not its cases', async () => {
      noise.open = ['TypeError: Cannot read properties of undefined (reading \'berths\')'];
      const r = await runComposed(opts([pack(flagged)]), chromium);
      expect(r.actions[1].consoleErrors).toEqual(['TypeError: Cannot read properties of undefined (reading \'berths\')']);
      expect(r.packs[0].cases[0].ok).toBe(true);
    });

    it('fails a case on an error its own steps raise', async () => {
      noise.click = ['Error: flagged filter exploded'];
      const r = await runComposed(opts([pack(flagged)]), chromium);
      expect(r.packs[0].cases[0]).toEqual({ name: 'crawl-000', ok: false, failure: 'new console error: Error: flagged filter exploded' });
    });

    it('lets through what the capability\'s recording already had: characterization pins it', async () => {
      noise.click = ['Warning: list key\n at Row (http://localhost:5008/main.aa.js:1:1)'];
      noise.open = ['Warning: list key\n at Row (http://localhost:5008/main.aa.js:9:9)'];
      const r = await runComposed(opts([pack(flagged, ['Warning: list key at Row (<src>)'])]), chromium);
      expect(r.actions[1].consoleErrors).toEqual([]);
      expect(r.packs[0].cases[0].ok).toBe(true);
    });
  });
});

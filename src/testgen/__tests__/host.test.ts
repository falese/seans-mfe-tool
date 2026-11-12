/**
 * @jest-environment jsdom
 *
 * The capability host's page, run in jsdom with a stand-in for the shell's adaptor, and its
 * target and server.
 */
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import type { DSLManifest } from '@seans-mfe/dsl';
import { HOST_SCRIPT, hostPage, hostTarget, serveHost, type HostTarget } from '../host';

const manifest = {
  name: 'meridian-cargo-ops',
  version: '1.0.0',
  type: 'remote',
  framework: 'angular',
  remoteEntry: 'http://localhost:5004/remoteEntry.js',
  capabilities: [{ load: { type: 'platform' } }, { CargoManifest: { type: 'domain' } }, { HazardSummary: { type: 'domain' } }],
} as unknown as DSLManifest;

describe('hostTarget', () => {
  it('locates the MFE as its registration does, with its domain capabilities', () => {
    expect(hostTarget(manifest)).toEqual({
      mfe: 'meridian-cargo-ops',
      capabilities: ['CargoManifest', 'HazardSummary'],
      remoteEntryUrl: 'http://localhost:5004/remoteEntry.js',
      scope: 'meridian_cargo_ops',
      module: './App',
    });
  });

  it('takes the origin it is served from when given', () => {
    expect(hostTarget(manifest, 'http://localhost:6004').remoteEntryUrl).toBe('http://localhost:6004/remoteEntry.js');
  });
});

describe('the host page', () => {
  const target: HostTarget = hostTarget(manifest);
  const mounted: Array<{ capability: string; el: Element }> = [];
  const unmounted: string[] = [];
  let fail = '';
  const props: Array<Record<string, string>> = [];

  // Each test runs the page's script once, as a page load does: its listener goes with it.
  let listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
  const add = window.addEventListener.bind(window);
  beforeAll(() => {
    jest.spyOn(window, 'addEventListener').mockImplementation((type: string, l: EventListenerOrEventListenerObject) => {
      listeners.push([type, l]);
      add(type, l);
    });
  });
  afterEach(() => {
    for (const [type, l] of listeners) window.removeEventListener(type, l);
    listeners = [];
  });

  beforeEach(() => {
    jest.useRealTimers();
    mounted.length = 0;
    unmounted.length = 0;
    props.length = 0;
    fail = '';
    const html = hostPage(target);
    document.body.innerHTML = html.slice(html.indexOf('<nav'), html.indexOf('<script>'));
    window.location.hash = '';
    const w = window as unknown as Record<string, unknown>;
    w.__SMT_HOST__ = target;
    w.__SMT_HOST_ADAPTOR__ = {
      mount: async (exp: { capability: string; output: { scope: string; props?: Record<string, string> } }, el: Element) => {
        if (exp.capability === fail) throw new Error('remote container not found');
        el.innerHTML = `<h2>${exp.capability}</h2>`;
        props.push(exp.output.props ?? {});
        mounted.push({ capability: exp.capability, el });
        return async () => {
          unmounted.push(exp.capability);
        };
      },
    };
  });

  const start = async () => {
    new Function(HOST_SCRIPT)();
    await (window as unknown as { __SMT_HOST_READY__: Promise<void> }).__SMT_HOST_READY__;
  };
  const slot = () => document.querySelector('[data-smt-capability]') as HTMLElement;

  it('mounts the first capability into a slot stamped as a shell stamps one', async () => {
    await start();
    expect(mounted.map((m) => m.capability)).toEqual(['CargoManifest']);
    expect(slot().getAttribute('data-smt-mfe')).toBe('meridian-cargo-ops');
    expect(slot().getAttribute('data-slot-state')).toBe('ready');
    expect(slot().textContent).toBe('CargoManifest');
    expect([...document.querySelectorAll('[role=tab]')].map((t) => [t.textContent, t.getAttribute('aria-selected')])).toEqual([
      ['CargoManifest', 'true'],
      ['HazardSummary', 'false'],
    ]);
  });

  it('switches on its tab: unmounts the one before, mounts the one named', async () => {
    await start();
    window.location.hash = '#/HazardSummary';
    await new Promise((r) => setTimeout(r, 20));
    expect(mounted.map((m) => m.capability)).toEqual(['CargoManifest', 'HazardSummary']);
    expect(unmounted).toEqual(['CargoManifest']);
    expect(document.querySelectorAll('[data-smt-capability]')).toHaveLength(1);
    expect(slot().getAttribute('data-smt-capability')).toBe('HazardSummary');
  });

  it('leaves the shown capability alone when its own tab is selected again', async () => {
    await start();
    window.location.hash = '#/CargoManifest';
    await new Promise((r) => setTimeout(r, 20));
    expect(mounted.map((m) => m.capability)).toEqual(['CargoManifest']);
  });

  it('mounts with the props its route names, as a composition passes them', async () => {
    window.location.hash = '#/HazardSummary?berthId=b2&deck=3';
    await start();
    expect(mounted.map((m) => m.capability)).toEqual(['HazardSummary']);
    expect(props).toEqual([{ berthId: 'b2', deck: '3' }]);
    // Other props are another mount, of the same capability.
    window.location.hash = '#/HazardSummary?berthId=b3';
    await new Promise((r) => setTimeout(r, 20));
    expect(props).toEqual([{ berthId: 'b2', deck: '3' }, { berthId: 'b3' }]);
  });

  it('says so in the slot, and the slot\'s state, when a capability cannot mount', async () => {
    fail = 'CargoManifest';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await start();
    expect(slot().getAttribute('data-slot-state')).toBe('error');
    expect(slot().textContent).toBe('Could not mount CargoManifest: remote container not found');
  });
});

describe('serveHost', () => {
  it('serves the page and the runtime it mounts through, and nothing outside it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'host-'));
    await fs.outputFile(path.join(root, 'runtime', 'layout-adaptors.js'), 'module.exports = {};');
    await fs.outputFile(path.join(root, 'secret.txt'), 'no');
    const host = await serveHost(hostTarget(manifest), { roots: { '/__smt-host/runtime/': path.join(root, 'runtime') } });
    try {
      const base = host.url.replace('localhost', '127.0.0.1');
      const at = (p: string) =>
        new Promise<{ status: number; type: string | undefined; body: string }>((resolve, reject) => {
          http.get(`${base.replace(/\/$/, '')}${p}`, (res) => {
            let body = '';
            res.on('data', (c: Buffer) => (body += c.toString()));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, type: res.headers['content-type'], body }));
          }).on('error', reject);
        });
      const page = await at('/');
      expect(page.body).toContain('<a role="tab" data-capability="HazardSummary" href="#/HazardSummary">HazardSummary</a>');
      const js = await at('/__smt-host/runtime/layout-adaptors.js');
      expect([js.status, js.type]).toEqual([200, 'text/javascript']);
      expect((await at('/__smt-host/runtime/../../secret.txt')).status).toBe(404);
      expect((await at('/elsewhere.js')).status).toBe(404);
    } finally {
      await host.close();
      await fs.remove(root);
    }
  });
});

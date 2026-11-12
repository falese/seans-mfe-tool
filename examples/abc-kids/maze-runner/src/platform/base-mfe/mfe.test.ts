/**
 * abckidsmazerunnerMFE — platform conformance (ADR-129 §10).
 *
 * Generated from mfe-manifest.yaml by remote:generate and regenerated with it:
 * this MFE, constructed from its own manifest, held to the platform contract —
 * every capability (ADR-041), the lifecycle (ADR-042), query (ADR-053, ADR-070),
 * typed errors (ADR-106) — and to everything its manifest declares: each
 * domain capability loads and renders, each lifecycle hook runs where it is
 * declared. Do not edit: change the manifest and regenerate.
 */
import { ValidationError, type Context } from '@seans-mfe-tool/runtime';
import { abckidsmazerunnerMFE } from './mfe';

const manifest = {"name":"abc-kids-maze-runner","version":"1.0.0","type":"remote","language":"typescript","framework":"react","bundler":"rspack","hosts":[{"id":"abc"}],"description":"Maze Runner — steer through the maze to reach the flag!","owner":"abc-kids-team","tags":["kids","game","maze","logic"],"category":"games","endpoint":"http://localhost:3014","remoteEntry":"http://localhost:3014/remoteEntry.js","discovery":"http://localhost:3014/.well-known/mfe-manifest.yaml","capabilities":[{"PlayGame":{"type":"domain","description":"Play the Maze Runner game"}},{"ShowCover":{"type":"domain","description":"Show the Maze Runner game cover card with title and art"}},{"GetGameInfo":{"type":"domain","description":"Return game metadata including title, age range, and description"}},{"Load":{"type":"platform","lifecycle":{"before":[{"onLoadBegin":{"handler":"onLoadBegin","description":"Log load lifecycle entry"}}],"after":[{"onLoadComplete":{"handler":"onLoadComplete","description":"Log load success and available components"}}],"error":[{"onLoadError":{"handler":"onLoadError","description":"Log load failure","contained":true}}]}}},{"Render":{"type":"platform","lifecycle":{"before":[{"onRenderBegin":{"handler":"onRenderBegin","description":"Log render lifecycle entry"}}],"after":[{"onRenderComplete":{"handler":"onRenderComplete","description":"Log render success"}}],"error":[{"onRenderError":{"handler":"onRenderError","description":"Log render failure","contained":true}}]}}}],"dependencies":{"runtime":{"react":"^18.2.0","react-dom":"^18.2.0"},"design-system":{"@mui/material":"^5.14.0","@emotion/react":"^11.11.1","@emotion/styled":"^11.11.0"}}};

/** The platform's capabilities, from @seans-mfe/contracts at generation (ADR-080). */
const PLATFORM_CAPABILITIES = ["describe","load","render","refresh","emit","query","schema","authorizeAccess","health","updateControlPlaneState"];

/** The domain capabilities the manifest declares: what load() offers and render() draws. */
const DOMAIN: string[] = ["PlayGame","ShowCover","GetGameInfo"];

/** Each declared lifecycle hook with a generated handler: its capability, phase and method. */
const HOOKS: Array<{ capability: string; phase: string; handler: string }> = [{"capability":"load","phase":"before","handler":"onLoadBegin"},{"capability":"load","phase":"after","handler":"onLoadComplete"},{"capability":"load","phase":"error","handler":"onLoadError"},{"capability":"render","phase":"before","handler":"onRenderBegin"},{"capability":"render","phase":"after","handler":"onRenderComplete"},{"capability":"render","phase":"error","handler":"onRenderError"}];

/** Where query() sends a document, from the manifest (ADR-053); null when it has no BFF (ADR-070). */
const BFF_URL: string | null = null;

const ctx = (inputs: Record<string, unknown> = {}): Context => ({ requestId: 'conformance', timestamp: new Date(), inputs }) as Context;
type Hookable = Record<string, (...args: unknown[]) => Promise<void>>;
type Deps = ConstructorParameters<typeof abckidsmazerunnerMFE>[1];

/** Wait for an element to show something: React 18 mounts asynchronously. */
async function drawn(id: string, ms = 2000): Promise<boolean> {
  const end = Date.now() + ms;
  for (;;) {
    if ((document.getElementById(id)?.childNodes.length ?? 0) > 0) return true;
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 10));
  }
}

/**
 * jsdom has no canvas: getContext answers null, and a capability that draws would fail on
 * jsdom, not on itself. A stand-in context accepts any call or property, so drawing code
 * runs and the capability is held to rendering; what it draws is the journey spec's.
 */
function standIn(): unknown {
  return new Proxy(function standInContext() {}, {
    get: (_t, key) => (key === 'then' ? undefined : key === Symbol.toPrimitive ? () => 0 : standIn()),
    apply: () => standIn(),
    construct: () => standIn() as object,
    set: () => true,
  });
}

function container(id: string): string {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return id;
}

describe('abckidsmazerunnerMFE — platform conformance', () => {
  let mfe: abckidsmazerunnerMFE;
  const quiet: jest.SpyInstance[] = [];

  beforeEach(() => {
    jest.useRealTimers();
    if (typeof HTMLCanvasElement !== 'undefined') {
      quiet.push(jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => standIn() as never));
    }
    quiet.push(jest.spyOn(console, 'log').mockImplementation(() => undefined));
    mfe = new abckidsmazerunnerMFE(manifest);
  });
  afterEach(() => {
    quiet.splice(0).forEach((s) => s.mockRestore());
    document.body.innerHTML = '';
  });

  describe('every platform capability (ADR-041)', () => {
    it.each(PLATFORM_CAPABILITIES)('%s', (name) => {
      expect(typeof (mfe as unknown as Record<string, unknown>)[name]).toBe('function');
    });
  });

  describe('lifecycle (ADR-042)', () => {
    it('starts uninitialized', () => {
      expect(mfe.getState()).toBe('uninitialized');
    });

    it('loads to ready, offering exactly the domain capabilities the manifest declares', async () => {
      const result = await mfe.load(ctx());
      expect(result.status).toBe('loaded');
      expect(mfe.getState()).toBe('ready');
      expect([...(result.availableComponents ?? [])].sort()).toEqual([...DOMAIN].sort());
    });

    it('refuses to render before it has loaded', async () => {
      await expect(mfe.render(ctx({ component: DOMAIN[0] ?? 'Any', containerId: 'nowhere' }))).rejects.toThrow(/Invalid state/);
    });
  });

  describe('each domain capability renders', () => {
    if (DOMAIN.length > 0) {
      it.each(DOMAIN)('%s', async (component) => {
        await mfe.load(ctx());
        const id = container(`conformance-${component}`);
        const result = await mfe.render(ctx({ component, containerId: id }));
        expect(result.status).toBe('rendered');
        expect(mfe.getState()).toBe('ready');
        expect(await drawn(id)).toBe(true);
      });
    }

    it('answers a component it does not have with a typed ValidationError', async () => {
      await mfe.load(ctx());
      const result = await mfe.render(ctx({ component: 'NotACapability', containerId: 'x' }));
      expect(result.status).toBe('error');
      expect(result.error).toBeInstanceOf(ValidationError);
    });
  });

  describe('the other platform capabilities answer as the contract says', () => {
    beforeEach(async () => {
      await mfe.load(ctx());
    });

    it('health: healthy, its container and components checked', async () => {
      const h = await mfe.health(ctx());
      expect(h.status).toBe('healthy');
      expect(h.checks.filter((c) => c.status !== 'pass').map((c) => c.name)).toEqual(DOMAIN.length > 0 ? [] : ['components']);
    });

    it('describe: its own name and version, and every capability it declares', async () => {
      const d = await mfe.describe(ctx());
      expect(d.name).toBe(manifest.name);
      expect(d.version).toBe(manifest.version);
      expect(d.capabilities).toEqual(expect.arrayContaining(DOMAIN));
    });

    it('schema: its manifest, as JSON', async () => {
      const s = await mfe.schema(ctx());
      expect(s.format).toBe('json');
      expect((JSON.parse(s.schema) as { name: string }).name).toBe(manifest.name);
    });

    it('authorizeAccess: a boolean', async () => {
      expect(typeof (await mfe.authorizeAccess(ctx()))).toBe('boolean');
    });

    it('refresh: resolves', async () => {
      await expect(mfe.refresh(ctx())).resolves.toBeUndefined();
    });

    it('emit: nothing without telemetry; the event, with it', async () => {
      expect((await mfe.emit(ctx({ event: { eventName: 'conformance' } }))).emitted).toBe(false);
      const telemetry = { emit: jest.fn() };
      const observed = new abckidsmazerunnerMFE(manifest, { telemetry } as unknown as Deps);
      await observed.load(ctx());
      const event = { eventType: 'info', eventName: 'conformance' };
      expect((await observed.emit(ctx({ event }))).emitted).toBe(true);
      expect(telemetry.emit).toHaveBeenCalledWith(event);
    });

    it('updateControlPlaneState: not acknowledged, and says why, with no control plane attached', async () => {
      const r = await mfe.updateControlPlaneState(ctx({ stateKey: 'conformance.check', stateData: {} }));
      expect(r.acknowledged).toBe(false);
      expect(r.error).toMatch(/not connected/);
    });

    if (BFF_URL === null) {
      it('query: no BFF, so no data and no request (ADR-070)', async () => {
        await expect(mfe.query(ctx({ document: '{ __typename }' }))).resolves.toEqual({ data: null });
      });
    } else {
      it('query: refuses a request with no document, with a typed error', async () => {
        await expect(mfe.query(ctx())).rejects.toMatchObject({ name: 'ValidationError' });
      });

      it('query: asks its own BFF, and answers a transport failure in the envelope (ADR-053 §3, ADR-106)', async () => {
        const saved = globalThis.fetch;
        const asked: string[] = [];
        globalThis.fetch = (async (url: string) => {
          asked.push(String(url));
          throw new TypeError('network down');
        }) as unknown as typeof fetch;
        try {
          const r = await mfe.query(ctx({ document: '{ __typename }' }));
          expect(asked).toEqual([BFF_URL]);
          expect(r.data ?? null).toBeNull();
          expect(r.errors?.length ?? 0).toBeGreaterThan(0);
        } finally {
          globalThis.fetch = saved;
        }
      });
    }
  });

  describe('each declared lifecycle hook runs where the manifest puts it', () => {
    const succeed = async (capability: string): Promise<void> => {
      await mfe.load(ctx());
      if (capability === 'render' && DOMAIN.length > 0) await mfe.render(ctx({ component: DOMAIN[0], containerId: container('conformance-hooks') }));
    };
    const fail = async (capability: string): Promise<void> => {
      if (capability === 'load') {
        jest.spyOn(mfe as unknown as { fetchContainer: () => Promise<unknown> }, 'fetchContainer').mockRejectedValue(new Error('conformance: entry unreachable'));
        expect((await mfe.load(ctx())).status).toBe('error');
        return;
      }
      await mfe.load(ctx());
      expect((await mfe.render(ctx({ component: 'NotACapability', containerId: 'x' }))).status).toBe('error');
    };
    const success = HOOKS.filter((h) => h.phase !== 'error' && (h.capability === 'load' || DOMAIN.length > 0));
    const failure = HOOKS.filter((h) => h.phase === 'error');

    if (success.length > 0) {
      it.each(success)('$capability $phase: $handler', async (h) => {
        const spy = jest.spyOn(mfe as unknown as Hookable, h.handler);
        await succeed(h.capability);
        expect(spy).toHaveBeenCalled();
      });
    }

    if (failure.length > 0) {
      it.each(failure)('$capability error: $handler, when $capability fails — and no after hook', async (h) => {
        const spy = jest.spyOn(mfe as unknown as Hookable, h.handler);
        const after = HOOKS.filter((x) => x.capability === h.capability && x.phase === 'after').map((x) => jest.spyOn(mfe as unknown as Hookable, x.handler));
        await fail(h.capability);
        expect(spy).toHaveBeenCalled();
        for (const a of after) expect(a).not.toHaveBeenCalled();
      });
    }

    it('runs before hooks ahead of after hooks', async () => {
      const order: string[] = [];
      for (const h of HOOKS.filter((x) => x.capability === 'load' && x.phase !== 'error')) {
        jest.spyOn(mfe as unknown as Hookable, h.handler).mockImplementation(async () => {
          order.push(h.phase);
        });
      }
      await succeed('load');
      const rank = (p: string) => ['before', 'main', 'after'].indexOf(p);
      expect(order).toEqual([...order].sort((a, b) => rank(a) - rank(b)));
    });
  });
});

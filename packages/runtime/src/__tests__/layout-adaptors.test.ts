import type { RenderedExperience } from '@seans-mfe/contracts';
import {
  moduleFederationAdaptor,
  type SlotElementLike,
} from '../layout-adaptors';

class FakeSlot implements SlotElementLike {
  innerHTML = '';
  children: unknown[] = [];

  appendChild(child: unknown): unknown {
    this.children.push(child);
    return child;
  }

  remove(): void {}
  setAttribute(): void {}
  addEventListener(): void {}
}

describe('moduleFederationAdaptor', () => {
  const scope = 'legacy_rebind_test';
  const globalScope = globalThis as unknown as Record<string, unknown>;

  afterEach(() => {
    delete globalScope[scope];
    delete globalScope.document;
  });

  it('unmounts only the rendered container so a legacy singleton can rebind', async () => {
    const renders: string[] = [];
    const unmounts: string[] = [];
    const destroy = jest.fn();
    const mfe = {
      render: async (context: {
        inputs?: { containerId?: string };
      }): Promise<void> => {
        renders.push(context.inputs?.containerId ?? '');
      },
      unmount: (containerId: string): void => {
        unmounts.push(containerId);
      },
      destroy,
    };
    globalScope[scope] = {
      init: async (): Promise<void> => undefined,
      get: async (): Promise<() => { mfe: typeof mfe }> => () => ({ mfe }),
    };
    globalScope.document = {
      createElement: (): { id: string } => ({ id: '' }),
    };

    const experience: RenderedExperience = {
      id: 'game',
      mfe: 'game',
      capability: 'Play',
      contentType: 'module-federation',
      output: {
        remoteEntryUrl: 'http://example.test/remoteEntry.js',
        scope,
        module: './App',
      },
      createdAt: new Date().toISOString(),
    };
    const helpers = {
      sendAction: async (): Promise<void> => undefined,
      reportError: (): void => undefined,
    };

    const firstUnmount = await moduleFederationAdaptor.mount(
      experience,
      new FakeSlot(),
      helpers
    );
    await firstUnmount?.();
    const secondUnmount = await moduleFederationAdaptor.mount(
      experience,
      new FakeSlot(),
      helpers
    );

    expect(renders).toEqual(['layout-mfe-game', 'layout-mfe-game']);
    expect(unmounts).toEqual(['layout-mfe-game']);
    expect(destroy).not.toHaveBeenCalled();

    await secondUnmount?.();
    expect(unmounts).toEqual(['layout-mfe-game', 'layout-mfe-game']);
  });
});

describe('moduleFederationAdaptor mount serialization (keyed-slot fan-out)', () => {
  const scope = 'serialization_test';
  const globalScope = globalThis as unknown as Record<string, unknown>;

  // The overlap test really waits wall-clock time for the second mount to
  // (not) start; the global fake timers would park the sleep forever.
  beforeEach(() => jest.useRealTimers());
  afterEach(() => {
    jest.useFakeTimers();
    delete globalScope[scope];
    delete globalScope.document;
  });

  const makeExperience = (id: string): RenderedExperience => ({
    id,
    mfe: 'tiles',
    capability: 'BerthTile',
    contentType: 'module-federation',
    output: {
      remoteEntryUrl: 'http://example.test/remoteEntry.js',
      scope,
      module: './Component',
    },
    createdAt: new Date().toISOString(),
  });
  const helpers = {
    sendAction: async (): Promise<void> => undefined,
    reportError: (): void => undefined,
  };

  it('never overlaps two renders of the same remote scope (ADR-042 gate)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const started: string[] = [];
    let releaseFirst: () => void = () => undefined;

    const mfe = {
      render: async (context: { inputs?: { containerId?: string } }): Promise<void> => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        started.push(context.inputs?.containerId ?? '');
        if (started.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
        inFlight -= 1;
      },
      unmount: (): void => undefined,
    };
    globalScope[scope] = {
      init: async (): Promise<void> => undefined,
      get: async (): Promise<() => { mfe: typeof mfe }> => () => ({ mfe }),
    };
    globalScope.document = {
      createElement: (): { id: string } => ({ id: '' }),
    };

    // Two keyed-slot placements of the same MFE arrive together (the
    // console fires one action per berth on mount).
    const first = moduleFederationAdaptor.mount(makeExperience('tile-b1'), new FakeSlot(), helpers);
    const second = moduleFederationAdaptor.mount(makeExperience('tile-b2'), new FakeSlot(), helpers);

    // Give the second mount every chance to start while the first hangs.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(started).toEqual(['layout-mfe-tile-b1']);

    releaseFirst();
    await Promise.all([first, second]);

    expect(started).toEqual(['layout-mfe-tile-b1', 'layout-mfe-tile-b2']);
    expect(maxInFlight).toBe(1);
  });

  it('keeps the queue alive after a failed mount', async () => {
    const started: string[] = [];
    const mfe = {
      render: async (context: { inputs?: { containerId?: string } }): Promise<void> => {
        started.push(context.inputs?.containerId ?? '');
        if (started.length === 1) throw new Error('first mount exploded');
      },
      unmount: (): void => undefined,
    };
    globalScope[scope] = {
      init: async (): Promise<void> => undefined,
      get: async (): Promise<() => { mfe: typeof mfe }> => () => ({ mfe }),
    };
    globalScope.document = {
      createElement: (): { id: string } => ({ id: '' }),
    };

    await expect(
      moduleFederationAdaptor.mount(makeExperience('boom'), new FakeSlot(), helpers)
    ).rejects.toThrow('first mount exploded');
    await expect(
      moduleFederationAdaptor.mount(makeExperience('after'), new FakeSlot(), helpers)
    ).resolves.toBeDefined();
    expect(started).toEqual(['layout-mfe-boom', 'layout-mfe-after']);
  });
});

/**
 * The shell loads only remotes from origins it was told to trust (ADR-124).
 *
 * A placement arrives from the control plane carrying a `remoteEntryUrl`, and
 * the adaptor injects it as a <script> into the shell's own page. Whoever can
 * put a URL in a placement runs code as the shell. The registry's write token
 * is the first guard; this is the second, and the one the shell owns: an
 * allow-list of origins, checked before anything is fetched.
 */
import { SecurityError } from '@seans-mfe/contracts';
import { remoteOriginAllowed, createModuleFederationAdaptor, defaultAdaptors } from '../layout-adaptors';

describe('remoteOriginAllowed', () => {
  const allowed = ['https://mfe.example.com', 'http://localhost:5001'];
  const page = 'https://shell.example.com';

  it.each([
    'https://mfe.example.com/remoteEntry.js',
    'http://localhost:5001/remoteEntry.js',
    'https://mfe.example.com:443/deep/path/remoteEntry.js?v=2',
  ])('allows %s', (url) => {
    expect(remoteOriginAllowed(url, allowed, page)).toBe(true);
  });

  it('allows a relative URL: it is the shell’s own origin', () => {
    expect(remoteOriginAllowed('/wasm/remoteEntry.js', allowed, page)).toBe(true);
  });

  it.each([
    ['another host', 'https://evil.example/remoteEntry.js'],
    ['a look-alike host', 'https://mfe.example.com.evil.example/remoteEntry.js'],
    ['the right host on another scheme', 'http://mfe.example.com/remoteEntry.js'],
    ['the right host on another port', 'http://localhost:5002/remoteEntry.js'],
    ['userinfo dressed as the host', 'https://mfe.example.com@evil.example/remoteEntry.js'],
    ['a protocol-relative URL to another host', '//evil.example/remoteEntry.js'],
    ['a data URL', 'data:text/javascript,alert(1)'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['something that is not a URL', 'http://'],
  ])('refuses %s', (_label, url) => {
    expect(remoteOriginAllowed(url, allowed, page)).toBe(false);
  });

  it('refuses a relative URL when there is no page to resolve it against', () => {
    expect(remoteOriginAllowed('/remoteEntry.js', allowed, undefined)).toBe(false);
  });

  it('ignores a trailing slash or path on a configured origin', () => {
    expect(remoteOriginAllowed('https://mfe.example.com/r.js', ['https://mfe.example.com/'], page)).toBe(true);
  });
});

describe('a module-federation adaptor with an allow-list', () => {
  const experience = (remoteEntryUrl: string): RenderedExperience =>
    ({
      id: 'exp-1',
      contentType: 'module-federation',
      output: { remoteEntryUrl, scope: 'some_scope', module: './App' },
    }) as unknown as RenderedExperience;
  const helpers = {} as never;

  it('refuses a remote from an origin it was not given, before touching the page', async () => {
    const adaptor = createModuleFederationAdaptor({ allowedOrigins: ['https://mfe.example.com'] });
    const slot = new FakeSlot();

    await expect(adaptor.mount(experience('https://evil.example/remoteEntry.js'), slot, helpers)).rejects.toThrow(
      SecurityError,
    );
    await expect(adaptor.mount(experience('https://evil.example/remoteEntry.js'), slot, helpers)).rejects.toThrow(
      /evil\.example/,
    );
    expect(slot.children).toEqual([]);
  });

  it('is what LayoutManager’s default adaptors carry when origins are named', async () => {
    const adaptors = defaultAdaptors({ allowedRemoteOrigins: ['https://mfe.example.com'] });
    await expect(
      adaptors['module-federation'].mount(experience('https://evil.example/remoteEntry.js'), new FakeSlot(), helpers),
    ).rejects.toThrow(SecurityError);
  });

  it('still reports an incomplete placement as that, not as an origin problem', async () => {
    const adaptor = createModuleFederationAdaptor({ allowedOrigins: ['https://mfe.example.com'] });
    const incomplete = { id: 'exp-2', contentType: 'module-federation', output: { scope: 's' } } as unknown as RenderedExperience;
    await expect(adaptor.mount(incomplete, new FakeSlot(), helpers)).rejects.toThrow(/missing/);
  });
});

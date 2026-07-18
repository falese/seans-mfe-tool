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

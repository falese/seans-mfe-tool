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

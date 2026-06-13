/**
 * React composition provider tests (ADR-056).
 *
 * CI-only: needs react + @testing-library/react + jsdom, which are not
 * installed in every environment. The shell's jsdom suite is the integration
 * cover; this pins the provider unit behavior (mounts the imperative handle,
 * tears it down on unmount, surfaces a missing handle).
 */
import * as React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { MfeHost } from '../MfeHost';
import type { ImperativeMountHandle, PresentationHandles } from '@seans-mfe/contracts';

afterEach(() => cleanup());

function handle(spy: { mounted: number; unmounted: number; el?: unknown }): ImperativeMountHandle {
  return {
    kind: 'imperative-dom',
    framework: 'react',
    mount: (element) => {
      spy.mounted += 1;
      spy.el = element;
      return () => {
        spy.unmounted += 1;
      };
    },
  };
}

describe('MfeHost (React composition provider)', () => {
  it('mounts the imperative handle into the React-managed element', async () => {
    const spy = { mounted: 0, unmounted: 0 };
    await act(async () => {
      render(<MfeHost handles={handle(spy)} props={{ level: 1 }} />);
    });
    expect(spy.mounted).toBe(1);
    expect(spy.el).toBeTruthy();
  });

  it('tears the MFE down when React unmounts the host', async () => {
    const spy = { mounted: 0, unmounted: 0 };
    let unmountTree: () => void = () => undefined;
    await act(async () => {
      const r = render(<MfeHost handles={handle(spy)} />);
      unmountTree = r.unmount;
    });
    await act(async () => unmountTree());
    expect(spy.unmounted).toBe(1);
  });

  it('accepts a full handle bundle and mounts its imperative floor', async () => {
    const spy = { mounted: 0, unmounted: 0 };
    const bundle: PresentationHandles = { imperative: handle(spy) };
    await act(async () => {
      render(<MfeHost handles={bundle} />);
    });
    expect(spy.mounted).toBe(1);
  });

  it('calls onError when no imperative handle is present', async () => {
    const errors: unknown[] = [];
    await act(async () => {
      render(
        <MfeHost
          handles={{ imperative: undefined } as unknown as PresentationHandles}
          onError={(e) => errors.push(e)}
        />
      );
    });
    expect(errors).toHaveLength(1);
  });
});

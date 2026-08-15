/**
 * @jest-environment jsdom
 *
 * useControlPlaneState tests. Same posture as MfeHost.test.tsx/
 * DeclaredSlot.test.tsx (react + @testing-library/react devDependencies,
 * root testMatch includes .tsx, this file's own @jest-environment pragma).
 */
import * as React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { useControlPlaneState, type ControlPlaneStatePusherLike } from '../useControlPlaneState';

afterEach(() => cleanup());

function fakeMfe() {
  const calls: unknown[] = [];
  const mfe: ControlPlaneStatePusherLike & { calls: unknown[] } = {
    calls,
    async updateControlPlaneState(context) {
      calls.push(context);
      return { acknowledged: true, correlationId: (context as { requestId: string }).requestId, error: null };
    },
  };
  return mfe;
}

/** Renders the hook and exposes the returned pusher to the test. */
function Probe({ mfe, onReady }: { mfe: ControlPlaneStatePusherLike; onReady: (push: ReturnType<typeof useControlPlaneState>) => void }) {
  const push = useControlPlaneState(mfe);
  // No dependency array: must run after every render (not just when `push`
  // changes) so the stability test below can observe `push`'s identity on
  // each render, not just the first one.
  React.useEffect(() => {
    onReady(push);
  });
  return null;
}

describe('useControlPlaneState', () => {
  it('returns a function that builds a Context and calls updateControlPlaneState', async () => {
    const mfe = fakeMfe();
    let push: ReturnType<typeof useControlPlaneState> | undefined;
    await act(async () => {
      render(<Probe mfe={mfe} onReady={(p) => { push = p; }} />);
    });

    await act(async () => {
      await push!('analysis.complete', { resultId: 'r1' });
    });

    expect(mfe.calls).toHaveLength(1);
    const ctx = mfe.calls[0] as { requestId: string; timestamp: Date; inputs: Record<string, unknown> };
    expect(typeof ctx.requestId).toBe('string');
    expect(ctx.timestamp).toBeInstanceOf(Date);
    expect(ctx.inputs.stateKey).toBe('analysis.complete');
    expect(ctx.inputs.stateData).toEqual({ resultId: 'r1' });
  });

  it('forwards an explicit correlationId', async () => {
    const mfe = fakeMfe();
    let push: ReturnType<typeof useControlPlaneState> | undefined;
    await act(async () => {
      render(<Probe mfe={mfe} onReady={(p) => { push = p; }} />);
    });

    await act(async () => {
      await push!('x', {}, { correlationId: 'corr-1' });
    });

    const ctx = mfe.calls[0] as { inputs: Record<string, unknown> };
    expect(ctx.inputs.correlationId).toBe('corr-1');
  });

  it('returns a stable function reference across re-renders while mfe stays the same', async () => {
    const mfe = fakeMfe();
    const seen: unknown[] = [];
    const onReady = (p: ReturnType<typeof useControlPlaneState>) => seen.push(p);
    let rerender: (ui: React.ReactElement) => void = () => undefined;

    await act(async () => {
      const r = render(<Probe mfe={mfe} onReady={onReady} />);
      rerender = r.rerender;
    });
    await act(async () => {
      rerender(<Probe mfe={mfe} onReady={onReady} />);
    });

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });

  it('returns whatever the underlying call returns', async () => {
    const mfe = fakeMfe();
    let push: ReturnType<typeof useControlPlaneState> | undefined;
    await act(async () => {
      render(<Probe mfe={mfe} onReady={(p) => { push = p; }} />);
    });

    let result: unknown;
    await act(async () => {
      result = await push!('x', {});
    });
    expect((result as { acknowledged: boolean }).acknowledged).toBe(true);
  });
});

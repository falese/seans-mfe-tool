/**
 * pushControlPlaneState — thin sugar over the inherited updateControlPlaneState
 * platform capability (BaseMFE). Every real call site (StationConsole.tsx,
 * GameMenu.tsx) hand-rolled the same Context boilerplate and a narrow cast to
 * avoid importing the full Context type; this replaces both.
 */
import { pushControlPlaneState, type ControlPlaneStatePusher } from '../control-plane-state';
import type { Context } from '../context';
import type { ControlPlaneStateResult } from '../base-mfe';

function fakeMfe() {
  const calls: Context[] = [];
  const mfe: ControlPlaneStatePusher & { calls: Context[] } = {
    calls,
    async updateControlPlaneState(context: Context): Promise<ControlPlaneStateResult> {
      calls.push(context);
      return { acknowledged: true, correlationId: context.requestId, error: null };
    },
  };
  return mfe;
}

describe('pushControlPlaneState', () => {
  it('builds a Context with requestId and timestamp filled in', async () => {
    const mfe = fakeMfe();
    await pushControlPlaneState(mfe, 'analysis.complete', { resultId: 'r1' });

    expect(mfe.calls).toHaveLength(1);
    const ctx = mfe.calls[0];
    expect(typeof ctx.requestId).toBe('string');
    expect(ctx.requestId.length).toBeGreaterThan(0);
    expect(ctx.timestamp).toBeInstanceOf(Date);
  });

  it('passes stateKey and stateData through as inputs', async () => {
    const mfe = fakeMfe();
    await pushControlPlaneState(mfe, 'analysis.complete', { resultId: 'r1', rowCount: 42 });

    const { inputs } = mfe.calls[0];
    expect(inputs?.stateKey).toBe('analysis.complete');
    expect(inputs?.stateData).toEqual({ resultId: 'r1', rowCount: 42 });
  });

  it('defaults correlationId to undefined so the platform falls back to requestId', async () => {
    const mfe = fakeMfe();
    await pushControlPlaneState(mfe, 'analysis.complete', {});

    expect(mfe.calls[0].inputs?.correlationId).toBeUndefined();
  });

  it('forwards an explicit correlationId when given', async () => {
    const mfe = fakeMfe();
    await pushControlPlaneState(mfe, 'analysis.complete', {}, { correlationId: 'corr-123' });

    expect(mfe.calls[0].inputs?.correlationId).toBe('corr-123');
  });

  it('tags the context with the updateControlPlaneState capability', async () => {
    const mfe = fakeMfe();
    await pushControlPlaneState(mfe, 'analysis.complete', {});

    expect(mfe.calls[0].capability).toBe('updateControlPlaneState');
  });

  it('returns whatever the underlying call returns', async () => {
    const mfe = fakeMfe();
    const result = await pushControlPlaneState(mfe, 'analysis.complete', {});
    expect(result.acknowledged).toBe(true);
  });

  it('requires no import of the full Context type at the call site — a minimal structural mfe works', async () => {
    // The whole point: callers only need { updateControlPlaneState }, not BaseMFE.
    const minimal = {
      updateControlPlaneState: async (ctx: Context) => ({
        acknowledged: true,
        correlationId: ctx.requestId,
        error: null,
      }),
    };
    const result = await pushControlPlaneState(minimal, 'x', {});
    expect(result.acknowledged).toBe(true);
  });
});

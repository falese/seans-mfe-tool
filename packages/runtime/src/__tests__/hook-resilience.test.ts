/**
 * Hook-level timeout and retry (ADR-029, ADR-030) — wired into BaseMFE.executeHook.
 *
 * `withTimeout` and `withRetry` were implemented and unit-tested long before
 * anything called them (#383). These tests pin the wiring: a manifest that
 * declares `timeout` / `errorHandling` on a lifecycle hook gets that behaviour
 * from the real engine, and a manifest that declares neither behaves exactly
 * as it did before — one attempt, no timer.
 */

import { BaseMFE, type Context } from '../base-mfe';
import { NetworkError, ValidationError, TimeoutError } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';

// Real delays: the wrappers race real timers, and the delays here are 1–20ms.
jest.useRealTimers();

type Handler = (context: Context) => Promise<void>;

class Probe extends BaseMFE {
  protected async doLoad() { return { status: 'loaded' as const, timestamp: new Date() }; }
  protected async doRender() { return { status: 'rendered' as const, timestamp: new Date() }; }
  protected async doRefresh() { }
  protected async doAuthorizeAccess() { return true; }
  protected async doHealth() { return { status: 'healthy' as const, checks: [], timestamp: new Date() }; }
  protected async doDescribe() { return { name: '', version: '', type: '', capabilities: [], manifest: this.manifest }; }
  protected async doSchema() { return { schema: '', format: 'graphql' as const }; }
  protected async doQuery() { return { data: {} }; }
  protected async doEmit() { return { emitted: true }; }
}

function probe(hook: Record<string, unknown>, handlers: Record<string, Handler>, phase = 'main'): Probe {
  const manifest = {
    name: 'probe',
    version: '1.0.0',
    type: 'tool',
    capabilities: [{ load: { type: 'platform', lifecycle: { [phase]: [{ step: { handler: 'custom.step', ...hook } }] } } }],
  } as unknown as DSLManifest;
  return new Probe(manifest, { customHandlers: handlers, telemetry: { emit: () => undefined } });
}

const run = (mfe: Probe, phase = 'main'): Promise<void> =>
  (mfe as unknown as { executeLifecycle(c: string, p: string, ctx: Context): Promise<void> })
    .executeLifecycle('load', phase, { timestamp: new Date(), requestId: 'r' } as Context);

const never = (): Promise<void> => new Promise(() => undefined);

describe('hook timeout (ADR-029)', () => {
  it('fails a main-phase hook that exceeds its timeout with a TimeoutError', async () => {
    const mfe = probe({ timeout: 20 }, { 'custom.step': never });
    await expect(run(mfe)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("continues past a timed-out hook when onTimeout is 'skip'", async () => {
    const mfe = probe({ timeout: 20, onTimeout: 'skip' }, { 'custom.step': never });
    await expect(run(mfe)).resolves.toBeUndefined();
  });

  it('hands the handler an AbortSignal that fires on timeout', async () => {
    let signal: AbortSignal | undefined;
    const mfe = probe({ timeout: 20, onTimeout: 'skip' }, {
      'custom.step': async (ctx) => { signal = ctx.signal; await never(); },
    });
    await run(mfe);
    expect(signal?.aborted).toBe(true);
  });

  it('arms no timer when the hook declares no timeout', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const mfe = probe({}, { 'custom.step': async () => undefined });
    await run(mfe);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});

describe('hook retry (ADR-030)', () => {
  const retryNetwork = {
    errorHandling: { types: [{ type: 'network', retryable: true, maxRetries: 2, baseDelay: 1, maxDelay: 1 }] },
  };

  it('retries a retryable typed error up to maxRetries, then succeeds', async () => {
    let calls = 0;
    const mfe = probe(retryNetwork, {
      'custom.step': async () => { calls += 1; if (calls < 3) throw new NetworkError('flaky', 503); },
    });
    await expect(run(mfe)).resolves.toBeUndefined();
    expect(calls).toBe(3);
  });

  it('gives up after maxRetries and propagates the last error', async () => {
    let calls = 0;
    const mfe = probe(retryNetwork, {
      'custom.step': async () => { calls += 1; throw new NetworkError('down', 503); },
    });
    await expect(run(mfe)).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toBe(3);
  });

  it('never retries a non-retryable error, whatever the manifest says', async () => {
    let calls = 0;
    const mfe = probe(
      { errorHandling: { types: [{ type: 'validation', retryable: true, maxRetries: 5, baseDelay: 1 }] } },
      { 'custom.step': async () => { calls += 1; throw new ValidationError('bad', 'f', 'required'); } },
    );
    await expect(run(mfe)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toBe(1);
  });

  it('does not retry a type the manifest gives no maxRetries for', async () => {
    let calls = 0;
    const mfe = probe({}, { 'custom.step': async () => { calls += 1; throw new NetworkError('down', 503); } });
    await expect(run(mfe)).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toBe(1);
  });

  it('never retries on the strength of a pattern-only entry', async () => {
    let calls = 0;
    const mfe = probe(
      { errorHandling: { types: [{ type: 'network', pattern: 'ECONNRESET', retryable: true }] } },
      { 'custom.step': async () => { calls += 1; throw new Error('socket ECONNRESET'); } },
    );
    await expect(run(mfe)).rejects.toThrow('ECONNRESET');
    expect(calls).toBe(1);
  });

  it('classifies an untyped error by pattern and retries it', async () => {
    let calls = 0;
    const mfe = probe(
      { errorHandling: { types: [{ type: 'network', pattern: 'ECONNRESET', retryable: true, maxRetries: 1, baseDelay: 1 }] } },
      { 'custom.step': async () => { calls += 1; if (calls === 1) throw new Error('socket ECONNRESET'); } },
    );
    await expect(run(mfe)).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });

  it('runs onRetry before each retry and the fallback once retries are exhausted', async () => {
    const order: string[] = [];
    const mfe = probe(
      {
        errorHandling: {
          types: [{
            type: 'network', retryable: true, maxRetries: 1, baseDelay: 1,
            onRetry: 'custom.reconnect', fallbackHandler: 'custom.useCache',
          }],
        },
      },
      {
        'custom.step': async () => { order.push('step'); throw new NetworkError('down', 503); },
        'custom.reconnect': async () => { order.push('reconnect'); },
        'custom.useCache': async () => { order.push('fallback'); },
      },
    );
    await expect(run(mfe)).resolves.toBeUndefined();
    expect(order).toEqual(['step', 'reconnect', 'step', 'fallback']);
  });

  it('retries a timeout when timeout is declared retryable — each attempt gets its own timer', async () => {
    let calls = 0;
    const mfe = probe(
      { timeout: 20, errorHandling: { types: [{ type: 'timeout', retryable: true, maxRetries: 1, baseDelay: 1 }] } },
      { 'custom.step': async () => { calls += 1; if (calls === 1) await never(); } },
    );
    await expect(run(mfe)).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});

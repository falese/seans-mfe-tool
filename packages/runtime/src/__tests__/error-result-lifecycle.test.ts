/**
 * A capability that reports failure in its result runs its error lifecycle
 * (ADR-042, REQ-042).
 *
 * `doLoad` and `doRender` answer a failure as `{ status: 'error' }` rather than
 * by throwing — the envelope contract a caller reads. The capability pipeline
 * ran a manifest's `error` hooks only on a throw, so a declared `onLoadError`
 * or `onRenderError` never fired on an ordinary failure, and `after` hooks
 * (`onLoadComplete`) ran as if it had succeeded. Found by the generated
 * platform conformance suite (ADR-129 §10).
 *
 * What this does not change: the lifecycle state after such a failure. That is
 * a separate question (one MFE instance renders into many slots).
 */

import { BaseMFE, type Context } from '../base-mfe';
import type { DSLManifest } from '@seans-mfe/dsl';

jest.useRealTimers();

type Handler = (context: Context) => Promise<void>;

class Failing extends BaseMFE {
  loadFails = false;
  renderFails = false;
  protected async doLoad() {
    return this.loadFails
      ? { status: 'error' as const, timestamp: new Date(), error: { message: 'entry unreachable', phase: 'entry' as const, retryCount: 0, retryable: true } }
      : { status: 'loaded' as const, timestamp: new Date() };
  }
  protected async doRender() {
    return this.renderFails
      ? { status: 'error' as const, timestamp: new Date(), error: new Error('no such component') }
      : { status: 'rendered' as const, timestamp: new Date() };
  }
  protected async doRefresh() {}
  protected async doAuthorizeAccess() {
    return true;
  }
  protected async doHealth() {
    return { status: 'healthy' as const, checks: [], timestamp: new Date() };
  }
  protected async doDescribe() {
    return { name: '', version: '', type: '', capabilities: [], manifest: this.manifest };
  }
  protected async doSchema() {
    return { schema: '', format: 'graphql' as const };
  }
  protected async doQuery() {
    return { data: {} };
  }
  protected async doEmit() {
    return { emitted: true };
  }
}

function make(calls: string[], seen: Array<Error | undefined>): Failing {
  const hook = (name: string): Handler => async (ctx) => {
    calls.push(name);
    if (name.endsWith('Error')) seen.push((ctx as Context & { error?: Error }).error);
  };
  const lifecycle = (cap: string) => ({
    before: [{ b: { handler: `custom.${cap}Begin` } }],
    after: [{ a: { handler: `custom.${cap}Complete` } }],
    error: [{ e: { handler: `custom.${cap}Error`, contained: true } }],
  });
  const manifest = {
    name: 'failing',
    version: '1.0.0',
    type: 'tool',
    capabilities: [{ load: { type: 'platform', lifecycle: lifecycle('load') } }, { render: { type: 'platform', lifecycle: lifecycle('render') } }],
  } as unknown as DSLManifest;
  const handlers: Record<string, Handler> = {};
  for (const cap of ['load', 'render']) for (const p of ['Begin', 'Complete', 'Error']) handlers[`custom.${cap}${p}`] = hook(`${cap}${p}`);
  return new Failing(manifest, { customHandlers: handlers, telemetry: { emit: () => undefined } });
}

const ctx = (inputs: Record<string, unknown> = {}): Context => ({ requestId: 'r', timestamp: new Date(), inputs }) as Context;

describe('a capability reporting failure in its result (ADR-042)', () => {
  it('runs the error hooks, not the after hooks, when load reports an error', async () => {
    const calls: string[] = [];
    const seen: Array<Error | undefined> = [];
    const mfe = make(calls, seen);
    mfe.loadFails = true;
    const result = await mfe.load(ctx());
    expect(result.status).toBe('error');
    expect(calls).toEqual(['loadBegin', 'loadError']);
    expect(seen[0]?.message).toBe('entry unreachable');
  });

  it('does the same for render, and hands the hook the error the result carries', async () => {
    const calls: string[] = [];
    const seen: Array<Error | undefined> = [];
    const mfe = make(calls, seen);
    await mfe.load(ctx());
    mfe.renderFails = true;
    const result = await mfe.render(ctx({ component: 'X', containerId: 'c' }));
    expect(result.status).toBe('error');
    expect(calls).toEqual(['loadBegin', 'loadComplete', 'renderBegin', 'renderError']);
    expect(seen[0]?.message).toBe('no such component');
  });

  it('leaves success as it was: before, then after, no error hook', async () => {
    const calls: string[] = [];
    const mfe = make(calls, []);
    await mfe.load(ctx());
    await mfe.render(ctx({ component: 'X', containerId: 'c' }));
    expect(calls).toEqual(['loadBegin', 'loadComplete', 'renderBegin', 'renderComplete']);
  });

  it('does not change the lifecycle state a reported failure leaves (a separate decision)', async () => {
    const mfe = make([], []);
    mfe.loadFails = true;
    await mfe.load(ctx());
    expect(mfe.getState()).toBe('ready');
  });
});

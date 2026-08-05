/**
 * ADR-001 conformance — the lifecycle re-entrancy guard actually guards.
 *
 * ADR-001 says `BaseMFE` tracks executing `{capability, phase}` pairs and, on
 * re-entry, "aborts further execution, preventing infinite recursion". These
 * checks state that decision; none of them touches `_lifecycleStack`.
 *
 * That restraint is the point. There *is* an older test for this
 * (`__tests__/lifecycle-executor.test.ts`, "should prevent re-entrant lifecycle
 * execution") — but it pushes onto the private stack by hand and asserts only
 * that `console.error` was called with a particular string. It never asserts
 * that execution was skipped, so a guard that logged the warning and then ran
 * the hooks anyway would pass it. It is coupled to a log message and blind to
 * the guarantee. That test is left alone: it is narrow, not wrong. This pack
 * carries the behavioural half.
 *
 * Each check has been proven by breaking what it guards — remove the guard's
 * early return and check 2 fails; widen the match to capability-only and check 3
 * fails; strip the `finally` and check 4 fails. A pack that has never failed has
 * not been shown to check anything.
 */
import { BaseMFE } from '../base-mfe';
import type { Context } from '../context';

/** Minimal concrete MFE — BaseMFE is abstract across all ten capabilities. */
function mfeClass(manifest: Record<string, unknown>) {
  return class TestMFE extends BaseMFE {
    protected async doLoad() {
      return { status: 'loaded', timestamp: new Date() };
    }
    protected async doRender() {
      return { status: 'rendered', timestamp: new Date() };
    }
    protected async doRefresh() {}
    protected async doAuthorizeAccess() {
      return true;
    }
    protected async doHealth() {
      return { status: 'healthy', checks: [], timestamp: new Date() };
    }
    protected async doDescribe() {
      return { name: '', version: '', type: '', capabilities: [], manifest };
    }
    protected async doSchema() {
      return { schema: '', format: 'graphql' };
    }
    protected async doQuery() {
      return { data: {} };
    }
    protected async doEmit() {
      return { emitted: true };
    }
    /** The guard lives on a protected method; conformance drives it directly. */
    public run(capability: string, phase: 'before' | 'main' | 'after' | 'error', ctx: Context) {
      return this['executeLifecycle'](capability, phase, ctx);
    }
  };
}

const ctx = (): Context => ({ requestId: 'conformance', timestamp: new Date() });

/** A manifest wiring one handler into `capability`'s `phase`. */
const manifestWith = (capability: string, phase: string, handler: string) => ({
  name: 'test',
  version: '1.0.0',
  type: 'tool',
  capabilities: [{ [capability]: { lifecycle: { [phase]: [{ hook: { handler } }] } } }],
});

let consoleError: jest.SpyInstance;
beforeEach(() => {
  // The guard reports re-entry on console.error by design; silence it so a
  // conformance run is readable, without asserting on the wording.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('ADR-001: lifecycle re-entrancy guard', () => {
  it('terminates a hook that re-enters its own capability and phase', async () => {
    const manifest = manifestWith('load', 'before', 'custom.recurse');
    const Klass = mfeClass(manifest);
    let instance: InstanceType<ReturnType<typeof mfeClass>>;

    const recurse = jest.fn(async () => {
      // Without the guard this recurses until the stack blows.
      await instance.run('load', 'before', ctx());
    });

    instance = new Klass(manifest, { customHandlers: { 'custom.recurse': recurse } });
    await expect(instance.run('load', 'before', ctx())).resolves.toBeUndefined();
  });

  it('skips the re-entrant invocation rather than merely logging it', async () => {
    // The check the older test is missing. A guard that warns and proceeds
    // would still terminate (JS would eventually unwind), but the handler would
    // run twice — "aborts further execution" is the decision, not "warns".
    const manifest = manifestWith('load', 'before', 'custom.recurse');
    const Klass = mfeClass(manifest);
    let instance: InstanceType<ReturnType<typeof mfeClass>>;

    const recurse = jest.fn(async () => {
      await instance.run('load', 'before', ctx());
    });

    instance = new Klass(manifest, { customHandlers: { 'custom.recurse': recurse } });
    await instance.run('load', 'before', ctx());

    expect(recurse).toHaveBeenCalledTimes(1);
  });

  it('does not block a different phase of the same capability', async () => {
    // "Prevent recursion" must not degrade into "prevent nesting": the guard
    // keys on the pair, so a before-hook driving the main phase is legitimate.
    const manifest = {
      name: 'test',
      version: '1.0.0',
      type: 'tool',
      capabilities: [
        {
          load: {
            lifecycle: {
              before: [{ hook: { handler: 'custom.outer' } }],
              main: [{ hook: { handler: 'custom.inner' } }],
            },
          },
        },
      ],
    };
    const Klass = mfeClass(manifest);
    let instance: InstanceType<ReturnType<typeof mfeClass>>;

    const inner = jest.fn(async () => {});
    const outer = jest.fn(async () => {
      await instance.run('load', 'main', ctx());
    });

    instance = new Klass(manifest, {
      customHandlers: { 'custom.outer': outer, 'custom.inner': inner },
    });
    await instance.run('load', 'before', ctx());

    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('releases the pair after a main-phase hook throws, so the lifecycle still runs', async () => {
    // ADR-002/REQ-042 makes main-phase failures propagate out of
    // executeHookEntry. If the guard's bookkeeping is not unwound on that path,
    // the pair is stranded and every later call to this lifecycle is treated as
    // re-entrant and silently skipped — the MFE keeps serving with dead hooks,
    // and the only symptom is a log line that looks like the guard working.
    const manifest = manifestWith('render', 'main', 'custom.boom');
    const Klass = mfeClass(manifest);

    let shouldThrow = true;
    const handler = jest.fn(async () => {
      if (shouldThrow) throw new Error('main-phase failure');
    });

    const instance = new Klass(manifest, { customHandlers: { 'custom.boom': handler } });

    await expect(instance.run('render', 'main', ctx())).rejects.toThrow('main-phase failure');
    expect(handler).toHaveBeenCalledTimes(1);

    // Same lifecycle, second call: the hook must run again.
    shouldThrow = false;
    await instance.run('render', 'main', ctx());
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

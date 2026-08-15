/**
 * Cross-package pin (ADR-080): the runtime's lifecycle machine and capability
 * surface are the canonical definition in `@falese/smt-contracts`, not a copy
 * of it.
 *
 * `base-mfe.ts` used to carry its own `MFEState` union, its own
 * `VALID_TRANSITIONS` table, and its own `CAPABILITY_DESCRIPTORS` map, while
 * `base-remote-mfe.ts` carried a third list of capability names and the DSL a
 * fourth. This suite holds the runtime's *observable behavior* — which
 * capability methods exist, and which states each may be called from — to the
 * contract, so a capability added to the contract without a runtime method
 * (or a state guard changed on one side only) fails here.
 */
import {
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
  MFE_LIFECYCLE_STATES,
  MFE_LIFECYCLE_TRANSITIONS,
  MFE_LIFECYCLE_INITIAL_STATE,
} from '@falese/smt-contracts';
import { BaseMFE, VALID_TRANSITIONS, type MFEState } from '../base-mfe';
import type { Context } from '../context';
import type { DSLManifest } from '@falese/smt-dsl';

const manifest = {
  name: 'pin-test',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [],
} as unknown as DSLManifest;

/** Minimal concrete MFE — every do*() resolves, so only guards can reject. */
class PinMFE extends BaseMFE {
  protected async doLoad(): Promise<never> {
    return { status: 'loaded' } as never;
  }
  protected async doRender(): Promise<never> {
    return { status: 'rendered' } as never;
  }
  protected async doRefresh(): Promise<void> {
    /* no-op */
  }
  protected async doAuthorizeAccess(): Promise<boolean> {
    return true;
  }
  protected async doHealth(): Promise<never> {
    return { status: 'healthy', checks: [] } as never;
  }
  protected async doDescribe(): Promise<never> {
    return { name: 'pin-test' } as never;
  }
  protected async doSchema(): Promise<never> {
    return { schema: '', format: 'graphql' } as never;
  }
  protected async doQuery(): Promise<never> {
    return { data: null } as never;
  }
  protected async doEmit(): Promise<never> {
    return { emitted: true, eventId: 'x' } as never;
  }
  protected async doUpdateControlPlaneState(): Promise<never> {
    return { acknowledged: true, correlationId: 'x' } as never;
  }

  /** Drive the machine directly so a guard can be probed from any state. */
  forceState(state: MFEState): void {
    this.state = state;
  }
}

const makeMfe = (state: MFEState): PinMFE => {
  const mfe = new PinMFE(manifest);
  mfe.forceState(state);
  return mfe;
};

const context = (): Context => ({ requestId: 'pin', inputs: {} }) as Context;

describe('runtime ↔ platform contract pin', () => {
  it('re-exports the canonical transition table rather than a second copy', () => {
    expect(VALID_TRANSITIONS).toBe(MFE_LIFECYCLE_TRANSITIONS);
  });

  it('starts every MFE in the contract’s initial state', () => {
    expect(new PinMFE(manifest).getState()).toBe(MFE_LIFECYCLE_INITIAL_STATE);
  });

  it('exposes an orchestrator method for all ten capabilities', () => {
    const mfe = makeMfe('ready');
    for (const name of PLATFORM_CAPABILITIES) {
      expect(typeof (mfe as unknown as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('exposes the do*() wrapper method each spec names', () => {
    const mfe = makeMfe('ready');
    for (const name of PLATFORM_CAPABILITIES) {
      const { wrapperMethod } = PLATFORM_CAPABILITY_SPECS[name];
      expect(typeof (mfe as unknown as Record<string, unknown>)[wrapperMethod]).toBe('function');
    }
  });

  it('accepts each capability from exactly the pre-states the contract allows', async () => {
    for (const name of PLATFORM_CAPABILITIES) {
      const { preStates } = PLATFORM_CAPABILITY_SPECS[name];
      // Empty preStates means "any state" — nothing to reject.
      if (preStates.length === 0) continue;

      for (const state of MFE_LIFECYCLE_STATES) {
        const mfe = makeMfe(state);
        const invoke = (mfe as unknown as Record<string, (c: Context) => Promise<unknown>>)[name];
        // Settlement, not the value: `refresh` resolves to void, so
        // `resolves.toBeDefined()` would read as a guard rejection.
        const settled = await invoke
          .call(mfe, context())
          .then(() => 'resolved' as const, () => 'rejected' as const);

        expect({ capability: name, state, settled }).toEqual({
          capability: name,
          state,
          settled: preStates.includes(state) ? 'resolved' : 'rejected',
        });
      }
    }
  });

  it('emit is the one capability callable from every state, destroyed included', async () => {
    expect(PLATFORM_CAPABILITY_SPECS.emit.preStates).toEqual([]);
    for (const state of MFE_LIFECYCLE_STATES) {
      await expect(makeMfe(state).emit(context())).resolves.toBeDefined();
    }
  });

  it('load and render leave the MFE in the exit state the contract declares', async () => {
    const loader = makeMfe('uninitialized');
    await loader.load(context());
    expect(loader.getState()).toBe(PLATFORM_CAPABILITY_SPECS.load.exitState);

    const renderer = makeMfe('ready');
    await renderer.render(context());
    expect(renderer.getState()).toBe(PLATFORM_CAPABILITY_SPECS.render.exitState);
  });

  it('a failing capability lands in the error state the contract declares', async () => {
    class FailingMFE extends PinMFE {
      protected override async doLoad(): Promise<never> {
        throw new Error('boom');
      }
    }
    const mfe = new FailingMFE(manifest);
    await expect(mfe.load(context())).rejects.toThrow('boom');
    expect(mfe.getState()).toBe(PLATFORM_CAPABILITY_SPECS.load.errorState);
  });

  it('rejects every transition the canonical table does not contain', () => {
    for (const from of MFE_LIFECYCLE_STATES) {
      for (const to of MFE_LIFECYCLE_STATES) {
        if (MFE_LIFECYCLE_TRANSITIONS[from].includes(to)) continue;
        const mfe = makeMfe(from);
        expect(() =>
          (mfe as unknown as { transitionState: (s: MFEState) => void }).transitionState(to)
        ).toThrow();
      }
    }
  });
});

/**
 * How one capability call executes: a descriptor table plus a middleware onion.
 *
 * Each capability is described as data — which states it may be called from,
 * which state it enters, which it falls to on error — and executed by running a
 * chain of middlewares over that description. That is why `load` and `query`
 * share one execution path instead of each hand-rolling its own guards: the
 * differences are rows in a table, not branches in code.
 *
 * The descriptors are derived from PLATFORM_CAPABILITY_SPECS in
 * `@seans-mfe/contracts`, never re-listed here (ADR-080). Five of ten
 * declaration sites were once a capability short, and the one they all missed
 * was `updateControlPlaneState`.
 *
 * Nothing in this file touches `this`, which is what let it move out of the
 * class intact.
 */

import type { Context } from './context';
import { SystemError, PLATFORM_CAPABILITY_SPECS } from '@seans-mfe/contracts';
import type { PlatformCapabilitySpec } from '@seans-mfe/contracts';
import * as platformHandlerLibrary from './handlers';
import type { MFEState } from './base-mfe';

// =============================================================================
// Capability Descriptors (REQ-054)
// =============================================================================

/**
 * How each capability interacts with the lifecycle state machine (ADR-042):
 * allowed pre-states, and the enter/exit/error transitions it drives. That is
 * per-capability contract data, so it lives in `@seans-mfe/contracts`
 * alongside the state machine itself (ADR-080) rather than being re-declared
 * here. Everything else about capability orchestration (before → main → doX →
 * after, error phase on failure) is identical across the 10 platform
 * capabilities and lives once in BaseMFE.executeCapability().
 */
export type CapabilityDescriptor = Pick<
  PlatformCapabilitySpec,
  'preStates' | 'enterState' | 'exitState' | 'errorState'
>;

export const CAPABILITY_DESCRIPTORS: Readonly<Record<string, CapabilityDescriptor>> =
  PLATFORM_CAPABILITY_SPECS;

// =============================================================================
// Platform Handler Library (REQ-058)
// =============================================================================

type PlatformHandlerFn = (context: Context) => Promise<unknown>;

/**
 * The platform handler library, resolved once at module load from the static
 * './handlers' barrel (flat namespace — `export *` per category module).
 * Replaces the former per-invocation dynamic import: resolution is O(1) and
 * the full set of resolvable names is visible here at startup.
 */
export const PLATFORM_HANDLER_LIBRARY: ReadonlyMap<string, PlatformHandlerFn> = new Map(
  Object.entries(platformHandlerLibrary as unknown as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'function')
    .map(([name, value]) => [name, value as PlatformHandlerFn])
);

// =============================================================================
// Capability Middleware Pipeline
// =============================================================================

/**
 * One stage of the capability execution pipeline. A middleware does its work,
 * then calls next() to run the rest of the chain — or catches errors thrown
 * by it (the error boundary). This is the koa/express onion, minus the
 * framework: the lifecycle engine's execution model expressed as data.
 */
export type Middleware = (context: Context, next: () => Promise<void>) => Promise<void>;

/** Run a middleware chain in order. Guards against a stage calling next() twice. */
export async function runPipeline(middlewares: Middleware[], context: Context): Promise<void> {
  let lastIndex = -1;
  const dispatch = async (index: number): Promise<void> => {
    if (index <= lastIndex) {
      throw new SystemError('Capability pipeline: next() called multiple times in one middleware');
    }
    lastIndex = index;
    const middleware = middlewares[index];
    if (!middleware) return;
    await middleware(context, () => dispatch(index + 1));
  };
  await dispatch(0);
}


/**
 * useControlPlaneState — React hook wrapper over
 * `pushControlPlaneState` (`@falese/smt-runtime`), for components that
 * push control-plane state from an event handler or effect rather than a
 * one-off call site.
 *
 * Same posture as DeclaredSlot: this module needs no dependency on
 * `@falese/smt-runtime` (structural typing over the two fields the
 * capability's `Context` requires — `requestId`/`timestamp` — plus
 * `inputs`), so it duplicates that tiny bit of construction logic locally
 * instead of importing `ContextFactory`/`Context` from the runtime package.
 * `pushControlPlaneState`'s own docstring (packages/runtime/src/control-plane-state.ts)
 * is the source of truth for the boilerplate this removes; this hook removes
 * the same boilerplate for React call sites, plus gives them a stable
 * function identity across re-renders.
 */
import * as React from 'react';

/** Structural view of the `Context` shape `updateControlPlaneState` needs. */
export interface ControlPlaneStateContextLike {
  requestId: string;
  timestamp: Date;
  inputs?: Record<string, unknown>;
}

/** The neutral subset of BaseMFE this hook needs — structural, like `pushControlPlaneState`'s `ControlPlaneStatePusher`. */
export interface ControlPlaneStatePusherLike {
  updateControlPlaneState(context: ControlPlaneStateContextLike): Promise<unknown>;
}

export interface UseControlPlaneStateOptions {
  /** Links this update to the originating render/action. Defaults to the generated requestId. */
  correlationId?: string;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Returns a stable push function bound to `mfe`: call it with a stateKey and
 * stateData to push control-plane state, same contract as
 * `pushControlPlaneState`. The returned function's identity only changes
 * when `mfe` changes, so it is safe to use as an effect/callback dependency.
 */
export function useControlPlaneState(
  mfe: ControlPlaneStatePusherLike
): (
  stateKey: string,
  stateData: Record<string, unknown>,
  options?: UseControlPlaneStateOptions
) => Promise<unknown> {
  return React.useCallback(
    (stateKey: string, stateData: Record<string, unknown>, options: UseControlPlaneStateOptions = {}) => {
      const context: ControlPlaneStateContextLike = {
        requestId: generateRequestId(),
        timestamp: new Date(),
        inputs: { stateKey, stateData, correlationId: options.correlationId },
      };
      return mfe.updateControlPlaneState(context);
    },
    [mfe]
  );
}

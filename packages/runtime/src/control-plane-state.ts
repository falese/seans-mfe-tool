/**
 * pushControlPlaneState — thin sugar over the inherited `updateControlPlaneState`
 * platform capability (BaseMFE).
 *
 * Every real call site that pushes control-plane state (StationConsole.tsx,
 * GameMenu.tsx) hand-rolls the same boilerplate: build a full `Context` with a
 * fresh `requestId`/`timestamp`, and narrow-cast the `mfe` instance to a local
 * one-off interface so the call site doesn't have to import the full `Context`
 * type. This does both, using the same `ContextFactory` the rest of the
 * runtime already uses to mint requests.
 *
 * Deliberately thin: it does not introduce a manifest-declared `stateKey`
 * registry (the way `DeclaredSlot`/`DeclaredSlotId` are backed by
 * `providesSlots`, ADR-072) — `stateKey` stays a free-form string. That's a
 * separate, larger decision to make only if mistyped state keys turn out to
 * be a real, recurring problem; this is scoped to removing the mechanical
 * boilerplate that exists today.
 */
import { ContextFactory, type Context } from './context';
import type { ControlPlaneStateResult } from './base-mfe';

/**
 * The neutral subset of BaseMFE this module needs — structural, so callers
 * never have to import a concrete MFE class or cast to a narrow local type.
 */
export interface ControlPlaneStatePusher {
  updateControlPlaneState(context: Context): Promise<ControlPlaneStateResult>;
}

export interface PushControlPlaneStateOptions {
  /** Links this update to the originating render/action. Defaults to the generated requestId. */
  correlationId?: string;
}

/**
 * Push domain state to the daemon so the registry can re-evaluate placement
 * rules — the inherited `updateControlPlaneState` capability, with the
 * `Context` construction done for you.
 */
export function pushControlPlaneState(
  mfe: ControlPlaneStatePusher,
  stateKey: string,
  stateData: Record<string, unknown>,
  options: PushControlPlaneStateOptions = {}
): Promise<ControlPlaneStateResult> {
  const context = ContextFactory.create({
    capability: 'updateControlPlaneState',
    inputs: { stateKey, stateData, correlationId: options.correlationId },
  });
  return mfe.updateControlPlaneState(context);
}

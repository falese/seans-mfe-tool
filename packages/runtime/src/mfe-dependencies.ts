/**
 * The injection seam — everything a host may substitute in a BaseMFE.
 *
 * ADR-079 is the decision this file exists to hold in one place. BaseMFE used
 * to have TWO seams for substituting lifecycle execution:
 * `deps.customHandlers`, which sits INSIDE `executeHook` and therefore inside
 * ADR-002's guarantees, and `deps.lifecycleExecutor`, which wrapped the whole
 * phase loop and skipped every one of them. The second was deleted.
 * Substituting execution means providing a handler, not replacing the engine.
 *
 * So the rule for anything added here: if it can bypass `executeHook`, it does
 * not belong.
 */

import type { Context, TelemetryEvent } from './context';
import type { DSLManifest, LifecycleHookEntry } from '@seans-mfe/dsl';
import type { DaemonWebSocketClient } from './graphql-ws-client';
import type { MFEState } from './base-mfe';

// =============================================================================
// Dependency Injection Interfaces
// =============================================================================

export interface PlatformHandlerMap {
  [key: string]: (context: Context) => Promise<unknown>;
}

export interface CustomHandlerMap {
  [key: string]: (context: Context) => Promise<unknown>;
}

export interface TelemetryService {
  emit(event: TelemetryEvent): void;
}

export interface StateValidator {
  isValidTransition(from: MFEState, to: MFEState): boolean;
}

/**
 * The slice of a capability's manifest entry the lifecycle engine reads:
 * the per-phase hook lists. Everything else on the entry is opaque.
 */
export interface CapabilityLifecycleConfig {
  lifecycle?: {
    before?: LifecycleHookEntry[];
    main?: LifecycleHookEntry[];
    after?: LifecycleHookEntry[];
    error?: LifecycleHookEntry[];
  };
  [key: string]: unknown;
}

export interface ManifestParser {
  parse(manifest: DSLManifest): Record<string, CapabilityLifecycleConfig | null | undefined>;
}

export interface ErrorHandler {
  handle(error: Error, context: Context): void;
}

export interface BaseMFEDependencies {
  platformHandlers?: PlatformHandlerMap;
  customHandlers?: CustomHandlerMap;
  telemetry?: TelemetryService;
  stateValidator?: StateValidator;
  manifestParser?: ManifestParser;
  errorHandler?: ErrorHandler;
  /** graphql-transport-ws connection to the daemon, shared with the Renderer's messages subscription */
  wsClient?: DaemonWebSocketClient;
  /** BFF GraphQL endpoint URL used by the default doQuery() implementation */
  bffUrl?: string;
}


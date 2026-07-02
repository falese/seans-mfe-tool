/**
 * BaseMFE Abstract Class
 * Following REQ-054: BaseMFE Abstract Class Contract
 * Following REQ-042: Lifecycle Hook Execution Semantics
 * Following ADR-041: BaseMFE Abstract Base (Not Type Hierarchy)
 * Following REQ-RUNTIME-002: Shared Context Across All Phases
 * 
 * Universal base class for all MFE types (remote, bff, tool, agent).
 * MFE type determines generated code CONTENT in doCapability() methods.
 */

import type { DSLManifest, LifecycleHook, LifecycleHookEntry } from '@seans-mfe/dsl';
import { Context, UserContext, TelemetryEvent } from './context';
import type { QueryInput } from './context';
import type { DaemonWebSocketClient } from './graphql-ws-client';
import { ValidationError as RuntimeValidationError } from './errors/ValidationError';

// Re-export for convenience
export type { Context, UserContext, TelemetryEvent };
export type { DaemonWebSocketClient };

// =============================================================================
// Dependency Injection Interfaces
// =============================================================================

export interface PlatformHandlerMap {
  [key: string]: (context: Context) => Promise<any>;
}

export interface CustomHandlerMap {
  [key: string]: (context: Context) => Promise<any>;
}

export interface TelemetryService {
  emit(event: TelemetryEvent): void;
}

export interface StateValidator {
  isValidTransition(from: MFEState, to: MFEState): boolean;
}

export interface ManifestParser {
  parse(manifest: DSLManifest): any;
}

export interface LifecycleExecutor {
  execute(hook: LifecycleHook, context: Context, phase: string): Promise<void>;
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
  lifecycleExecutor?: LifecycleExecutor;
  errorHandler?: ErrorHandler;
  /** graphql-transport-ws connection to the daemon, shared with the Renderer's messages subscription */
  wsClient?: DaemonWebSocketClient;
  /** BFF GraphQL endpoint URL used by the default doQuery() implementation */
  bffUrl?: string;
}

// =============================================================================
// Result Types
// =============================================================================

type Worker = any;

/** Metadata for a single capability declared in the manifest */
export interface CapabilityMetadata {
  name: string;
  type: 'platform' | 'domain';
  description?: string;
}

/** Result from load capability */
export interface LoadResult {
  status: 'loaded' | 'error';
  container?: unknown;
  mesh?: unknown;
  worker?: Worker;
  manifest?: import('@seans-mfe/dsl').DSLManifest;
  availableComponents?: string[];
  capabilities?: CapabilityMetadata[];
  timestamp: Date;
  duration?: number;
  telemetry?: {
    entry: { start: Date; duration: number };
    mount: { start: Date; duration: number };
    enableRender: { start: Date; duration: number };
  };
  error?: { message: string; phase: string; retryCount: number; retryable: boolean };
}

/** Result from render capability */
export interface RenderResult {
  status: 'rendered' | 'error';
  element?: unknown;    // DOM element or React component
  timestamp: Date;
  [key: string]: unknown;
}

/** Result from health capability */
export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }>;
  timestamp: Date;
}

/** Result from describe capability */
export interface DescribeResult {
  name: string;
  version: string;
  type: string;
  capabilities: string[];
  manifest: DSLManifest;
}

/** Result from schema capability */
export interface SchemaResult {
  schema: string;  // GraphQL schema or JSON schema
  format: 'graphql' | 'json' | 'openapi';
}

/** Result from query capability */
export interface QueryResult {
  data: unknown;
  errors?: Array<{ message: string; path?: string[] }>;
}

/** Result from emit capability */
export interface EmitResult {
  emitted: boolean;
  eventId?: string;
}

/** Result from updateControlPlaneState capability */
export interface ControlPlaneStateResult {
  /** Whether the daemon acknowledged the state update */
  acknowledged: boolean;
  /** Correlation ID for tracing this update through the control plane */
  correlationId: string;
  /** Non-null when the update could not be delivered (not connected, timeout, etc.) */
  error?: string | null;
  /**
   * Populated when the registry immediately resolved a new component based
   * on the state update. In practice this may arrive asynchronously via the
   * daemon's Subscription.messages channel instead.
   */
  resolution?: {
    mfe: string;
    capability: string;
    props: Record<string, unknown>;
  };
}

// =============================================================================
// State Machine Types (REQ-056)
// =============================================================================

/** MFE lifecycle state */
export type MFEState = 
  | 'uninitialized'  // Initial state
  | 'loading'        // Load in progress
  | 'ready'          // Ready to use
  | 'rendering'      // Render in progress
  | 'error'          // Error state
  | 'destroyed';     // Destroyed, cannot recover

/** Valid state transitions */
export const VALID_TRANSITIONS: Record<MFEState, MFEState[]> = {
  uninitialized: ['loading'],
  loading: ['ready', 'error'],
  ready: ['loading', 'rendering', 'destroyed'],
  rendering: ['ready', 'error'],
  error: ['loading', 'destroyed'],
  destroyed: []
};

// =============================================================================
// Capability Descriptors (REQ-054)
// =============================================================================

/**
 * How a capability interacts with the lifecycle state machine (ADR-042).
 * Everything else about capability orchestration (before → main → doX →
 * after, error phase on failure) is identical across the 10 platform
 * capabilities and lives once in BaseMFE.executeCapability().
 */
interface CapabilityDescriptor {
  /** States this capability may be invoked from; empty = any state. */
  preStates: MFEState[];
  /** State entered before execution (e.g. load → 'loading'). */
  enterState?: MFEState;
  /** State entered after successful execution. */
  exitState?: MFEState;
  /** State entered when execution fails. */
  errorState?: MFEState;
}

/** Any state except 'destroyed' — read-only capabilities run everywhere. */
const ANY_LIVE_STATE: MFEState[] = ['uninitialized', 'loading', 'ready', 'rendering', 'error'];

const CAPABILITY_DESCRIPTORS: Record<string, CapabilityDescriptor> = {
  load: {
    preStates: ['uninitialized', 'ready', 'error'],
    enterState: 'loading',
    exitState: 'ready',
    errorState: 'error',
  },
  render: {
    preStates: ['ready'],
    enterState: 'rendering',
    exitState: 'ready',
    errorState: 'error',
  },
  refresh: { preStates: ['ready'] },
  authorizeAccess: { preStates: ['ready'] },
  health: { preStates: ANY_LIVE_STATE },
  describe: { preStates: ANY_LIVE_STATE },
  schema: { preStates: ['ready'] },
  query: { preStates: ['ready'] },
  emit: { preStates: [] },
  // Available from ready OR rendering — an MFE may push state mid-render.
  updateControlPlaneState: { preStates: ['ready', 'rendering'] },
};

// =============================================================================
// BaseMFE Abstract Class
// =============================================================================

/**
 * Base class for all MFE implementations
 * 
 * Platform Responsibilities:
 * - Lifecycle orchestration (before → main → after/error hooks)
 * - State management and validation
 * - Telemetry emission on hook failures
 * - Error containment (contained flag)
 * - Handler invocation (platform.* and custom.*)
 * 
 * Developer Responsibilities:
 * - Implement abstract doCapability() methods
 * - Implement custom lifecycle handlers referenced in DSL
 */
export abstract class BaseMFE {
  /** DSL manifest for this MFE */
  protected readonly manifest: DSLManifest;

  /** DI dependencies */
  protected readonly deps: BaseMFEDependencies;

  /** Current lifecycle state */
  protected state: MFEState = 'uninitialized';

  /** State transition history (for debugging) */
  protected stateHistory: Array<{ from: MFEState; to: MFEState; timestamp: Date }> = [];

  /**
   * Tracks currently executing lifecycle phases to prevent re-entrancy
   */
  private _lifecycleStack: Array<{capability: string, phase: string}> = [];

  constructor(manifest: DSLManifest, deps: BaseMFEDependencies = {}) {
    this.manifest = manifest;
    this.deps = deps;
  }

  /**
   * Attach a daemon control-plane socket after construction (ADR-057).
   *
   * Generated MFEs are built without deps; when a host composes one
   * (LayoutManager, ADR-055) it injects a per-slot virtual channel here so the
   * platform capability `updateControlPlaneState` rides the host's single
   * physical socket. `deps` is readonly, but `wsClient` is a mutable member of
   * it. Idempotent: re-attaching replaces the channel.
   */
  public attachControlPlane(wsClient: DaemonWebSocketClient): void {
    this.deps.wsClient = wsClient;
  }

  // ===========================================================================
  // State Management (REQ-056)
  // ===========================================================================
  
  /**
   * Get current state
   */
  public getState(): MFEState {
    return this.state;
  }
  
  /**
   * Assert that current state matches expected state
   * @throws Error if state doesn't match
   */
  protected assertState(...expectedStates: MFEState[]): void {
    if (!expectedStates.includes(this.state)) {
      if (this.deps?.errorHandler) {
        this.deps.errorHandler.handle(
          new Error(`Invalid state: expected ${expectedStates.join(' or ')}, got ${this.state}`),
          {} as Context
        );
      }
      throw new Error(
        `Invalid state: expected ${expectedStates.join(' or ')}, got ${this.state}`
      );
    }
  }
  
  /**
   * Transition to a new state
   * @throws Error if transition is invalid
   */
  protected transitionState(newState: MFEState): void {
    const validTransitions = VALID_TRANSITIONS[this.state];
    const isValid = this.deps?.stateValidator
      ? this.deps.stateValidator.isValidTransition(this.state, newState)
      : validTransitions.includes(newState);

    if (!isValid) {
      if (this.deps?.errorHandler) {
        this.deps.errorHandler.handle(
          new Error(`Invalid state transition: ${this.state} → ${newState}. Valid transitions: ${validTransitions.join(', ')}`),
          {} as Context
        );
      }
      throw new Error(
        `Invalid state transition: ${this.state} → ${newState}. ` +
        `Valid transitions: ${validTransitions.join(', ')}`
      );
    }

    const oldState = this.state;
    this.state = newState;

    this.stateHistory.push({
      from: oldState,
      to: newState,
      timestamp: new Date()
    });
  }
  
  // ===========================================================================
  // Lifecycle Orchestration (REQ-042, REQ-057)
  // ===========================================================================
  
  /**
   * Execute lifecycle hooks for a capability phase
   * 
   * @param capability - Capability name (load, render, etc.)
   * @param phase - Lifecycle phase (before, main, after, error)
   * @param context - Execution context
   */
  protected async executeLifecycle(
    capability: string,
    phase: 'before' | 'main' | 'after' | 'error',
    context: Context
  ): Promise<void> {
    // Guard: Prevent re-entrant execution for same capability/phase
    if (this._lifecycleStack.some(e => e.capability === capability && e.phase === phase)) {
      console.error(`Re-entrant lifecycle detected for capability="${capability}" phase="${phase}"; skipping`);
      return;
    }
    this._lifecycleStack.push({capability, phase});
    // DI: allow manifest parsing override
    const capabilityConfig = this.deps?.manifestParser
      ? this.deps.manifestParser.parse(this.manifest)[capability]
      : this.findCapabilityConfig(capability);
    if (!capabilityConfig?.lifecycle) {
      this._lifecycleStack.pop();
      return; // No lifecycle hooks defined
    }

    const hooks = capabilityConfig.lifecycle[phase];
    if (!hooks || hooks.length === 0) {
      this._lifecycleStack.pop();
      return; // No hooks for this phase
    }

    // Update context with phase and capability
    context.phase = phase;
    context.capability = capability;

    // DI: allow lifecycle executor override
    if (this.deps?.lifecycleExecutor) {
      for (const hookEntry of hooks) {
        await this.deps.lifecycleExecutor.execute(hookEntry, context, phase);
      }
      this._lifecycleStack.pop();
      return;
    }

    // Default: Execute hooks sequentially
    for (const hookEntry of hooks) {
      await this.executeHookEntry(hookEntry, context, phase);
    }
    this._lifecycleStack.pop();
  }
  
  /**
   * Execute a single hook entry (name → config)
   */
  private async executeHookEntry(
    hookEntry: LifecycleHookEntry,
    context: Context,
    phase: string
  ): Promise<void> {
    for (const [hookName, hookConfig] of Object.entries(hookEntry)) {
      await this.executeHook(hookName, hookConfig, context, phase);
    }
  }
  
  /**
   * Execute a single hook with error handling
   * 
   * REQ-042: Non-mandatory/mandatory hooks fail silently (logged + telemetry)
   * REQ-042: Main phase failures propagate
   * REQ-043: All hook failures emit telemetry
   * REQ-045: Handler arrays execute sequentially, continue on failure for non-main phases
   */
  private async executeHook(
    hookName: string,
    hookConfig: LifecycleHook,
    context: Context,
    phase: string
  ): Promise<void> {
    // Handle array of handlers (REQ-045)
    const handlers = Array.isArray(hookConfig.handler) 
      ? hookConfig.handler 
      : [hookConfig.handler];
    
    let lastError: Error | null = null;
    
    for (const handlerName of handlers) {
      try {
        // Contained flag: wrap in try-catch (REQ-042)
        if (hookConfig.contained) {
          try {
            await this.invokeHandler(handlerName, context);
          } catch (error) {
            // Contained errors are logged but don't propagate
            await this.emitHookFailure(hookName, handlerName, error as Error, context, 'warn');
          }
        } else {
          // Non-contained: errors may propagate
          await this.invokeHandler(handlerName, context);
        }
      } catch (error) {
        // Handler failed
        lastError = error as Error;
        await this.emitHookFailure(hookName, handlerName, error as Error, context, phase === 'main' ? 'error' : 'warn');
        
        // REQ-042: Main phase failures propagate immediately
        if (phase === 'main') {
          throw error;
        }
        
        // REQ-045: Before/after/error phase failures continue to next handler in array
        // (already logged via telemetry, continue loop)
      }
    }
  }
  
  /**
   * Invoke a handler by name (platform.* or custom.*)
   * 
   * REQ-058: Platform handlers resolved from standard library
   * REQ-057: Custom handlers resolved from developer class
   */
  protected async invokeHandler(handlerName: string, context: Context): Promise<void> {
    if (handlerName.startsWith('platform.')) {
      const platformHandlerName = handlerName.slice(9);
      if (this.deps?.platformHandlers && this.deps.platformHandlers[platformHandlerName]) {
        await this.deps.platformHandlers[platformHandlerName](context);
      } else {
        await this.invokePlatformHandler(platformHandlerName, context);
      }
    } else {
      // Try full custom handler name first, then fallback to last segment
      const customHandlerName = handlerName;
      if (this.deps?.customHandlers && this.deps.customHandlers[customHandlerName]) {
        await this.deps.customHandlers[customHandlerName](context);
        return;
      }
      // Fallback: strip prefix (e.g., 'custom.fail' -> 'fail')
      const lastSegment = customHandlerName.includes('.') ? customHandlerName.split('.').pop() : customHandlerName;
      if (lastSegment && this.deps?.customHandlers && this.deps.customHandlers[lastSegment]) {
        await this.deps.customHandlers[lastSegment](context);
        return;
      }
      // Fallback: invoke as method on subclass
      await this.invokeCustomHandler(lastSegment!, context);
    }
  }
  
  /**
  * Invoke a platform handler from standard library
  * @throws Error if platform handler not found
  *
  * ---
  * Coverage Note:
  * The dynamic import (await import('./handlers')) below is not reliably covered by Jest/Istanbul/nyc.
  * This is a known limitation for dynamic imports in JavaScript/TypeScript coverage tools:
  *   - Jest FAQ: https://jestjs.io/docs/coverage#why-are-some-lines-not-covered
  *   - Istanbul Issue #879: https://github.com/istanbuljs/istanbuljs/issues/879
  *   - Stack Overflow: https://stackoverflow.com/questions/56357938/jest-coverage-for-dynamic-import
  *   - Jest Issue #9430: https://github.com/facebook/jest/issues/9430
  *
  * Do not refactor production code solely for coverage. All other branches and error paths are strictly covered.
  * ---
   */
  protected async invokePlatformHandler(name: string, context: Context): Promise<void> {
    // Integration: resolve platform handler from src/runtime/handlers
    // Supports category.name (e.g., auth.validateJWT) and flat name (e.g., validateJWT)
    let handlerFn: ((context: Context, ...args: any[]) => Promise<any>) | undefined;
    try {
      // Dynamically import all platform handlers
      const handlers = await import('./handlers');
      type H = (context: Context, ...args: any[]) => Promise<any>;
      const h = handlers as unknown as Record<string, Record<string, H>>;
      // Support category.name (e.g., auth.validateJWT)
      if (name.includes('.')) {
        const [category, fn] = name.split('.');
        handlerFn = h[category]?.[fn];
      } else {
        // Flat namespace (e.g., validateJWT)
        handlerFn = (handlers as unknown as Record<string, H>)[name];
        // Try each category if not found
        if (!handlerFn) {
          for (const cat of Object.keys(handlers)) {
            if (h[cat]?.[name]) {
              handlerFn = h[cat][name];
              break;
            }
          }
        }
      }
    } catch (err) {
      throw new Error(`Failed to import platform handlers: ${(err as Error).message}`);
    }
    if (!handlerFn) {
      throw new Error(`Platform handler not implemented: platform.${name}. Expected method do${name.charAt(0).toUpperCase() + name.slice(1)} on MFE class.`);
    }
    await handlerFn(context);
  }
  
  /**
   * Invoke a custom handler from developer implementation
   * @throws Error if custom handler not found
   */
  protected async invokeCustomHandler(name: string, context: Context): Promise<void> {
    const method = (this as any)[name];
    if (typeof method !== 'function') {
      throw new Error(
        `Custom handler not found: ${name}. ` +
        `Either implement a method on your MFE class — ` +
        `\`private async ${name}(context: Context): Promise<void> { ... }\` — ` +
        `or declare a source module in the DSL manifest (ADR-040), e.g. ` +
        `\`${name}: { handler: ${name}, source: './handlers/${name}' }\`.`
      );
    }
    await method.call(this, context);
  }
  
  /**
   * Emit telemetry for hook failure (REQ-043)
   */
  private async emitHookFailure(
    hookName: string,
    handlerName: string,
    error: Error,
    context: Context,
    severity: 'error' | 'warn'
  ): Promise<void> {
    const event: TelemetryEvent = {
      name: 'lifecycle-error',
      capability: 'lifecycle',
      phase: context.phase || 'unknown',
      status: 'error',
      metadata: {
        source: 'lifecycle-hook',
        hook: hookName,
        handler: handlerName,
        capability: context.capability,
        mfe: this.manifest.name,
        severity,
        tags: ['lifecycle', 'hook-failure'],
        error: {
          message: error.message,
          stack: error.stack
        }
      },
      timestamp: new Date()
    };

    if (this.deps?.telemetry) {
      this.deps.telemetry.emit(event);
    } else {
      // Default: log to console
      console.error('[Telemetry]', JSON.stringify(event, null, 2));
    }
  }
  
  /**
   * Find capability configuration from manifest
   */
  private findCapabilityConfig(capability: string): any {
    if (!this.manifest.capabilities) {
      return null;
    }

    const lc = capability.toLowerCase();
    for (const entry of this.manifest.capabilities) {
      const key = Object.keys(entry).find(k => k.toLowerCase() === lc);
      if (key) {
        return entry[key];
      }
    }

    return null;
  }
  
  // ===========================================================================
  // Platform Capabilities (REQ-054)
  // Generated wrappers that orchestrate lifecycle
  // ===========================================================================

  /**
   * Orchestrate one capability invocation: state guard, optional enter
   * transition, lifecycle phases around the doX() implementation, optional
   * exit/error transitions. The per-capability variations live in
   * CAPABILITY_DESCRIPTORS; this method is the single copy of the pattern.
   */
  private async executeCapability<T>(
    name: string,
    doFn: (context: Context) => Promise<T>,
    context: Context
  ): Promise<T> {
    const desc = CAPABILITY_DESCRIPTORS[name];
    if (desc.preStates.length > 0) {
      this.assertState(...desc.preStates);
    }
    if (desc.enterState) {
      this.transitionState(desc.enterState);
    }

    try {
      await this.executeLifecycle(name, 'before', context);
      await this.executeLifecycle(name, 'main', context);
      const result = await doFn(context);
      await this.executeLifecycle(name, 'after', context);
      if (desc.exitState) {
        this.transitionState(desc.exitState);
      }
      return result;
    } catch (error) {
      await this.executeLifecycle(name, 'error', { ...context, error: error as Error });
      if (desc.errorState) {
        this.transitionState(desc.errorState);
      }
      throw error;
    }
  }

  /**
   * Load capability: Initialize and prepare MFE for use
   */
  public async load(context: Context): Promise<LoadResult> {
    return this.executeCapability('load', (ctx) => this.doLoad(ctx), context);
  }

  /**
   * Render capability: Render MFE UI into target container
   */
  public async render(context: Context): Promise<RenderResult> {
    return this.executeCapability('render', (ctx) => this.doRender(ctx), context);
  }

  /**
   * Refresh capability: Refresh MFE data/state
   */
  public async refresh(context: Context): Promise<void> {
    return this.executeCapability('refresh', (ctx) => this.doRefresh(ctx), context);
  }

  /**
   * AuthorizeAccess capability: Check authorization
   */
  public async authorizeAccess(context: Context): Promise<boolean> {
    return this.executeCapability('authorizeAccess', (ctx) => this.doAuthorizeAccess(ctx), context);
  }

  /**
   * Health capability: Check MFE health status
   */
  public async health(context: Context): Promise<HealthResult> {
    return this.executeCapability('health', (ctx) => this.doHealth(ctx), context);
  }

  /**
   * Describe capability: Return MFE metadata
   */
  public async describe(context: Context): Promise<DescribeResult> {
    return this.executeCapability('describe', (ctx) => this.doDescribe(ctx), context);
  }

  /**
   * Schema capability: Return GraphQL/JSON schema
   */
  public async schema(context: Context): Promise<SchemaResult> {
    return this.executeCapability('schema', (ctx) => this.doSchema(ctx), context);
  }

  /**
   * Query capability: Execute data query
   */
  public async query(context: Context): Promise<QueryResult> {
    return this.executeCapability('query', (ctx) => this.doQuery(ctx), context);
  }

  /**
   * Emit capability: Emit telemetry/events
   */
  public async emit(context: Context): Promise<EmitResult> {
    return this.executeCapability('emit', (ctx) => this.doEmit(ctx), context);
  }

  /**
   * UpdateControlPlaneState capability: Push domain state to the daemon so the
   * Registry can re-evaluate what should be shown.
   *
   * This is distinct from emit() (telemetry/observers). Use this when internal
   * MFE state has changed in a way that should drive registry resolution:
   *
   *   - Analysis complete → registry may transition to a DataVisualization MFE
   *   - Form submitted    → registry may resolve a Confirmation MFE
   *   - Wizard step done  → registry may resolve the next step's MFE
   *   - Error escalation  → registry may route to an EscalationHandler MFE
   *
   * context.inputs must carry:
   *   stateKey: string             — semantic name ("analysis.complete", "form.submitted")
   *   stateData: Record<…>         — domain context the registry rules engine evaluates
   *   correlationId?: string       — links this update to the originating render/action
   *
   * The daemon routes this through sendAction → Registry handleMessage.
   * The registry re-evaluates rules and may resolve a new MFE + capability.
   * Available from 'ready' or 'rendering' — an MFE can push state mid-render.
   */
  public async updateControlPlaneState(context: Context): Promise<ControlPlaneStateResult> {
    return this.executeCapability(
      'updateControlPlaneState',
      (ctx) => this.doUpdateControlPlaneState(ctx),
      context
    );
  }
  
  // ===========================================================================
  // Abstract Methods (REQ-054, REQ-057)
  // Developer MUST implement these in concrete MFE class
  // ===========================================================================
  
  /**
   * Implement load logic for this MFE
   * Type-specific: Module Federation for 'remote', GraphQL Mesh for 'bff', etc.
   */
  protected abstract doLoad(context: Context): Promise<LoadResult>;
  
  /**
   * Implement render logic for this MFE
   */
  protected abstract doRender(context: Context): Promise<RenderResult>;
  
  /**
   * Implement refresh logic for this MFE
   */
  protected abstract doRefresh(context: Context): Promise<void>;
  
  /**
   * Implement authorization logic for this MFE
   */
  protected abstract doAuthorizeAccess(context: Context): Promise<boolean>;
  
  /**
   * Implement health check logic for this MFE
   */
  protected abstract doHealth(context: Context): Promise<HealthResult>;
  
  /**
   * Implement describe logic for this MFE
   */
  protected abstract doDescribe(context: Context): Promise<DescribeResult>;
  
  /**
   * Implement schema retrieval logic for this MFE
   */
  protected abstract doSchema(context: Context): Promise<SchemaResult>;
  
  /**
   * Execute a GraphQL query against this MFE's BFF endpoint.
   *
   * Default implementation dispatches `context.inputs.document` + `context.inputs.variables`
   * to the BFF URL resolved in priority order: context.inputs.bffUrl →
   * deps.bffUrl → BFF_URL env var → manifest.endpoint + manifest.data.serve.endpoint →
   * manifest.data.serve.endpoint → '/graphql'. See the numbered comment in the body
   * for the authoritative order.
   *
   * Override in concrete subclasses for typed, operation-specific queries:
   *
   *   protected async doQuery(context: Context): Promise<QueryResult> {
   *     const { document, variables } = context.inputs as QueryInput;
   *     const data = await bffQuery(document, variables, {
   *       ...(context.jwt ? { Authorization: `Bearer ${context.jwt}` } : {}),
   *     });
   *     return { data };
   *   }
   */
  protected async doQuery(context: Context): Promise<QueryResult> {
    const inputs = (context.inputs ?? {}) as Partial<QueryInput> & { bffUrl?: string };

    if (!inputs.document) {
      throw new RuntimeValidationError(
        'context.inputs.document is required for the query capability',
        'context.inputs.document',
        'required',
      );
    }

    // URL resolution order:
    //   1. context.inputs.bffUrl  — caller override (e.g. shell passing the remote's absolute URL)
    //   2. deps.bffUrl            — constructor injection
    //   3. BFF_URL env var        — runtime configuration
    //   4. manifest.endpoint + manifest.data.serve.endpoint — self-describing manifest
    //   5. manifest.data.serve.endpoint alone (relative path)
    //   6. '/graphql' fallback
    const m = this.manifest as { endpoint?: string; data?: { serve?: { endpoint?: string } } };
    const servePath = m.data?.serve?.endpoint ?? '/graphql';
    const derivedUrl = m.endpoint ? `${m.endpoint}${servePath}` : servePath;

    const bffUrl =
      inputs.bffUrl ??
      this.deps.bffUrl ??
      (typeof process !== 'undefined' ? process.env['BFF_URL'] : undefined) ??
      derivedUrl;

    const authHeaders: Record<string, string> = context.jwt
      ? { Authorization: `Bearer ${context.jwt}` }
      : {};

    const response = await fetch(bffUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(context.headers ?? {}),
        ...authHeaders,
      },
      body: JSON.stringify({ query: inputs.document, variables: inputs.variables }),
    });

    if (!response.ok) {
      return {
        data: null,
        errors: [{ message: `BFF request failed: ${response.status} ${response.statusText}` }],
      };
    }

    const json = (await response.json()) as { data?: unknown; errors?: Array<{ message: string; path?: string[] }> };
    return { data: json.data ?? null, errors: json.errors };
  }
  
  /**
   * Implement telemetry emission logic for this MFE
   */
  protected abstract doEmit(context: Context): Promise<EmitResult>;

  /**
   * Push meaningful domain state to the daemon/registry control plane.
   *
   * Called when this MFE has produced state that should influence registry
   * resolution — not telemetry, but semantic state the rules engine acts on.
   *
   * context.inputs:
   *   stateKey: string            — e.g. "analysis.complete", "form.submitted"
   *   stateData: Record<…>        — domain data the registry rules engine reads
   *   correlationId?: string      — link to the originating render/action
   *
   * Implementations send this via the daemon's sendAction → handleMessage path.
   * A WebSocket MFE sends a GraphQL mutation; a server-side MFE calls the
   * daemon's REST or WS endpoint directly.
   */
  protected abstract doUpdateControlPlaneState(context: Context): Promise<ControlPlaneStateResult>;
}

/**
 * BaseMFE Abstract Class
 * Following REQ-054: BaseMFE Abstract Class Contract
 * Following REQ-042: Lifecycle Hook Execution Semantics
 * Following ADR-047: BaseMFE Abstract Base (Not Type Hierarchy)
 * 
 * Universal base class for all MFE types (remote, bff, tool, agent).
 * MFE type determines generated code CONTENT in doCapability() methods.
 */

import type { DSLManifest, LifecycleHook, LifecycleHookEntry } from '../dsl/schema';

// =============================================================================
// Context Types (REQ-055)
// =============================================================================

/** User context extracted from JWT */
export interface UserContext {
  id: string;
  username: string;
  roles: string[];
  [key: string]: unknown;
}

/** Request context passed through lifecycle */
export interface Context {
  // Inputs to capability
  inputs?: Record<string, unknown>;
  
  // Outputs from capability (populated after main)
  outputs?: Record<string, unknown>;
  
  // Authentication
  jwt?: string;
  user?: UserContext;
  
  // HTTP context (if applicable)
  headers?: Record<string, string>;
  query?: Record<string, string>;
  
  // Runtime context
  timestamp: Date;
  requestId: string;
  
  // Error context (populated in error phase)
  error?: Error;
  
  // Lifecycle phase (internal use)
  phase?: 'before' | 'main' | 'after' | 'error';
  
  // Capability name (internal use)
  capability?: string;
  
  // Allow additional context data
  [key: string]: unknown;
}

// =============================================================================
// Result Types
// =============================================================================

/** Result from load capability */
export interface LoadResult {
  status: 'loaded' | 'error';
  container?: unknown;  // Module Federation container
  mesh?: unknown;       // GraphQL Mesh instance
  worker?: Worker;      // Web Worker instance
  timestamp: Date;
  [key: string]: unknown;
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
const VALID_TRANSITIONS: Record<MFEState, MFEState[]> = {
  uninitialized: ['loading'],
  loading: ['ready', 'error'],
  ready: ['loading', 'rendering', 'destroyed'],
  rendering: ['ready', 'error'],
  error: ['loading', 'destroyed'],
  destroyed: []
};

// =============================================================================
// Telemetry Event Types
// =============================================================================

/** Telemetry event */
export interface TelemetryEvent {
  eventType: 'error' | 'warn' | 'info' | 'metric';
  eventData: Record<string, unknown>;
  severity: 'error' | 'warn' | 'info';
  tags: string[];
  timestamp: Date;
  mfe: string;
}

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
  
  /** Current lifecycle state */
  protected state: MFEState = 'uninitialized';
  
  /** State transition history (for debugging) */
  protected stateHistory: Array<{ from: MFEState; to: MFEState; timestamp: Date }> = [];
  
  constructor(manifest: DSLManifest) {
    this.manifest = manifest;
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
    
    if (!validTransitions.includes(newState)) {
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
    // Find capability config
    const capabilityConfig = this.findCapabilityConfig(capability);
    if (!capabilityConfig?.lifecycle) {
      return; // No lifecycle hooks defined
    }
    
    const hooks = capabilityConfig.lifecycle[phase];
    if (!hooks || hooks.length === 0) {
      return; // No hooks for this phase
    }
    
    // Update context with phase and capability
    context.phase = phase;
    context.capability = capability;
    
    // Execute hooks sequentially
    for (const hookEntry of hooks) {
      await this.executeHookEntry(hookEntry, context, phase);
    }
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
      // Platform handler (REQ-058)
      const platformHandlerName = handlerName.slice(9); // Remove 'platform.' prefix
      await this.invokePlatformHandler(platformHandlerName, context);
    } else {
      // Custom handler (REQ-057)
      const customHandlerName = handlerName.replace('custom.', '');
      await this.invokeCustomHandler(customHandlerName, context);
    }
  }
  
  /**
   * Invoke a platform handler from standard library
   * @throws Error if platform handler not found
   */
  protected async invokePlatformHandler(name: string, context: Context): Promise<void> {
    // Platform handlers will be implemented in REQ-058
    // For now, throw error - this will be replaced with actual handler invocation
    throw new Error(
      `Platform handler not implemented: platform.${name}. ` +
      `Platform handlers will be available after REQ-058 implementation.`
    );
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
        `Implement this method in your MFE class: ` +
        `private async ${name}(context: Context): Promise<void> { ... }`
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
      eventType: 'error',
      eventData: {
        source: 'lifecycle-hook',
        hook: hookName,
        handler: handlerName,
        phase: context.phase,
        capability: context.capability,
        mfe: this.manifest.name,
        error: {
          message: error.message,
          stack: error.stack
        }
      },
      severity,
      tags: ['lifecycle', 'hook-failure'],
      timestamp: new Date(),
      mfe: this.manifest.name
    };
    
    // Use emit capability to send telemetry
    // In real implementation, this would send to monitoring system
    console.error('[Telemetry]', JSON.stringify(event, null, 2));
  }
  
  /**
   * Find capability configuration from manifest
   */
  private findCapabilityConfig(capability: string): any {
    if (!this.manifest.capabilities) {
      return null;
    }
    
    for (const entry of this.manifest.capabilities) {
      if (entry[capability]) {
        return entry[capability];
      }
    }
    
    return null;
  }
  
  // ===========================================================================
  // Platform Capabilities (REQ-054)
  // Generated wrappers that orchestrate lifecycle
  // ===========================================================================
  
  /**
   * Load capability: Initialize and prepare MFE for use
   * 
   * Generated wrapper - orchestrates lifecycle phases
   */
  public async load(context: Context): Promise<LoadResult> {
    this.assertState('uninitialized', 'ready', 'error');
    this.transitionState('loading');
    
    try {
      await this.executeLifecycle('load', 'before', context);
      await this.executeLifecycle('load', 'main', context);
      const result = await this.doLoad(context);
      await this.executeLifecycle('load', 'after', context);
      
      this.transitionState('ready');
      return result;
    } catch (error) {
      await this.executeLifecycle('load', 'error', { ...context, error: error as Error });
      this.transitionState('error');
      throw error;
    }
  }
  
  /**
   * Render capability: Render MFE UI into target container
   */
  public async render(context: Context): Promise<RenderResult> {
    this.assertState('ready');
    this.transitionState('rendering');
    
    try {
      await this.executeLifecycle('render', 'before', context);
      await this.executeLifecycle('render', 'main', context);
      const result = await this.doRender(context);
      await this.executeLifecycle('render', 'after', context);
      
      this.transitionState('ready');
      return result;
    } catch (error) {
      await this.executeLifecycle('render', 'error', { ...context, error: error as Error });
      this.transitionState('error');
      throw error;
    }
  }
  
  /**
   * Refresh capability: Refresh MFE data/state
   */
  public async refresh(context: Context): Promise<void> {
    this.assertState('ready');
    
    try {
      await this.executeLifecycle('refresh', 'before', context);
      await this.executeLifecycle('refresh', 'main', context);
      await this.doRefresh(context);
      await this.executeLifecycle('refresh', 'after', context);
    } catch (error) {
      await this.executeLifecycle('refresh', 'error', { ...context, error: error as Error });
      throw error;
    }
  }
  
  /**
   * AuthorizeAccess capability: Check authorization
   */
  public async authorizeAccess(context: Context): Promise<boolean> {
    this.assertState('ready');
    
    try {
      await this.executeLifecycle('authorizeAccess', 'before', context);
      await this.executeLifecycle('authorizeAccess', 'main', context);
      const result = await this.doAuthorizeAccess(context);
      await this.executeLifecycle('authorizeAccess', 'after', context);
      return result;
    } catch (error) {
      await this.executeLifecycle('authorizeAccess', 'error', { ...context, error: error as Error });
      throw error;
    }
  }
  
  /**
   * Health capability: Check MFE health status
   */
  public async health(context: Context): Promise<HealthResult> {
    // Health check can run in any state except destroyed
    this.assertState('uninitialized', 'loading', 'ready', 'rendering', 'error');
    
    try {
      await this.executeLifecycle('health', 'before', context);
      await this.executeLifecycle('health', 'main', context);
      const result = await this.doHealth(context);
      await this.executeLifecycle('health', 'after', context);
      return result;
    } catch (error) {
      await this.executeLifecycle('health', 'error', { ...context, error: error as Error });
      throw error;
    }
  }
  
  /**
   * Describe capability: Return MFE metadata
   */
  public async describe(context: Context): Promise<DescribeResult> {
    // Describe can run in any state
    this.assertState('uninitialized', 'loading', 'ready', 'rendering', 'error');
    
    try {
      await this.executeLifecycle('describe', 'before', context);
      await this.executeLifecycle('describe', 'main', context);
      const result = await this.doDescribe(context);
      await this.executeLifecycle('describe', 'after', context);
      return result;
    } catch (error) {
      await this.executeLifecycle('describe', 'error', { ...context, error: error as Error });
      throw error;
    }
  }
  
  /**
   * Schema capability: Return GraphQL/JSON schema
   */
  public async schema(context: Context): Promise<SchemaResult> {
    this.assertState('ready');
    
    try {
      await this.executeLifecycle('schema', 'before', context);
      await this.executeLifecycle('schema', 'main', context);
      const result = await this.doSchema(context);
      await this.executeLifecycle('schema', 'after', context);
      return result;
    } catch (error) {
      await this.executeLifecycle('schema', 'error', { ...context, error: error as Error });
      throw error;
    }
  }
  
  /**
   * Query capability: Execute data query
   */
  public async query(context: Context): Promise<QueryResult> {
    this.assertState('ready');
    
    try {
      await this.executeLifecycle('query', 'before', context);
      await this.executeLifecycle('query', 'main', context);
      const result = await this.doQuery(context);
      await this.executeLifecycle('query', 'after', context);
      return result;
    } catch (error) {
      await this.executeLifecycle('query', 'error', { ...context, error: error as Error });
      throw error;
    }
  }
  
  /**
   * Emit capability: Emit telemetry/events
   */
  public async emit(context: Context): Promise<EmitResult> {
    // Emit can run in any state
    
    try {
      await this.executeLifecycle('emit', 'before', context);
      await this.executeLifecycle('emit', 'main', context);
      const result = await this.doEmit(context);
      await this.executeLifecycle('emit', 'after', context);
      return result;
    } catch (error) {
      await this.executeLifecycle('emit', 'error', { ...context, error: error as Error });
      throw error;
    }
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
   * Implement query execution logic for this MFE
   */
  protected abstract doQuery(context: Context): Promise<QueryResult>;
  
  /**
   * Implement telemetry emission logic for this MFE
   */
  protected abstract doEmit(context: Context): Promise<EmitResult>;
}

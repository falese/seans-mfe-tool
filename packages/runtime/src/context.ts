/**
 * REQ-RUNTIME-002: Shared Context Across All Phases & Lifecycles
 *
 * Context flows through all lifecycle phases (before, main, after, error)
 * within a single capability execution, and across multiple capabilities
 * (load → render). The context carries user state, authentication, request
 * metadata, and capability-specific inputs/outputs.
 *
 * Core vs extensions: the interface below declares only the fields the
 * lifecycle engine and capabilities themselves read. Handler-owned state
 * (retry, fallback, cache, timeouts, …) is NOT part of the core — handlers
 * carry it under `extensions` (or, during migration, as ad-hoc fields via the
 * index signature) and own its type via accessors in their own modules
 * (retry-wrapper.ts, timeout-wrapper.ts, handlers/*).
 *
 * Related ADRs: ADR-002, ADR-013
 */

/**
 * User authentication and authorization context
 */
export interface UserContext {
  id: string;
  username: string;
  roles: string[];
  permissions?: string[];
  [key: string]: unknown;
}

/**
 * Shared context object that flows through all lifecycle phases
 * and across multiple capability invocations (load → render → query → emit)
 */
export interface Context {
  // === User & Authentication (set once, flows through all phases) ===
  
  /** Authenticated user information */
  user?: UserContext;
  
  /** JWT token for authentication */
  jwt?: string;
  
  /** Unique request identifier for tracing */
  requestId: string;
  
  /** Request timestamp */
  timestamp: Date;
  
  // === Capability-specific Data ===
  
  /** Inputs for the current capability (set before execution) */
  inputs?: Record<string, unknown>;
  
  /** Outputs from capability execution (populated during/after) */
  outputs?: Record<string, unknown>;
  
  // === HTTP/Request Metadata (if applicable) ===
  
  /** HTTP headers (for auth, content-type, etc.) */
  headers?: Record<string, string>;
  
  /** Query parameters from request URL */
  query?: Record<string, string>;
  
  // === Lifecycle Tracking (internal use by runtime) ===
  
  /** Current lifecycle phase */
  phase?: 'before' | 'main' | 'after' | 'error';
  
  /** Current capability being executed */
  capability?: 'load' | 'render' | 'refresh' | 'authorizeAccess' | 'health' | 'describe' | 'schema' | 'query' | 'emit' | 'updateControlPlaneState' | string;
  
  // === Error Context (populated in error phase) ===
  
  /** Error that triggered error phase */
  error?: Error;
  
  /** Number of retry attempts for current capability */
  retryCount?: number;
  
  // === Observability ===

  /** Telemetry data for observability */
  telemetry?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
    subphases?: Record<string, { start: number; duration: number }>;
    events?: TelemetryEvent[];
  };

  /** Telemetry emit function (injected by the engine, not handler state) */
  emit?: (event: TelemetryEvent) => Promise<void>;

  // === Handler-owned Extension Data ===

  /**
   * Handler-owned extension state, namespaced per handler. The shapes are
   * declared by the owning modules (e.g. RetryState in retry-wrapper.ts,
   * TimeoutState in timeout-wrapper.ts) — the core Context stays agnostic.
   */
  extensions?: Record<string, unknown>;

  /**
   * Backward-compat escape hatch: handlers historically wrote their state as
   * ad-hoc top-level fields (context.retry, context.timeouts, …). Those writes
   * keep compiling via this index signature; new code should use `extensions`.
   */
  [key: string]: unknown;
}

/**
 * Telemetry event structure
 */
export interface TelemetryEvent {
  name: string;
  capability: string;
  phase: string;
  user?: string;
  duration?: number;
  status: 'start' | 'end' | 'error' | 'success' | 'failure';
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Shape of context.inputs expected by the query capability.
 * Pass via ContextFactory.create({ inputs: { document, variables } })
 * or ContextFactory.cloneForCapability(ctx, 'query', { document, variables }).
 */
export interface QueryInput {
  /** GraphQL document string */
  document: string;
  /** GraphQL variables */
  variables?: Record<string, unknown>;
  /**
   * Caller-supplied BFF URL override — takes priority over all manifest/env defaults.
   * Use this when the shell knows the remote's absolute BFF endpoint
   * (e.g. 'http://localhost:3001/graphql') but the MFE's manifest has only a
   * relative serve.endpoint path. Omit when the manifest's `endpoint` field provides
   * the full origin already.
   */
  bffUrl?: string;
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  expected?: string;
  actual?: unknown;
}

/**
 * Context factory - creates a new context with required fields
 */
export class ContextFactory {
  /**
   * Create a new context for a capability invocation
   */
  static create(options: {
    user?: UserContext;
    jwt?: string;
    capability?: string;
    inputs?: Record<string, unknown>;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  } = {}): Context {
    return {
      requestId: this.generateRequestId(),
      timestamp: new Date(),
      user: options.user,
      jwt: options.jwt,
      capability: options.capability,
      inputs: options.inputs || {},
      outputs: {},
      headers: options.headers,
      query: options.query,
      retryCount: 0,
    };
  }
  
  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Clone context for a new capability while preserving user/auth
   */
  static cloneForCapability(
    source: Context,
    capability: string,
    inputs?: Record<string, unknown>
  ): Context {
    return {
      ...source,
      requestId: this.generateRequestId(), // New request ID
      timestamp: new Date(), // New timestamp
      capability,
      inputs: inputs || {},
      outputs: {}, // Clear outputs for new capability
      phase: undefined, // Reset phase
      retryCount: 0, // Reset retry count
      error: undefined, // Clear error
      // Preserve user, jwt, headers from source
    };
  }
  
  /**
   * Update context phase
   */
  static setPhase(context: Context, phase: Context['phase']): void {
    context.phase = phase;
  }
  
  /**
   * Record error in context
   */
  static recordError(context: Context, error: Error): void {
    context.error = error;
    context.phase = 'error';
  }
  
  /**
   * Increment retry count
   */
  static incrementRetry(context: Context): void {
    context.retryCount = (context.retryCount || 0) + 1;
  }
}

/**
 * Context validator - ensures context meets requirements
 */
export class ContextValidator {
  /**
   * Validate that context has required fields for a capability
   */
  static validate(context: Context, requirements: {
    requiresAuth?: boolean;
    requiresUser?: boolean;
    requiredInputs?: string[];
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!context.requestId) {
      errors.push('Context missing requestId');
    }
    
    if (!context.timestamp) {
      errors.push('Context missing timestamp');
    }
    
    if (requirements.requiresAuth && !context.jwt) {
      errors.push('Context missing JWT (authentication required)');
    }
    
    if (requirements.requiresUser && !context.user) {
      errors.push('Context missing user (user context required)');
    }
    
    if (requirements.requiredInputs) {
      for (const input of requirements.requiredInputs) {
        if (!context.inputs || !(input in context.inputs)) {
          errors.push(`Context missing required input: ${input}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Validate that user has required role
   */
  static validateUserRole(
    context: Context,
    requiredRoles: string[]
  ): { valid: boolean; error?: string } {
    if (!context.user) {
      return { valid: false, error: 'No user context' };
    }
    
    const hasRole = requiredRoles.some(role => 
      context.user!.roles.includes(role)
    );
    
    if (!hasRole) {
      return {
        valid: false,
        error: `User missing required role. Required: [${requiredRoles.join(', ')}], User has: [${context.user.roles.join(', ')}]`,
      };
    }
    
    return { valid: true };
  }
}

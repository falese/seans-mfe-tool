/**
 * REQ-RUNTIME-002: Shared Context Across All Phases & Lifecycles
 * 
 * Context flows through all lifecycle phases (before, main, after, error)
 * within a single capability execution, and across multiple capabilities
 * (load → render). The context carries user state, authentication, request
 * metadata, and capability-specific inputs/outputs.
 * 
 * Related ADRs: ADR-036, ADR-047
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
  capability?: 'load' | 'render' | 'query' | 'emit' | string;
  
  // === Error Context (populated in error phase) ===
  
  /** Error that triggered error phase */
  error?: Error;
  
  /** Number of retry attempts for current capability */
  retryCount?: number;
  
  // === Handler-specific Data (mutated by handlers) ===
  
  /** Telemetry data for observability */
  telemetry?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
    subphases?: Record<string, { start: number; duration: number }>;
    events?: TelemetryEvent[];
  };
  
  /** Cache control metadata */
  cache?: {
    key?: string;
    hit?: boolean;
    ttl?: number;
    fromCache?: boolean;
  };
  
  /** Validation results */
  validation?: {
    passed?: boolean;
    errors?: ValidationError[];
  };
  
  /** Error handling state */
  errorHandling?: {
    recoverable?: boolean;
    fallbackApplied?: boolean;
    retryStrategy?: 'exponential' | 'linear' | 'none';
  };
  
  /** Timeout tracking (REQ-LIFECYCLE-002) */
  timeouts?: Record<string, {
    occurred: boolean;
    elapsed: number;
    onTimeout: 'error' | 'warn' | 'skip';
  }>;
  
  /** Retry state (REQ-LIFECYCLE-005) */
  retry?: {
    attempt: number;
    maxRetries: number;
    isRetry: boolean;
    previousErrors: Array<{ message: string; timestamp: string }>;
  };
  
  /** Fallback handler state (REQ-LIFECYCLE-005) */
  fallback?: {
    active: boolean;
    reason: string;
    originalError: Error;
    retriesExhausted: number;
  };
  
  /** Handler registry for onRetry and fallback handlers */
  handlers?: Record<string, (context: Context) => Promise<any>>;
  
  /** Telemetry emit function */
  emit?: (event: {
    eventType: string;
    eventData: Record<string, unknown>;
    severity?: 'info' | 'warn' | 'error';
  }) => Promise<void>;
  
  /** Custom handler data (extensible for MFE-specific needs) */
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

# ADR-065: Error Classification with Hybrid Detection

**Status**: Proposed  
**Date**: 2025-12-11  
**Related**: REQ-LIFECYCLE-005, ADR-064 (Timeout Protection)

## Context

All errors are handled generically (log + continue/throw), regardless of error type. No distinction between:
- **Network errors** (retryable, transient)
- **Validation errors** (not retryable, user-facing)
- **Business errors** (not retryable, custom handling)
- **Security errors** (not retryable, audit log)

This leads to:
- Inappropriate retry (retrying validation errors wastes time)
- Poor UX (showing stack traces to users)
- Security issues (exposing sensitive error details)

**Example**: Payment processor retries validation error 3 times (wasting 6 seconds), then shows user full stack trace (security issue).

## Decision

Implement **typed error classes** with **hybrid detection** (typed errors preferred, pattern matching fallback).

### Design

#### 1. Typed Error Classes

```typescript
// src/runtime/errors/NetworkError.ts
export class NetworkError extends Error {
  readonly type = 'network';
  readonly retryable = true;
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}

// src/runtime/errors/ValidationError.ts
export class ValidationError extends Error {
  readonly type = 'validation';
  readonly retryable = false;
  readonly userFacing = true;
  field: string;
  constraint: string;
  
  constructor(message: string, field: string, constraint: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.constraint = constraint;
  }
}

// src/runtime/errors/SecurityError.ts
export class SecurityError extends Error {
  readonly type = 'security';
  readonly retryable = false;
  readonly auditLog = true;
  readonly userMessage = 'Access denied';  // Generic message for user
  
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SecurityError';
    Object.assign(this, details);
  }
}
```

**Error Types**:
- `network`: Connectivity issues (retryable)
- `validation`: User input errors (not retryable, user-facing)
- `business`: Business logic violations (not retryable, custom handling)
- `security`: Auth/authz (not retryable, audit log)
- `system`: Infrastructure failures (retryable, alert ops)
- `timeout`: Operation timeout (retryable, see ADR-064)

#### 2. Hybrid Error Detection

```yaml
lifecycle:
  before:
    - checkInventory:
        handler: verifyStock
        errorHandling:
          types:
            # Typed errors (preferred)
            - type: network
              retryable: true
              maxRetries: 3
              backoff: exponential
              baseDelay: 1000
              maxDelay: 10000
              jitter: true
              
            # Pattern matching (fallback for third-party handlers)
            - pattern: "ECONNREFUSED|ETIMEDOUT|ENOTFOUND"
              type: network
              retryable: true
              
            - pattern: "Invalid|ValidationError"
              type: validation
              retryable: false
              userFacing: true
              message: "Invalid input"
```

**Detection Algorithm**:
```typescript
function classifyError(error: Error, config: ErrorHandlingConfig): ErrorClassification {
  // 1. Check if error has 'type' property (typed error)
  if ('type' in error && typeof error.type === 'string') {
    return {
      type: error.type,
      retryable: error.retryable ?? false,
      userFacing: error.userFacing ?? false,
      // ... other properties from error object
    };
  }
  
  // 2. Pattern matching (fallback)
  for (const typeConfig of config.types) {
    if (typeConfig.pattern) {
      const regex = new RegExp(typeConfig.pattern);
      if (regex.test(error.message)) {
        return {
          type: typeConfig.type,
          retryable: typeConfig.retryable,
          userFacing: typeConfig.userFacing,
          // ... other properties from config
        };
      }
    }
  }
  
  // 3. Generic error (not retryable, log stack)
  return {
    type: 'unknown',
    retryable: false,
    userFacing: false
  };
}
```

#### 3. Retry Strategy with Exponential Backoff

```typescript
async function retryWithBackoff(
  handler: () => Promise<void>,
  config: RetryConfig,
  context: Context
): Promise<void> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Mark retry state in context
      context.retry = {
        attempt,
        maxRetries: config.maxRetries,
        isRetry: attempt > 0,
        previousErrors: lastError ? [lastError] : []
      };
      
      // Call onRetry hook if configured
      if (attempt > 0 && config.onRetry) {
        await this.invokeHandler(config.onRetry, context);
      }
      
      // Attempt handler execution
      await handler();
      return;  // Success
      
    } catch (error) {
      lastError = error;
      
      // Check if retryable
      const classification = classifyError(error, config);
      if (!classification.retryable || attempt === config.maxRetries) {
        throw error;  // Not retryable or exhausted retries
      }
      
      // Calculate backoff delay
      const delay = calculateBackoff(config, attempt);
      
      // Emit telemetry
      await this.emitRetry(attempt, delay, error, context);
      
      // Wait before retry
      await sleep(delay);
    }
  }
}

function calculateBackoff(config: RetryConfig, attempt: number): number {
  let delay: number;
  
  if (config.backoff === 'exponential') {
    delay = config.baseDelay * Math.pow(2, attempt);
  } else if (config.backoff === 'linear') {
    delay = config.baseDelay * (attempt + 1);
  } else {  // constant
    delay = config.baseDelay;
  }
  
  // Cap at maxDelay
  delay = Math.min(delay, config.maxDelay);
  
  // Add jitter (±20% random)
  if (config.jitter) {
    const jitterRange = delay * 0.2;
    delay += Math.random() * jitterRange - jitterRange / 2;
  }
  
  return Math.round(delay);
}
```

#### 4. onRetry Hook

```yaml
errorHandling:
  types:
    - type: network
      retryable: true
      maxRetries: 3
      onRetry: adjustContext  # Custom handler called before each retry
```

**Handler Implementation**:
```typescript
async function adjustContext(context: Context): Promise<void> {
  // Modify context before retry
  if (context.retry.attempt === 1) {
    // First retry: increase timeout
    context.timeout = (context.timeout || 3000) * 1.5;
  } else if (context.retry.attempt === 2) {
    // Second retry: switch to backup endpoint
    context.endpoint = 'https://backup.api.example.com';
  }
  
  // Log retry
  console.log(`Retrying (attempt ${context.retry.attempt})...`);
}
```

#### 5. Fallback Handler with Modified Context

```yaml
errorHandling:
  types:
    - type: network
      retryable: true
      maxRetries: 3
      fallbackHandler: useCachedAuth
```

**Context Modification**:
```typescript
// After all retries exhausted
context.fallback = {
  active: true,
  reason: 'network',
  originalError: error,
  retriesExhausted: 3
};

// Invoke fallback handler
await this.invokeHandler('useCachedAuth', context);
```

**Fallback Handler**:
```typescript
async function useCachedAuth(context: Context): Promise<void> {
  if (context.fallback?.active) {
    console.log(`Using fallback: ${context.fallback.reason}`);
    
    // Fetch from cache instead of API
    const cached = await cache.get('last_auth_result');
    if (cached) {
      context.user = cached.user;
      context.outputs = { ...cached, fromCache: true };
    } else {
      throw new Error('Cache miss - no fallback available');
    }
  }
}
```

#### 6. User-Facing vs. Internal Errors

```typescript
function formatErrorResponse(error: Error, classification: ErrorClassification) {
  if (classification.userFacing) {
    // Sanitized error for user
    return {
      error: {
        type: classification.type,
        message: classification.message || error.message,
        field: (error as ValidationError).field,
        code: `ERR_${classification.type.toUpperCase()}`
      }
    };
  } else if (classification.type === 'security') {
    // Generic message for security errors
    return {
      error: {
        type: 'security',
        message: 'Access denied',
        code: 'ERR_ACCESS_DENIED'
      }
    };
  } else {
    // Internal error (developer-facing)
    return {
      error: {
        type: classification.type,
        message: 'Internal server error',
        code: 'ERR_INTERNAL'
      }
    };
  }
}

// Always log full details internally
function logError(error: Error, context: Context) {
  logger.error({
    message: error.message,
    stack: error.stack,
    type: (error as any).type,
    context: sanitizeContext(context),
    timestamp: new Date()
  });
  
  // Audit log for security errors
  if ((error as any).type === 'security') {
    auditLogger.log({
      event: 'security_error',
      user: context.user,
      error: error.message,
      timestamp: new Date()
    });
  }
}
```

## Consequences

### Positive

✅ **Resilience**: Smart retry for transient failures  
✅ **User Experience**: User-friendly error messages  
✅ **Security**: Sensitive errors logged, not exposed  
✅ **Cost**: Reduce unnecessary retries (90% reduction)  
✅ **Flexibility**: Hybrid detection works with any handler

### Negative

❌ **Complexity**: Error classification logic adds overhead  
❌ **Migration**: Handlers must throw typed errors (or use patterns)  
❌ **Pattern Brittleness**: Regex matching can be fragile

### Trade-offs

- **Chosen**: Hybrid detection (typed + pattern matching)
- **Rejected**: Typed-only (breaks third-party handlers)
- **Rejected**: Pattern-only (brittle, no compile-time checks)

## Alternatives Considered

### 1. Typed Errors Only

Require all handlers to throw typed errors.

**Rejected**: Breaks third-party handlers (fetch, axios, etc.) that throw generic errors.

### 2. Pattern Matching Only

```yaml
errorHandling:
  - pattern: "ECONNREFUSED"
    retryable: true
```

**Rejected**: Brittle (depends on error message format), no compile-time checks.

### 3. HTTP Status Code Mapping

Map HTTP status codes to error types (500 = retryable, 400 = validation).

**Rejected**: Not all errors are HTTP-related (database, filesystem, etc.).

## Implementation Notes

- Create typed error classes in `src/runtime/errors/`
- Implement classification logic in `src/runtime/handlers/error-handling.ts`
- Use regex for pattern matching (compiled and cached)
- Store error config in manifest schema
- Integrate with timeout protection (ADR-064)

## Testing Strategy

- [ ] Unit test: Typed error classification
- [ ] Unit test: Pattern matching fallback
- [ ] Unit test: Exponential backoff calculation
- [ ] Unit test: Linear backoff calculation
- [ ] Unit test: Jitter application (±20%)
- [ ] Unit test: onRetry hook invocation
- [ ] Unit test: Fallback handler with modified context
- [ ] Unit test: User-facing error sanitization
- [ ] Unit test: Security error audit logging
- [ ] Integration test: Retry + timeout
- [ ] Integration test: Error classification + parallel execution

## Success Metrics

- [ ] 90% reduction in unnecessary retries
- [ ] 100% of security errors sanitized
- [ ] Zero sensitive data in user-facing errors
- [ ] 100% test coverage

## Related Documents

- [Lifecycle Engine Analysis](../lifecycle-engine-analysis.md)
- [REQ-LIFECYCLE-005](../requirements/lifecycle-enhancements.md#req-lifecycle-005)
- ADR-064: Timeout Protection

---

**Status**: Proposed  
**Decision Makers**: Platform Team, Security Team  
**Next Steps**: Implement typed errors, classification logic, retry wrapper

# Code Review & Implementation Plan

## Issues #60 & #61: Timeout Protection & Error Classification

**Date**: 2025-12-13  
**Reviewers**: Platform Team  
**Status**: Ready for Implementation

---

## Executive Summary

This document provides a comprehensive code review and implementation plan for:

- **Issue #60**: REQ-LIFECYCLE-002 - Timeout Protection for Handler Execution
- **Issue #61**: REQ-LIFECYCLE-005 - Error Classification with Hybrid Detection & Smart Retry

Both features are **Phase 1** (Foundation) enhancements critical for operational safety and reliability.

### Key Findings

✅ **Well-Defined Requirements**: Both issues have complete requirements, ADRs, and acceptance criteria  
✅ **Clear Dependencies**: Issue #61 depends on #60 (TimeoutError integration)  
⚠️ **Implementation Gaps**: Current codebase lacks timeout and retry infrastructure  
⚠️ **Test Coverage**: Existing error handling minimal, needs comprehensive test suite

---

## Architecture Review

### Current State Analysis

#### 1. Base Infrastructure (`src/runtime/base-mfe.ts`)

**Current Handler Invocation**:

```typescript
// Lines 1-100: BaseMFE has lifecycle executor abstraction
export interface LifecycleExecutor {
  execute(hook: LifecycleHook, context: Context, phase: string): Promise<void>;
}
```

**Findings**:

- ✅ **Dependency injection ready**: LifecycleExecutor interface allows timeout/retry wrappers
- ✅ **Context-based**: All handlers receive Context object
- ⚠️ **No timeout mechanism**: No Promise.race or AbortController integration
- ⚠️ **Generic error handling**: ErrorHandler interface exists but minimal implementation

**Impact**: Foundation is solid for enhancements, minimal breaking changes needed

#### 2. Error Handling (`src/runtime/handlers/error-handling.ts`)

**Current Implementation**:

```typescript
export async function handleError(context: Context, error: Error): Promise<void> {
  // Basic telemetry emission only
  // No classification, retry, or timeout handling
}
```

**Findings**:

- ❌ **No error classification**: All errors treated as generic Error
- ❌ **No retry logic**: No retry mechanism exists
- ❌ **No timeout handling**: No TimeoutError class or handling
- ✅ **Telemetry integration**: Error emission framework exists

**Impact**: Full implementation needed from scratch

#### 3. Handler Registry (`src/runtime/handlers/`)

**Current Handlers**:

- `auth.ts` - Authentication (50 lines)
- `caching.ts` - Cache operations (40 lines)
- `rate-limiting.ts` - Rate limiting (45 lines)
- `validation.ts` - Input validation (55 lines)
- `telemetry.ts` - Event emission (30 lines)

**Findings**:

- ✅ **Consistent pattern**: All handlers follow `(context: Context) => Promise<void>` signature
- ⚠️ **No AbortSignal support**: None accept `options: { signal?: AbortSignal }`
- ⚠️ **No timeout awareness**: Handlers don't check context.retry state

**Impact**: Platform handlers need signature update for AbortSignal

---

## Issue #60: Timeout Protection

### Requirements Checklist

#### REQ-LIFECYCLE-002.1: Handler-Level Timeout ✅

```yaml
lifecycle:
  before:
    - validateFile:
        handler: checkFileSize
        timeout: 5000
        onTimeout: 'error' # "error" | "warn" | "skip"
```

**Implementation Approach**:

1. Add `timeout` and `onTimeout` fields to LifecycleHookEntry schema
2. Create TimeoutError class in `src/runtime/errors/TimeoutError.ts`
3. Wrap handler invocation with Promise.race pattern

#### REQ-LIFECYCLE-002.2: Global Timeout Defaults ✅

```yaml
timeouts:
  phases:
    before: 5000
    main: 30000
    after: 10000
  handlers:
    platform.auth: 3000
```

**Implementation Approach**:

1. Add timeout config to manifest schema or runtime config
2. Implement precedence resolution: hook → handler → phase → global (30s)
3. Store in ManifestParser or configuration service

#### REQ-LIFECYCLE-002.3: Timeout Behavior ✅

**Context Marking**:

```typescript
context.timeouts = context.timeouts || {};
context.timeouts[hookName] = {
  occurred: true,
  elapsed: 5123,
  onTimeout: 'error',
};
```

**Interaction with `contained` flag**:

```yaml
before:
  - slowOperation:
      handler: deepValidation
      timeout: 5000
      onTimeout: 'error'
      contained: true # Timeout treated as warning
```

#### REQ-LIFECYCLE-002.4: Retry Integration ✅

Integration tested in Issue #61 (Error Classification)

#### REQ-LIFECYCLE-002.5: Telemetry ✅

```typescript
telemetry.emit({
  eventType: 'lifecycle.timeout',
  eventData: {
    hook: 'validateFile',
    timeout: 5000,
    elapsed: 5123,
    onTimeout: 'error',
  },
  severity: 'error',
});
```

### Implementation Files

#### New Files

1. **`src/runtime/errors/TimeoutError.ts`**

```typescript
export class TimeoutError extends Error {
  readonly type = 'timeout';
  readonly retryable = true;
  readonly elapsed: number;
  readonly timeout: number;

  constructor(message: string, timeout: number, elapsed: number) {
    super(message);
    this.name = 'TimeoutError';
    this.timeout = timeout;
    this.elapsed = elapsed;
  }
}
```

2. **`src/runtime/timeout-wrapper.ts`**

```typescript
import { TimeoutError } from './errors/TimeoutError';
import { Context } from './context';

export interface TimeoutOptions {
  timeoutMs: number;
  onTimeout: 'error' | 'warn' | 'skip';
  hookName: string;
  signal?: AbortSignal;
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions,
  context: Context
): Promise<T> {
  const abortController = new AbortController();
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(
        new TimeoutError(
          `Handler '${options.hookName}' timed out after ${options.timeoutMs}ms`,
          options.timeoutMs,
          options.timeoutMs
        )
      );
    }, options.timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof TimeoutError) {
      // Mark context
      context.timeouts = context.timeouts || {};
      context.timeouts[options.hookName] = {
        occurred: true,
        elapsed: options.timeoutMs,
        onTimeout: options.onTimeout,
      };

      // Emit telemetry
      if (context.emit) {
        await context.emit({
          eventType: 'lifecycle.timeout',
          eventData: {
            hook: options.hookName,
            timeout: options.timeoutMs,
            elapsed: options.timeoutMs,
            onTimeout: options.onTimeout,
          },
          severity: options.onTimeout === 'error' ? 'error' : 'warn',
        });
      }

      // Handle based on onTimeout
      if (options.onTimeout === 'error') {
        throw error;
      } else if (options.onTimeout === 'warn') {
        console.warn(`Handler '${options.hookName}' timed out (continued)`);
        return undefined as T; // Allow continuation
      }
      // onTimeout === 'skip': silent continue
      return undefined as T;
    }

    throw error;
  }
}
```

3. **`src/runtime/__tests__/timeout-wrapper.test.ts`**

```typescript
import { withTimeout } from '../timeout-wrapper';
import { TimeoutError } from '../errors/TimeoutError';
import { Context } from '../context';

describe('withTimeout', () => {
  let context: Context;

  beforeEach(() => {
    context = {
      mfeName: 'test-mfe',
      capability: 'load',
      phase: 'before',
      inputs: {},
      outputs: {},
      metadata: {},
      emit: jest.fn(),
    };
  });

  it('should resolve if handler completes before timeout', async () => {
    const handler = jest.fn().mockResolvedValue('success');

    const result = await withTimeout(
      handler,
      {
        timeoutMs: 1000,
        onTimeout: 'error',
        hookName: 'testHook',
      },
      context
    );

    expect(result).toBe('success');
    expect(handler).toHaveBeenCalled();
    expect(context.timeouts).toBeUndefined();
  });

  it('should throw TimeoutError if handler exceeds timeout', async () => {
    const handler = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    await expect(
      withTimeout(
        handler,
        {
          timeoutMs: 100,
          onTimeout: 'error',
          hookName: 'slowHandler',
        },
        context
      )
    ).rejects.toThrow(TimeoutError);

    expect(context.timeouts?.slowHandler).toEqual({
      occurred: true,
      elapsed: 100,
      onTimeout: 'error',
    });
  });

  it('should log warning and continue if onTimeout is warn', async () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    const handler = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    const result = await withTimeout(
      handler,
      {
        timeoutMs: 100,
        onTimeout: 'warn',
        hookName: 'slowHandler',
      },
      context
    );

    expect(result).toBeUndefined();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('timed out (continued)'));
    expect(context.timeouts?.slowHandler?.occurred).toBe(true);

    consoleWarn.mockRestore();
  });

  it('should silently continue if onTimeout is skip', async () => {
    const handler = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    const result = await withTimeout(
      handler,
      {
        timeoutMs: 100,
        onTimeout: 'skip',
        hookName: 'slowHandler',
      },
      context
    );

    expect(result).toBeUndefined();
    expect(context.timeouts?.slowHandler).toBeUndefined(); // No marking for skip
  });

  it('should emit telemetry event on timeout', async () => {
    const handler = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)));

    await expect(
      withTimeout(
        handler,
        {
          timeoutMs: 100,
          onTimeout: 'error',
          hookName: 'slowHandler',
        },
        context
      )
    ).rejects.toThrow(TimeoutError);

    expect(context.emit).toHaveBeenCalledWith({
      eventType: 'lifecycle.timeout',
      eventData: {
        hook: 'slowHandler',
        timeout: 100,
        elapsed: 100,
        onTimeout: 'error',
      },
      severity: 'error',
    });
  });
});
```

#### Modified Files

1. **`src/runtime/base-mfe.ts`** - Add timeout support to lifecycle executor
2. **`src/runtime/handlers/index.ts`** - Update handler signature to accept AbortSignal
3. **`src/dsl/schema.ts`** - Add timeout fields to LifecycleHookEntry

### Test Coverage Requirements

- [ ] Unit tests: 100% coverage for timeout-wrapper.ts
- [ ] Unit tests: 100% coverage for TimeoutError.ts
- [ ] Integration test: Timeout + contained flag
- [ ] Integration test: Timeout precedence (hook > handler > phase > global)
- [ ] Integration test: AbortSignal passed to handlers
- [ ] Performance test: Timeout overhead < 10ms

### Acceptance Criteria Validation

From `docs/acceptance-criteria/lifecycle-enhancements.feature`:

```gherkin
Feature: Timeout Protection

  Scenario: Handler exceeds timeout with onTimeout error
    Given a lifecycle hook with timeout 100ms and onTimeout error
    When the handler takes 200ms to complete
    Then a TimeoutError is thrown
    And the error phase is triggered
    And telemetry event 'lifecycle.timeout' is emitted

  Scenario: Handler exceeds timeout with onTimeout warn
    Given a lifecycle hook with timeout 100ms and onTimeout warn
    When the handler takes 200ms to complete
    Then a warning is logged
    And execution continues to next hook
    And context.timeouts[hookName].occurred is true

  Scenario: Timeout precedence
    Given global timeout default is 30000ms
    And phase timeout for 'before' is 5000ms
    And handler timeout for 'platform.auth' is 3000ms
    And hook timeout is 1000ms
    When the hook executes
    Then the timeout is 1000ms
```

---

## Issue #61: Error Classification & Smart Retry

### Requirements Checklist

#### REQ-LIFECYCLE-005.1: Typed Error Classes ✅

**Error Hierarchy**:

```typescript
// Base typed error
interface TypedError extends Error {
  type: 'network' | 'validation' | 'business' | 'security' | 'system' | 'timeout';
  retryable: boolean;
}

// Specific error classes
class NetworkError extends Error {
  readonly type = 'network';
  readonly retryable = true;
  statusCode: number;
}

class ValidationError extends Error {
  readonly type = 'validation';
  readonly retryable = false;
  readonly userFacing = true;
  field: string;
  constraint: string;
}

class SecurityError extends Error {
  readonly type = 'security';
  readonly retryable = false;
  readonly auditLog = true;
  readonly userMessage = 'Access denied';
}
```

#### REQ-LIFECYCLE-005.2: Hybrid Error Detection ✅

**Detection Algorithm**:

```typescript
function classifyError(error: Error, config: ErrorHandlingConfig): ErrorClassification {
  // 1. Check typed error
  if ('type' in error && typeof error.type === 'string') {
    return { type: error.type, retryable: error.retryable ?? false };
  }

  // 2. Pattern matching
  for (const typeConfig of config.types) {
    if (typeConfig.pattern && new RegExp(typeConfig.pattern).test(error.message)) {
      return { type: typeConfig.type, retryable: typeConfig.retryable };
    }
  }

  // 3. Generic error
  return { type: 'unknown', retryable: false };
}
```

#### REQ-LIFECYCLE-005.3: Retry Strategy ✅

**Exponential Backoff**:

```typescript
function calculateBackoff(config: RetryConfig, attempt: number): number {
  let delay: number;

  if (config.backoff === 'exponential') {
    delay = config.baseDelay * Math.pow(2, attempt);
  } else if (config.backoff === 'linear') {
    delay = config.baseDelay * (attempt + 1);
  } else {
    delay = config.baseDelay; // constant
  }

  // Cap at maxDelay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter (±20%)
  if (config.jitter) {
    const jitterRange = delay * 0.2;
    delay += Math.random() * jitterRange - jitterRange / 2;
  }

  return Math.round(delay);
}
```

**Expected Backoff Values**:

- Attempt 0 (base): 1000ms
- Attempt 1: 2000ms ± 400ms (jitter)
- Attempt 2: 4000ms ± 800ms (capped at maxDelay if set)
- Attempt 3: 8000ms ± 1600ms

#### REQ-LIFECYCLE-005.4: Retry State in Context ✅

```typescript
context.retry = {
  attempt: 2,
  maxRetries: 3,
  isRetry: true,
  previousErrors: [{ message: 'ETIMEDOUT', timestamp: '2025-12-13T14:00:00Z' }],
};
```

#### REQ-LIFECYCLE-005.5: onRetry Hook ✅

Handler receives context with retry state, can modify before next attempt.

#### REQ-LIFECYCLE-005.6: Fallback Handler ✅

```typescript
context.fallback = {
  active: true,
  reason: 'network',
  originalError: error,
  retriesExhausted: 3,
};
```

#### REQ-LIFECYCLE-005.7: User-Facing Error Messages ✅

Sanitized error responses with field-level details for validation errors.

#### REQ-LIFECYCLE-005.8: Security Error Handling ✅

Generic message for users, full details in audit log.

#### REQ-LIFECYCLE-005.9: Telemetry ✅

Track classification, retry attempts, and fallback invocations.

### Implementation Files

#### New Files

1. **`src/runtime/errors/NetworkError.ts`**

```typescript
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
```

2. **`src/runtime/errors/ValidationError.ts`**

```typescript
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
```

3. **`src/runtime/errors/SecurityError.ts`**

```typescript
export class SecurityError extends Error {
  readonly type = 'security';
  readonly retryable = false;
  readonly auditLog = true;
  readonly userMessage = 'Access denied';

  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}
```

4. **`src/runtime/errors/BusinessError.ts`**

```typescript
export class BusinessError extends Error {
  readonly type = 'business';
  readonly retryable = false;
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details || {};
  }
}
```

5. **`src/runtime/errors/SystemError.ts`**

```typescript
export class SystemError extends Error {
  readonly type = 'system';
  readonly retryable = true;

  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'SystemError';
  }
}
```

6. **`src/runtime/errors/index.ts`**

```typescript
export { TimeoutError } from './TimeoutError';
export { NetworkError } from './NetworkError';
export { ValidationError } from './ValidationError';
export { SecurityError } from './SecurityError';
export { BusinessError } from './BusinessError';
export { SystemError } from './SystemError';
```

7. **`src/runtime/error-classifier.ts`**

```typescript
import { Context } from './context';

export interface ErrorClassification {
  type: 'network' | 'validation' | 'business' | 'security' | 'system' | 'timeout' | 'unknown';
  retryable: boolean;
  userFacing?: boolean;
  auditLog?: boolean;
  userMessage?: string;
}

export interface ErrorHandlingConfig {
  types: Array<{
    type: string;
    pattern?: string;
    retryable: boolean;
    maxRetries?: number;
    backoff?: 'exponential' | 'linear' | 'constant';
    baseDelay?: number;
    maxDelay?: number;
    jitter?: boolean;
    onRetry?: string;
    fallbackHandler?: string;
    userFacing?: boolean;
    message?: string;
  }>;
}

export function classifyError(error: Error, config: ErrorHandlingConfig): ErrorClassification {
  // 1. Check if error has 'type' property (typed error)
  if ('type' in error && typeof (error as any).type === 'string') {
    const typedError = error as any;
    return {
      type: typedError.type,
      retryable: typedError.retryable ?? false,
      userFacing: typedError.userFacing ?? false,
      auditLog: typedError.auditLog ?? false,
      userMessage: typedError.userMessage,
    };
  }

  // 2. Pattern matching (fallback)
  for (const typeConfig of config.types) {
    if (typeConfig.pattern) {
      const regex = new RegExp(typeConfig.pattern);
      if (regex.test(error.message)) {
        return {
          type: typeConfig.type as any,
          retryable: typeConfig.retryable,
          userFacing: typeConfig.userFacing,
          userMessage: typeConfig.message,
        };
      }
    }
  }

  // 3. Generic error (not retryable, log stack)
  return {
    type: 'unknown',
    retryable: false,
    userFacing: false,
  };
}

export function formatErrorResponse(error: Error, classification: ErrorClassification) {
  if (classification.userFacing) {
    // Sanitized error for user
    return {
      error: {
        type: classification.type,
        message: classification.userMessage || error.message,
        field: (error as any).field,
        code: `ERR_${classification.type.toUpperCase()}`,
      },
    };
  } else if (classification.type === 'security') {
    // Generic message for security errors
    return {
      error: {
        type: 'security',
        message: 'Access denied',
        code: 'ERR_ACCESS_DENIED',
      },
    };
  } else {
    // Internal error (developer-facing)
    return {
      error: {
        type: classification.type,
        message: 'Internal server error',
        code: 'ERR_INTERNAL',
      },
    };
  }
}
```

8. **`src/runtime/retry-wrapper.ts`**

```typescript
import { Context } from './context';
import { classifyError, ErrorHandlingConfig, ErrorClassification } from './error-classifier';

export interface RetryConfig {
  maxRetries: number;
  backoff: 'exponential' | 'linear' | 'constant';
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  onRetry?: string;
  fallbackHandler?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  errorConfig: ErrorHandlingConfig,
  context: Context,
  hookName: string
): Promise<T> {
  let lastError: Error;
  const previousErrors: Array<{ message: string; timestamp: string }> = [];

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Mark retry state in context
      context.retry = {
        attempt,
        maxRetries: config.maxRetries,
        isRetry: attempt > 0,
        previousErrors,
      };

      // Call onRetry hook if configured
      if (attempt > 0 && config.onRetry && context.handlers?.[config.onRetry]) {
        await context.handlers[config.onRetry](context);
      }

      // Emit retry telemetry
      if (attempt > 0 && context.emit) {
        await context.emit({
          eventType: 'lifecycle.error.retry',
          eventData: {
            attempt,
            previousError: lastError?.message,
            handler: hookName,
          },
          severity: 'warn',
        });
      }

      // Attempt handler execution
      const result = await fn();

      // Success - clear retry state
      delete context.retry;
      return result;
    } catch (error) {
      lastError = error as Error;
      previousErrors.push({
        message: error.message,
        timestamp: new Date().toISOString(),
      });

      // Classify error
      const classification = classifyError(error as Error, errorConfig);

      // Emit classification telemetry
      if (context.emit) {
        await context.emit({
          eventType: 'lifecycle.error.classified',
          eventData: {
            errorType: classification.type,
            retryable: classification.retryable,
            attempt,
            maxRetries: config.maxRetries,
            handler: hookName,
          },
          severity: 'error',
        });
      }

      // Check if retryable
      if (!classification.retryable || attempt === config.maxRetries) {
        // Attempt fallback handler if configured
        if (attempt === config.maxRetries && config.fallbackHandler) {
          return await invokeFallbackHandler(
            config.fallbackHandler,
            context,
            lastError,
            config.maxRetries,
            classification
          );
        }

        delete context.retry;
        throw error;
      }

      // Calculate backoff delay
      const delay = calculateBackoff(config, attempt);

      // Emit backoff telemetry
      if (context.emit) {
        await context.emit({
          eventType: 'lifecycle.error.backoff',
          eventData: {
            attempt,
            delay,
            backoff: config.backoff,
            handler: hookName,
          },
          severity: 'info',
        });
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  throw lastError!;
}

function calculateBackoff(config: RetryConfig, attempt: number): number {
  let delay: number;

  if (config.backoff === 'exponential') {
    delay = config.baseDelay * Math.pow(2, attempt);
  } else if (config.backoff === 'linear') {
    delay = config.baseDelay * (attempt + 1);
  } else {
    delay = config.baseDelay; // constant
  }

  // Cap at maxDelay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter (±20%)
  if (config.jitter) {
    const jitterRange = delay * 0.2;
    delay += Math.random() * jitterRange - jitterRange / 2;
  }

  return Math.round(delay);
}

async function invokeFallbackHandler<T>(
  fallbackHandlerName: string,
  context: Context,
  originalError: Error,
  retriesExhausted: number,
  classification: ErrorClassification
): Promise<T> {
  // Mark fallback mode in context
  context.fallback = {
    active: true,
    reason: classification.type,
    originalError,
    retriesExhausted,
  };

  // Emit fallback telemetry
  if (context.emit) {
    await context.emit({
      eventType: 'lifecycle.error.fallback',
      eventData: {
        retriesExhausted,
        fallbackHandler: fallbackHandlerName,
        originalError: originalError.message,
      },
      severity: 'warn',
    });
  }

  // Invoke fallback handler
  const handler = context.handlers?.[fallbackHandlerName];
  if (!handler) {
    throw new Error(`Fallback handler '${fallbackHandlerName}' not found`);
  }

  const result = await handler(context);

  // Clear fallback state
  delete context.fallback;

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

9. **`src/runtime/__tests__/retry-wrapper.test.ts`**

```typescript
import { withRetry, RetryConfig } from '../retry-wrapper';
import { ErrorHandlingConfig } from '../error-classifier';
import { NetworkError } from '../errors/NetworkError';
import { ValidationError } from '../errors/ValidationError';
import { Context } from '../context';

describe('withRetry', () => {
  let context: Context;
  let errorConfig: ErrorHandlingConfig;

  beforeEach(() => {
    context = {
      mfeName: 'test-mfe',
      capability: 'load',
      phase: 'before',
      inputs: {},
      outputs: {},
      metadata: {},
      emit: jest.fn(),
    };

    errorConfig = {
      types: [
        {
          type: 'network',
          retryable: true,
          maxRetries: 3,
          backoff: 'exponential',
          baseDelay: 100,
          maxDelay: 1000,
          jitter: false,
        },
        {
          type: 'validation',
          retryable: false,
        },
      ],
    };
  });

  it('should succeed on first attempt', async () => {
    const handler = jest.fn().mockResolvedValue('success');

    const result = await withRetry(
      handler,
      { maxRetries: 3, backoff: 'exponential', baseDelay: 100, maxDelay: 1000, jitter: false },
      errorConfig,
      context,
      'testHandler'
    );

    expect(result).toBe('success');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(context.retry).toBeUndefined();
  });

  it('should retry network errors with exponential backoff', async () => {
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Connection refused', 503))
      .mockRejectedValueOnce(new NetworkError('Connection refused', 503))
      .mockResolvedValue('success');

    const result = await withRetry(
      handler,
      { maxRetries: 3, backoff: 'exponential', baseDelay: 100, maxDelay: 1000, jitter: false },
      errorConfig,
      context,
      'testHandler'
    );

    expect(result).toBe('success');
    expect(handler).toHaveBeenCalledTimes(3);
    expect(context.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'lifecycle.error.retry',
      })
    );
  });

  it('should not retry validation errors', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new ValidationError('Invalid input', 'email', 'format'));

    await expect(
      withRetry(
        handler,
        { maxRetries: 3, backoff: 'exponential', baseDelay: 100, maxDelay: 1000, jitter: false },
        errorConfig,
        context,
        'testHandler'
      )
    ).rejects.toThrow(ValidationError);

    expect(handler).toHaveBeenCalledTimes(1); // No retries
  });

  it('should track retry state in context', async () => {
    const handler = jest.fn().mockImplementation(() => {
      // Check retry state during execution
      if (context.retry) {
        expect(context.retry).toMatchObject({
          attempt: expect.any(Number),
          maxRetries: 3,
          isRetry: context.retry.attempt > 0,
        });
      }

      if ((context.retry?.attempt ?? 0) < 2) {
        throw new NetworkError('Connection refused', 503);
      }
      return Promise.resolve('success');
    });

    await withRetry(
      handler,
      { maxRetries: 3, backoff: 'exponential', baseDelay: 10, maxDelay: 100, jitter: false },
      errorConfig,
      context,
      'testHandler'
    );

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('should calculate exponential backoff correctly', async () => {
    const delays: number[] = [];
    const handler = jest.fn().mockImplementation(() => {
      if (delays.length < 3) {
        const start = Date.now();
        delays.push(start);
        throw new NetworkError('Timeout', 503);
      }
      return Promise.resolve('success');
    });

    await withRetry(
      handler,
      { maxRetries: 3, backoff: 'exponential', baseDelay: 100, maxDelay: 1000, jitter: false },
      errorConfig,
      context,
      'testHandler'
    );

    // Verify delays: ~0ms, ~100ms, ~200ms, ~400ms
    // (allowing ±50ms tolerance for timer precision)
    expect(delays[1] - delays[0]).toBeGreaterThanOrEqual(50);
    expect(delays[1] - delays[0]).toBeLessThan(150);
    expect(delays[2] - delays[1]).toBeGreaterThanOrEqual(150);
    expect(delays[2] - delays[1]).toBeLessThan(250);
  });
});
```

#### Modified Files

1. **`src/runtime/handlers/error-handling.ts`** - Complete rewrite with classification and retry
2. **`src/runtime/context.ts`** - Add retry and fallback state types
3. **`src/dsl/schema.ts`** - Add errorHandling config to LifecycleHookEntry

### Test Coverage Requirements

- [ ] Unit tests: 100% coverage for all error classes
- [ ] Unit tests: 100% coverage for error-classifier.ts
- [ ] Unit tests: 100% coverage for retry-wrapper.ts
- [ ] Integration test: Retry + Timeout (TimeoutError retryable)
- [ ] Integration test: Pattern matching for third-party errors
- [ ] Integration test: Fallback handler invocation
- [ ] Integration test: Security error sanitization
- [ ] Performance test: Classification overhead < 1ms

### Acceptance Criteria Validation

From `docs/acceptance-criteria/lifecycle-enhancements.feature`:

```gherkin
Feature: Error Classification

  Scenario: Network error triggers retry with exponential backoff
    Given a handler that throws NetworkError
    And retry config with maxRetries 3 and backoff exponential
    When the handler is invoked
    Then the handler is called 4 times (initial + 3 retries)
    And delays are 1000ms, 2000ms, 4000ms
    And telemetry events are emitted for each retry

  Scenario: Validation error does not retry
    Given a handler that throws ValidationError
    And retry config with maxRetries 3
    When the handler is invoked
    Then the handler is called 1 time
    And the error is propagated immediately

  Scenario: Security error returns generic message
    Given a handler that throws SecurityError with sensitive details
    When the error response is formatted
    Then the user receives "Access denied"
    And sensitive details are logged to audit trail
    And full stack trace is not exposed
```

---

## Integration Strategy

### Phase 1: Timeout Protection (Issue #60)

**Week 1: Implementation**

1. ✅ Create TimeoutError class
2. ✅ Implement timeout-wrapper.ts
3. ✅ Update base-mfe.ts to integrate timeout wrapper
4. ✅ Update DSL schema with timeout fields
5. ✅ Write unit tests (100% coverage)

**Week 2: Testing & Documentation**

1. ✅ Integration tests (timeout + contained, timeout precedence)
2. ✅ Performance tests (timeout overhead < 10ms)
3. ✅ Update user documentation
4. ✅ Create example: `examples/timeout-demo/`

### Phase 2: Error Classification (Issue #61)

**Week 3: Implementation**

1. ✅ Create all typed error classes
2. ✅ Implement error-classifier.ts
3. ✅ Implement retry-wrapper.ts
4. ✅ Update handlers to accept AbortSignal
5. ✅ Write unit tests (100% coverage)

**Week 4: Testing & Documentation**

1. ✅ Integration tests (retry + timeout, pattern matching, fallback)
2. ✅ Security review (error sanitization)
3. ✅ Update user documentation
4. ✅ Create example: `examples/error-classification-demo/`

### Cross-Feature Integration

**Week 5: Integration Testing**

1. ✅ Test TimeoutError with retry logic
2. ✅ Test timeout + retry + fallback
3. ✅ Test parallel execution + timeout + retry (future)
4. ✅ Performance profiling (end-to-end scenarios)

---

## Risk Assessment

### High Risk

1. **AbortSignal Compatibility** ⚠️

   - **Risk**: Platform handlers (auth, caching) don't support AbortSignal
   - **Impact**: Handlers continue running after timeout
   - **Mitigation**: Update all platform handlers in Phase 1, make optional for custom handlers
   - **Owner**: Platform Team

2. **Retry + Timeout Interaction** ⚠️
   - **Risk**: Timeout occurs during retry delay, causing unexpected behavior
   - **Impact**: Retry loop interrupted prematurely
   - **Mitigation**: Ensure timeout applies per-attempt, not global
   - **Owner**: Architecture Team

### Medium Risk

1. **Pattern Matching Brittleness** ⚠️

   - **Risk**: Third-party error messages change format
   - **Impact**: Errors not classified correctly
   - **Mitigation**: Use broad patterns, document preferred typed errors
   - **Owner**: Platform Team

2. **Exponential Backoff Thundering Herd** ⚠️
   - **Risk**: Multiple MFEs retry simultaneously
   - **Impact**: Service overwhelmed by retry storm
   - **Mitigation**: Jitter (±20% random), circuit breaker (future)
   - **Owner**: Operations Team

### Low Risk

1. **Timeout Accuracy** ℹ️
   - **Risk**: JavaScript timers ±100ms inaccurate
   - **Impact**: Timeout slightly delayed
   - **Mitigation**: Acceptable for UX, document ±100ms tolerance
   - **Owner**: Platform Team

---

## Definition of Done

### Issue #60: Timeout Protection

- [ ] Implementation complete per requirements (REQ-LIFECYCLE-002)
- [ ] Unit tests pass with 100% coverage
- [ ] Integration test: Timeout + Retry passing
- [ ] Telemetry events emitted correctly
- [ ] Example created: `examples/timeout-demo/`
- [ ] Documentation updated (user guide + API reference)
- [ ] Code review approved
- [ ] Requirements doc status: ✅ Complete
- [ ] ADR-064 updated with "Implementation Confirmed" section

### Issue #61: Error Classification

- [ ] Implementation complete per requirements (REQ-LIFECYCLE-005)
- [ ] Unit tests pass with 100% coverage
- [ ] Integration test: Retry + Timeout passing
- [ ] Telemetry events emitted correctly
- [ ] Example created: `examples/error-classification-demo/`
- [ ] Documentation updated
- [ ] Security team review approved (error sanitization)
- [ ] Code review approved
- [ ] Requirements doc status: ✅ Complete
- [ ] ADR-065 updated with "Implementation Confirmed" section

---

## Open Questions

1. **Q**: Should timeout apply to retry delay or only handler execution?

   - **A**: Only handler execution. Retry delay is intentional wait.

2. **Q**: Should fallback handler have its own timeout?

   - **A**: Yes, use same precedence logic (fallback.timeout → handler timeout → phase timeout)

3. **Q**: How to handle TimeoutError in onRetry hook?

   - **A**: onRetry hook has shorter timeout (50% of handler timeout), no retry for onRetry itself

4. **Q**: Should pattern matching be case-sensitive?

   - **A**: No, use case-insensitive regex by default (`/pattern/i`)

5. **Q**: Should security errors trigger ops alerts?
   - **A**: Configurable per error type (`alertOps: true`), default false

---

## Next Steps

1. **Immediate** (Today):

   - Assign Issue #60 to developer
   - Create feature branch: `feature/timeout-protection`
   - Set up test infrastructure

2. **Week 1** (Dec 14-20):

   - Implement timeout protection
   - Daily standup to review progress
   - Mid-week code review (draft PR)

3. **Week 2** (Dec 21-27):

   - Complete timeout testing
   - Create timeout demo example
   - Assign Issue #61 to developer

4. **Week 3** (Dec 28-Jan 3):

   - Implement error classification
   - Daily standup to review progress
   - Mid-week code review (draft PR)

5. **Week 4** (Jan 4-10):

   - Complete error classification testing
   - Security team review
   - Create error classification demo example

6. **Week 5** (Jan 11-17):
   - Integration testing
   - Performance profiling
   - Final documentation review
   - Production readiness review

---

## Appendix A: File Structure

```
src/runtime/
├── errors/
│   ├── TimeoutError.ts          # NEW
│   ├── NetworkError.ts          # NEW
│   ├── ValidationError.ts       # NEW
│   ├── SecurityError.ts         # NEW
│   ├── BusinessError.ts         # NEW
│   ├── SystemError.ts           # NEW
│   └── index.ts                 # NEW
├── timeout-wrapper.ts           # NEW
├── retry-wrapper.ts             # NEW
├── error-classifier.ts          # NEW
├── base-mfe.ts                  # MODIFIED
├── context.ts                   # MODIFIED
├── handlers/
│   ├── error-handling.ts        # MODIFIED (complete rewrite)
│   ├── auth.ts                  # MODIFIED (add AbortSignal)
│   ├── caching.ts               # MODIFIED (add AbortSignal)
│   ├── rate-limiting.ts         # MODIFIED (add AbortSignal)
│   ├── validation.ts            # MODIFIED (add AbortSignal)
│   └── index.ts                 # MODIFIED
└── __tests__/
    ├── timeout-wrapper.test.ts  # NEW
    ├── retry-wrapper.test.ts    # NEW
    ├── error-classifier.test.ts # NEW
    └── integration/
        ├── timeout-retry.test.ts    # NEW
        ├── error-sanitization.test.ts # NEW
        └── fallback-handler.test.ts   # NEW

examples/
├── timeout-demo/                # NEW
│   ├── package.json
│   ├── manifest.yaml
│   └── src/
│       └── index.ts
└── error-classification-demo/  # NEW
    ├── package.json
    ├── manifest.yaml
    └── src/
        └── index.ts

docs/
├── architecture-decisions/
│   ├── ADR-064-timeout-protection.md       # MODIFIED (add Implementation Confirmed)
│   └── ADR-065-error-classification.md     # MODIFIED (add Implementation Confirmed)
└── requirements/
    └── lifecycle-enhancements.md           # MODIFIED (mark REQ-002, REQ-005 complete)
```

---

## Appendix B: Testing Matrix

| Test Case                              | Timeout | Retry | Fallback | Expected Outcome                  |
| -------------------------------------- | ------- | ----- | -------- | --------------------------------- |
| T1: Handler succeeds                   | 5s      | 3     | No       | Success, no timeout               |
| T2: Handler times out, onTimeout=error | 1s      | 0     | No       | TimeoutError thrown               |
| T3: Handler times out, onTimeout=warn  | 1s      | 0     | No       | Warning logged, continue          |
| T4: Handler times out, onTimeout=skip  | 1s      | 0     | No       | Silent continue                   |
| T5: Handler times out, retry enabled   | 1s      | 3     | No       | 4 attempts, TimeoutError each     |
| T6: Network error, retry enabled       | -       | 3     | No       | 4 attempts, exponential backoff   |
| T7: Validation error, retry enabled    | -       | 3     | No       | 1 attempt, error propagated       |
| T8: Network error, fallback            | -       | 3     | Yes      | Fallback invoked after 3 retries  |
| T9: Timeout + Retry + Fallback         | 1s      | 3     | Yes      | 4 timeout attempts, then fallback |
| T10: Security error                    | -       | 0     | No       | Generic message, audit log        |

---

**Document Status**: ✅ Ready for Implementation  
**Reviewed By**: Platform Team  
**Approved By**: Tech Lead  
**Date**: 2025-12-13

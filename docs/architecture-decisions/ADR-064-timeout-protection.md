# ADR-064: Timeout Protection with AbortSignal

**Status**: Proposed  
**Date**: 2025-12-11  
**Related**: REQ-LIFECYCLE-002, REQ-LIFECYCLE-005 (Error Classification)

## Context

Handlers can hang indefinitely (network timeouts, infinite loops, deadlocks), blocking MFE lifecycle execution. No mechanism exists to enforce time limits, leading to:
- Hung requests (user waits forever)
- Resource exhaustion (handlers never release connections)
- Cascading failures (timeouts in dependent systems)

**Example**: EHR system queries external lab API. If lab API hangs (no timeout), patient record viewer becomes unresponsive.

## Decision

Implement **hierarchical timeout configuration** with **AbortSignal** for cancellation.

### Design

```yaml
# Manifest: Handler-level timeout (highest precedence)
lifecycle:
  before:
    - validateFile:
        handler: checkFileSize
        timeout: 5000            # 5 seconds
        onTimeout: "error"       # "error" | "warn" | "skip"

# Config: Global defaults (lowest precedence)
timeouts:
  phases:
    before: 5000
    main: 30000
    after: 10000
    error: 5000
  handlers:
    platform.auth: 3000          # Handler-specific override
    queryEHR: 10000
```

### Precedence Order

1. **Hook-level timeout** (`timeout: 5000` in manifest)
2. **Handler-specific default** (`handlers.platform.auth: 3000` in config)
3. **Phase-level default** (`phases.before: 5000` in config)
4. **Global default** (30000ms hardcoded)

### Implementation Pattern

```typescript
protected async invokeHandlerWithTimeout(
  handlerName: string,
  context: Context,
  timeoutMs: number,
  onTimeout: 'error' | 'warn' | 'skip'
): Promise<void> {
  const abortController = new AbortController();
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      abortController.abort();
      reject(new TimeoutError(`Handler '${handlerName}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    await Promise.race([
      this.invokeHandler(handlerName, context, { signal: abortController.signal }),
      timeoutPromise
    ]);
  } catch (error) {
    if (error instanceof TimeoutError) {
      // Mark context
      context.timeouts = context.timeouts || {};
      context.timeouts[handlerName] = {
        occurred: true,
        elapsed: timeoutMs,
        onTimeout
      };
      
      // Emit telemetry
      await this.emitTimeout(handlerName, context, timeoutMs);
      
      // Handle based on onTimeout
      if (onTimeout === 'error') {
        throw error;  // Trigger error phase
      } else if (onTimeout === 'warn') {
        console.warn(`Handler '${handlerName}' timed out (continued)`);
      }
      // onTimeout === 'skip': silent continue
    } else {
      throw error;  // Re-throw non-timeout errors
    }
  }
}
```

### AbortSignal Integration

Handlers receive AbortSignal for graceful cancellation:

```typescript
// Handler implementation
async function fetchData(context: Context, options?: { signal?: AbortSignal }): Promise<void> {
  const response = await fetch('https://api.example.com/data', {
    signal: options?.signal  // Pass to fetch for automatic cancellation
  });
  
  context.outputs = await response.json();
}

// Or manual check
async function processFile(context: Context, options?: { signal?: AbortSignal }): Promise<void> {
  for (const chunk of largeFile) {
    if (options?.signal?.aborted) {
      throw new Error('Processing cancelled');
    }
    processChunk(chunk);
  }
}
```

### Retry Integration

Timeouts respect retry configuration (see ADR-065):

```yaml
lifecycle:
  before:
    - fetchData:
        handler: queryAPI
        timeout: 3000
        errorHandling:
          - type: timeout
            retryable: true
            maxRetries: 2
            backoff: exponential
```

**Behavior**:
1. Attempt 1: Timeout after 3s → Retry
2. Attempt 2: Timeout after 3s → Retry
3. Attempt 3: Timeout after 3s → Error phase

## Consequences

### Positive

✅ **Reliability**: Prevents hung operations from blocking system  
✅ **User Experience**: Fast failure with meaningful error  
✅ **Resource Efficiency**: Frees resources from hung operations  
✅ **Flexibility**: Multiple behaviors via `onTimeout` flag  
✅ **Graceful Cancellation**: Handlers can cleanup via AbortSignal

### Negative

❌ **Complexity**: Timeout logic adds to execution path  
❌ **Accuracy**: JavaScript timers ±100ms (acceptable for UX)  
❌ **Handler Updates**: Handlers must support AbortSignal (opt-in)

### Trade-offs

- **Chosen**: Promise.race + AbortSignal (standard Node.js pattern)
- **Rejected**: External timeout orchestrator (too complex)
- **Rejected**: Process-level timeouts (too coarse)

## Alternatives Considered

### 1. No Cancellation (Fire and Forget)

```typescript
setTimeout(() => {
  // Just throw error, don't cancel handler
  throw new TimeoutError();
}, timeoutMs);
```

**Rejected**: Handler continues running, consuming resources.

### 2. Process-Level Timeout (Child Process)

Run each handler in separate process with kill on timeout.

**Rejected**: Too heavy (process spawn overhead), hard to share context.

### 3. Custom Cancellation Token

Invent custom cancellation mechanism instead of AbortSignal.

**Rejected**: Reinventing wheel, AbortSignal is standard (Node 15+).

## Implementation Notes

- Use `Promise.race([handlerPromise, timeoutPromise])`
- Create AbortController per handler invocation
- Pass AbortSignal to handler as `options.signal`
- Platform handlers must support AbortSignal (fetch, axios, etc.)
- Custom handlers opt-in to cancellation
- Store timeout config in manifest validator

## Testing Strategy

- [ ] Unit test: Handler times out after configured duration
- [ ] Unit test: `onTimeout: error` throws and triggers error phase
- [ ] Unit test: `onTimeout: warn` logs and continues
- [ ] Unit test: `onTimeout: skip` silently continues
- [ ] Unit test: Timeout respects `contained` flag
- [ ] Unit test: Timeout integrates with retry logic
- [ ] Unit test: AbortSignal passed to handler
- [ ] Unit test: Precedence order (hook > handler > phase > global)
- [ ] Performance test: Timeout overhead < 10ms
- [ ] Integration test: Timeout + parallel execution
- [ ] Integration test: Timeout + error classification

## Success Metrics

- [ ] Zero hung operations in production
- [ ] Timeout accuracy within ±100ms
- [ ] 100% test coverage
- [ ] All platform handlers support AbortSignal

## Related Documents

- [Lifecycle Engine Analysis](../lifecycle-engine-analysis.md)
- [REQ-LIFECYCLE-002](../requirements/lifecycle-enhancements.md#req-lifecycle-002)
- ADR-065: Error Classification

---

**Status**: Proposed  
**Decision Makers**: Platform Team  
**Next Steps**: Implement timeout wrapper, update platform handlers for AbortSignal

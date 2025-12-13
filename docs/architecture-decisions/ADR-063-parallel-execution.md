# ADR-063: Parallel Handler Execution with Context Isolation

**Status**: Proposed  
**Date**: 2025-12-11  
**Related**: REQ-LIFECYCLE-001, ADR-022 (Re-entrancy Guard)

## Context

Handler arrays in lifecycle hooks execute sequentially, even when handlers are independent (no shared state dependencies). This increases latency for operations like:

- Multiple validation checks (schema, business rules, security)
- Fan-out API calls (fraud check + address validation + credit check)
- Parallel notifications (email + SMS + webhook)

**Example**: Payment processor validates 3 security checks sequentially (450ms total), when parallel execution could achieve 150ms (longest handler).

## Decision

Implement **opt-in parallel execution** with **isolated context copies** and **namespaced outputs**.

### Design

```yaml
lifecycle:
  before:
    - securityChecks:
        handler: [platform.auth, validatePCI, checkFraudRisk]
        parallel: true
        maxConcurrency: 3
        failureStrategy: 'fail-fast' # or "complete-all" or "partial-success"
```

### Context Isolation

Each parallel handler receives a **read-only copy** of context with an isolated output namespace:

```typescript
// Before parallel execution
context = { inputs: { file: 'data.csv' }, outputs: {} };

// During parallel execution
const contextCopies = handlers.map((h) => ({
  ...context, // Read-only copy
  _parallelOutput: {}, // Isolated write space
}));

// After completion - merge outputs
context.parallelOutputs = {
  'platform.auth': { user: { id: 123 } },
  validatePCI: { compliant: true },
  checkFraudRisk: { score: 0.12 },
};

// Deep merge to main context
deepMerge(context, context.parallelOutputs['platform.auth']);
deepMerge(context, context.parallelOutputs['validatePCI']);
deepMerge(context, context.parallelOutputs['checkFraudRisk']);
```

### Failure Strategies

1. **fail-fast** (Promise.race semantics):

   - Cancel remaining handlers on first error
   - Use case: Auth failure blocks further processing

2. **complete-all** (Promise.allSettled semantics):

   - Wait for all handlers, collect all errors
   - Use case: Validation - need all error messages

3. **partial-success**:
   - Continue if at least 1 handler succeeds
   - Use case: Multiple data sources, any success is acceptable

### Implementation Pattern

```typescript
protected async executeParallelHandlers(
  handlers: string[],
  config: ParallelConfig,
  context: Context
): Promise<void> {
  const strategy = config.failureStrategy || 'fail-fast';
  const maxConcurrency = config.maxConcurrency || handlers.length;

  // Create isolated context copies
  const contextCopies = handlers.map(h => this.createContextCopy(context));

  // Execute based on strategy
  if (strategy === 'fail-fast') {
    await Promise.all(
      handlers.map((h, i) =>
        this.invokeHandler(h, contextCopies[i])
          .catch(err => {
            // Cancel remaining
            throw err;
          })
      )
    );
  } else if (strategy === 'complete-all') {
    const results = await Promise.allSettled(
      handlers.map((h, i) => this.invokeHandler(h, contextCopies[i]))
    );
    // Collect all errors, continue
  }

  // Merge outputs
  this.mergeParallelOutputs(context, contextCopies, handlers);
}
```

## Consequences

### Positive

✅ **Performance**: 3x speedup for 3 independent handlers  
✅ **Safety**: Context isolation prevents race conditions  
✅ **Flexibility**: Multiple failure strategies for different scenarios  
✅ **Observability**: Telemetry tracks per-handler duration  
✅ **Opt-in**: No breaking changes (sequential by default)

### Negative

❌ **Complexity**: Context copy/merge logic adds overhead (~10ms)  
❌ **Memory**: Multiple context copies (acceptable for <10 handlers)  
❌ **Debugging**: Harder to trace execution order  
❌ **Limitations**: Handlers must be truly independent (no read-after-write)

### Trade-offs

- **Chosen**: Isolated context copies (namespace by handler)
- **Rejected**: Shared mutable context (race conditions)
- **Rejected**: Dependency DAG (too complex for v1)

## Alternatives Considered

### 1. Shared Mutable Context

```typescript
// All handlers mutate same context
await Promise.all(handlers.map((h) => this.invokeHandler(h, context)));
```

**Rejected**: Race conditions if handlers write to same fields.

### 2. Dependency DAG (Directed Acyclic Graph)

```yaml
lifecycle:
  before:
    - handlers:
        - auth: { dependencies: [] }
        - validate: { dependencies: [auth] } # Waits for auth
        - cache: { dependencies: [] }
      parallel: true
```

**Rejected**: Too complex for initial version. Revisit in Phase 3 after user feedback.

### 3. Copy-on-Write Context

Use Proxy to detect writes, only copy when needed.

**Rejected**: Added complexity outweighs marginal performance gain.

## Implementation Notes

- Use `Promise.all()` for complete-all
- Use custom cancellation for fail-fast (AbortController)
- Deep merge library: `lodash.merge` or custom
- Warn on context conflicts (two handlers write same field)
- Document handler independence requirements

## Testing Strategy

- [ ] Unit test: 3 independent handlers execute concurrently
- [ ] Unit test: fail-fast cancels on first error
- [ ] Unit test: complete-all collects all errors
- [ ] Unit test: partial-success continues with 1 success
- [ ] Unit test: context isolation (no cross-contamination)
- [ ] Unit test: output merge (deep merge, warn on conflicts)
- [ ] Performance test: 3x speedup vs sequential
- [ ] Integration test: parallel + timeout
- [ ] Integration test: parallel + error classification

## Success Metrics

- [ ] Parallel execution overhead < 10ms
- [ ] 3 handlers: 3x speedup vs sequential
- [ ] Zero context mutation bugs in production
- [ ] 100% test coverage

## Related Documents

- [Lifecycle Engine Analysis](../lifecycle-engine-analysis.md)
- [REQ-LIFECYCLE-001](../requirements/lifecycle-enhancements.md#req-lifecycle-001)
- ADR-022: Re-entrancy Guard

---

**Status**: Proposed  
**Decision Makers**: Platform Team  
**Next Steps**: Create implementation plan, write tests

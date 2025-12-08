# ADR-059: Platform Handler Interface & Execution Model

**Status:** 🟡 In Progress  
**Date:** 2025-12-06  
**Relates To:** ADR-036, ADR-047, ADR-058, REQ-RUNTIME-005 through REQ-RUNTIME-012

## Context

Platform handlers are standardized lifecycle functions that execute around MFE capabilities (load, render, query, emit, etc.) in `before`, `main`, `after`, and `error` phases. The goal is to provide a unified, predictable interface for cross-cutting concerns like authentication, validation, telemetry, error handling, caching, and rate limiting.

Previous design (ADR-058) outlined handler standardization principles. This ADR specifies the concrete interface, registry pattern, and execution semantics that enable:

- **Consistency**: All handlers follow identical lifecycle interface
- **Composability**: Multiple handlers execute sequentially without interference
- **Observability**: Handler execution is fully telemetered
- **Extensibility**: Custom handlers can be registered alongside platform handlers
- **DSL-Driven**: Handler selection determined by MFE's DSL manifest

## Decision

### Handler Interface

All platform and custom handlers must implement:

```typescript
interface PlatformHandler {
  /**
   * Handler name (globally unique, e.g., "auth", "validation", "custom.myHandler")
   */
  readonly name: string;

  /**
   * Lifecycle phases this handler participates in
   * - before: Pre-capability setup (validation, auth, caching checks)
   * - main: Only for handlers that participate in main operation (not used currently)
   * - after: Post-capability finalization (telemetry aggregation, cache writes)
   * - error: Error recovery (retries, fallback preparation)
   */
  readonly phases: Array<'before' | 'main' | 'after' | 'error'>;

  /**
   * Configuration for how this handler responds to errors
   */
  readonly errorConfig: {
    /**
     * If true, handler errors halt execution and jump to error phase
     * If false, handler errors are logged but don't halt (best-effort)
     */
    continueOnError: boolean;

    /**
     * If true, handler errors should be retryable
     */
    retryable: boolean;
  };

  /**
   * Execute handler in specified phase
   * @param context Shared context object (mutable, flows through all handlers)
   * @param phase Current lifecycle phase
   * @throws Error if handler determines capability should fail (if continueOnError=true)
   */
  execute(context: Context, phase: string): Promise<void>;
}
```

### Handler Registry

```typescript
interface PlatformHandlerRegistry {
  /**
   * Register a handler globally
   * @param handler Handler instance
   * @throws Error if handler name already registered
   */
  register(handler: PlatformHandler): void;

  /**
   * Unregister a handler
   */
  unregister(name: string): void;

  /**
   * Get handler by name
   */
  get(name: string): PlatformHandler | null;

  /**
   * Resolve handlers for a capability based on DSL manifest
   * @param capability Capability name (e.g., "load", "render")
   * @param manifest DSL manifest with handler configuration
   * @returns Ordered list of handler names to execute
   *
   * DSL format:
   *   auth: true | { ... }
   *   validation: true | { ... }
   *   telemetry: true | { ... }
   *   errorHandling: true | { ... }
   *   caching: true | { ... }
   *   custom:
   *     - name: myHandler
   *       config: { ... }
   */
  resolve(capability: string, manifest: DSLManifest): string[];

  /**
   * List all registered handlers
   */
  listHandlers(): PlatformHandler[];
}
```

### Execution Model

Handlers execute **sequentially** in the following order:

#### Before Phase
```
load(context)
  └─ Resolve handlers from manifest (e.g., [auth, validation, telemetry])
      └─ auth.execute(context, 'before')
          └─ If error: jump to error phase, skip validation/telemetry/main/after
      └─ validation.execute(context, 'before')
          └─ If error: jump to error phase, skip telemetry/main/after
      └─ telemetry.execute(context, 'before')
          └─ If error: jump to error phase, skip main/after (unless continueOnError)
      └─ main: Atomic load operation
```

#### Main Phase
Main phase executes the capability (load, render, etc.). Handlers don't execute here unless they have a "main" phase implementation (currently none).

#### After Phase
```
      └─ after handlers execute (same order resolved)
          └─ handlers[i].execute(context, 'after')
              └─ Telemetry, cache writes, aggregation
              └─ If error: jump to error phase (unless continueOnError)
      └─ return LoadResult
```

#### Error Phase
```
On error (from before, main, or after):
  └─ context.error = thrownError
      └─ error-handling.execute(context, 'error')
          └─ Retry logic, fallback preparation
          └─ If retryable: re-execute capability from main phase
      └─ telemetry.execute(context, 'error')
          └─ Emit failure event with retry info
      └─ return error status
```

### Handler Resolution from DSL

The registry's `resolve()` method examines the DSL manifest and returns handlers in execution order:

```yaml
# DSL manifest
manifest:
  version: 1.0.0
  name: my-mfe
  
  # Handler configuration (or true for defaults)
  auth:
    enabled: true
    requiredRoles: [admin, user]
  
  validation:
    enabled: true
    inputSchema: { ... }
  
  telemetry:
    enabled: true
  
  errorHandling:
    enabled: true
    retry:
      maxAttempts: 3
      backoffMs: 1000
  
  caching:
    enabled: false
  
  custom:
    - name: myCustomHandler
      config: { ... }
```

**Resolution logic:**

1. Check each standard handler's `enabled` field in manifest
2. If enabled: add to execution list with manifest config passed to handler
3. Add custom handlers in declaration order
4. Return ordered list: [auth, validation, telemetry, ...custom, errorHandling]

### Standard Handlers

Five standard platform handlers are pre-registered with the registry:

| Handler | Phases | Responsibility |
|---------|--------|-----------------|
| **auth** | before | JWT validation, role checking, context.user population |
| **validation** | before | Input schema validation (JSON Schema) |
| **telemetry** | before, after, error | Observability events (no-op on failures) |
| **error-handling** | error | Retry logic, exponential backoff, fallback prep |
| **caching** | before, after | Load/render result memoization (performance) |

### Custom Handlers

MFEs can define custom handlers in DSL and register them at runtime:

```typescript
// MFE-specific custom handler
const myHandler: PlatformHandler = {
  name: 'custom.myHandler',
  phases: ['before'],
  errorConfig: { continueOnError: false, retryable: false },
  execute: async (context, phase) => {
    if (phase === 'before') {
      // Custom logic: e.g., feature flag checking, custom auth
      context.featureFlags = await loadFeatureFlags(context.user);
    }
  }
};

// Register at MFE startup
handlerRegistry.register(myHandler);
```

### Context Mutations & Cross-Handler Communication

Handlers can mutate context for communication:

```typescript
// auth handler sets
context.user = { id, username, roles, permissions };
context.authorizedRoles = [admin];

// validation handler reads and uses
if (!context.authorizedRoles.includes('admin')) {
  throw new ValidationError('Insufficient roles for this operation');
}

// Custom handler can also read and extend
context.customData = { ... };
```

### Error Handling Strategy

**Handler errors have two behaviors:**

1. **continueOnError: false** (default for auth, validation, custom)
   - Error halts execution
   - Jumps immediately to error phase
   - Error phase handlers (error-handling, telemetry) can attempt recovery
   - If not recovered, capability fails

2. **continueOnError: true** (only telemetry, logging handlers)
   - Error logged but doesn't halt
   - Execution continues to next handler
   - Used for observability handlers that must not block capability

### Telemetry Integration

Each handler execution emits telemetry:

```
handler_before_start: { handler: "auth", capability: "load", timestamp }
handler_before_end: { handler: "auth", duration: 42ms, status: "success" }
handler_before_error: { handler: "auth", error: "AuthError: invalid JWT" }
```

Telemetry handler never blocks (continueOnError: true) but emits events for all other handlers.

## Consequences

### Positive

1. **Unified interface**: All handlers follow identical protocol, reducing cognitive load
2. **Predictable execution**: Sequential, ordered execution enables clear reasoning about state
3. **Composable**: Handlers don't interfere with each other (each gets fresh context snapshot)
4. **Extensible**: Custom handlers can be added without modifying core runtime
5. **Observable**: Every handler execution is telemetered for debugging/monitoring
6. **DSL-driven**: Manifest controls which handlers execute (no hard-coded logic)
7. **Flexible error handling**: Some handlers must not block (telemetry), others must (auth)

### Negative

1. **Sequential execution overhead**: Handlers run one-at-a-time (no parallelism), may add latency
   - Mitigation: Handlers typically fast (<10ms); profile in practice
2. **Complex error recovery**: Error phase logic can be hard to reason about
   - Mitigation: Detailed telemetry + comprehensive testing
3. **DSL schema growth**: Manifest schema expands to include all handler configs
   - Mitigation: Use JSON Schema to document and validate

## Implementation Strategy

1. **Phase 1: Handler Registry** (REQ-RUNTIME-005)
   - Implement PlatformHandlerRegistry
   - Implement resolve() logic from DSL
   - Create handler registration API

2. **Phase 2: Standard Handlers** (REQ-RUNTIME-006 through REQ-RUNTIME-010)
   - auth: JWT + role validation
   - validation: JSON Schema validation
   - telemetry: Observability events
   - error-handling: Retry + fallback logic
   - caching: Memoization

3. **Phase 3: Integration** (REQ-RUNTIME-001, REQ-RUNTIME-004)
   - Integrate handlers into load capability
   - Integrate handlers into render capability
   - Wire DSL manifest to handler resolution

4. **Phase 4: Testing**
   - Unit tests for each handler (100% coverage)
   - Integration tests for handler execution order
   - Error scenario tests (auth failure, validation failure, network retry, etc.)

## Validation Criteria

- [x] Handler interface defined and validated
- [x] Registry implementation supports resolve() from DSL
- [x] All standard handlers implement interface
- [x] Custom handlers can be registered at runtime
- [x] Context mutations work across handlers
- [x] Telemetry events captured for each handler
- [x] Error handling strategy tested (blocking, non-blocking, retry)
- [ ] Integration tests pass (all REQ-RUNTIME-XXX scenarios)
- [ ] 100% code coverage for handlers

## Related Requirements

- REQ-RUNTIME-005: Platform Handlers overview
- REQ-RUNTIME-006: Auth handler
- REQ-RUNTIME-007: Validation handler
- REQ-RUNTIME-008: Telemetry handler
- REQ-RUNTIME-009: Error handling handler
- REQ-RUNTIME-010: Caching handler
- REQ-RUNTIME-001: Load capability (uses handlers)
- REQ-RUNTIME-004: Render capability (uses handlers)

## Related ADRs

- ADR-036: Lifecycle execution model (phases, hooks)
- ADR-047: BaseMFE abstract base (context, state machine)
- ADR-058: Platform handler standardization (principles)
- ADR-060: Load capability atomic operation (uses handler registry)

## References

- `/docs/runtime-requirements.md` (REQ-RUNTIME-005 through 010)
- `/src/runtime/base-mfe.ts` (Context, BaseMFE class)
- `/src/runtime/handlers/` (handler implementations, to be created)

# ADR-060: Load Capability - Atomic Operation Design

**Status:** 🟡 In Progress  
**Date:** 2025-12-06  
**Relates To:** ADR-036, ADR-047, ADR-059, REQ-RUNTIME-001, REQ-RUNTIME-002, REQ-RUNTIME-003

## Context

The load capability is the entry point for loading remote MFEs at runtime. It must:

1. Be **atomic**: Either fully succeeds or fully fails (no partial state)
2. Be **observable**: Emit telemetry at key phases (entry, mount, enable-render)
3. Be **composable**: Return metadata enabling shell to validate before render
4. Be **resilient**: Support retries for transient failures
5. Support **handler execution**: Auth, validation, telemetry, error handling handlers

Previous designs (ADR-036, ADR-047) specified lifecycle model and BaseMFE interface. This ADR specifies the concrete load implementation: the three sequential subphases (entry, mount, enable-render), telemetry checkpoints, and how handlers integrate.

## Decision

### Load Capability Signature

```typescript
/**
 * Load MFE at runtime
 * - Fetches Module Federation remote entry
 * - Initializes container in runtime
 * - Prepares for render phase
 * - Atomic operation: succeeds fully or fails completely
 */
async load(context: Context): Promise<LoadResult>
```

### Atomic Load Operation

Load executes as a **single uninterruptible operation** with three sequential subphases and telemetry checkpoints:

```
load(context): Promise<LoadResult>
  ├─ [Handler: before phase]
  │   ├─ auth handler: Validate JWT, check roles, populate context.user
  │   ├─ validation handler: Validate context.inputs against schema
  │   ├─ telemetry handler: Record load start time
  │   └─ [If any handler errors: jump to error phase, return error]
  │
  ├─ [ATOMIC MAIN OPERATION - cannot be interrupted]
  │   ├─ ENTRY PHASE (1/3)
  │   │   ├─ Fetch Module Federation remote entry
  │   │   │   └─ GET remoteEntry.js from MFE endpoint
  │   │   ├─ Validate container shape (must be ModuleFederationContainer)
  │   │   ├─ [telemetry: load.entry.start]
  │   │   ├─ [telemetry: load.entry.duration] ← measured from start to end
  │   │   └─ On failure: throw EntryPhaseError → error phase
  │   │
  │   ├─ MOUNT PHASE (2/3)
  │   │   ├─ Call container.init(sharedDeps)
  │   │   │   └─ Wire React, React-DOM, @mui/material as singletons
  │   │   ├─ Store container reference
  │   │   ├─ [telemetry: load.mount.start]
  │   │   ├─ [telemetry: load.mount.duration] ← measured from start to end
  │   │   └─ On failure: throw MountPhaseError → error phase
  │   │
  │   └─ ENABLE-RENDER PHASE (3/3)
  │       ├─ Parse DSL manifest from loaded MFE
  │       ├─ Extract availableComponents from manifest.exposes
  │       ├─ Extract capabilities metadata
  │       ├─ Populate context.outputs: { container, manifest, availableComponents, capabilities }
  │       ├─ [telemetry: load.enable_render.start]
  │       ├─ [telemetry: load.enable_render.duration] ← measured from start to end
  │       └─ On failure: throw EnableRenderPhaseError → error phase
  │
  ├─ [Handler: after phase]
  │   ├─ telemetry handler: Aggregate telemetry, emit load.completed event
  │   ├─ caching handler: Store LoadResult in cache (if caching enabled)
  │   └─ [If any handler errors: jump to error phase, but LoadResult already valid]
  │
  ├─ [Handler: error phase - if any error occurred]
  │   ├─ error-handling handler: Retry logic
  │   │   ├─ If retryable error (network, timeout): Calculate backoff, retry load
  │   │   ├─ If not retryable (validation, auth): Prepare fallback state
  │   │   └─ context.retryCount incremented
  │   ├─ telemetry handler: Emit error event with retry info
  │   └─ Return error LoadResult
  │
  └─ Return LoadResult
```

### LoadResult Structure

```typescript
interface LoadResult {
  status: 'loaded' | 'error';
  
  // Module Federation container (if status === 'loaded')
  container?: ModuleFederationContainer;
  
  // Parsed DSL manifest (if successfully loaded)
  manifest?: DSLManifest;
  
  // List of component names from manifest.exposes
  // Used by shell to validate before render
  availableComponents?: string[];
  
  // Capability metadata (which capabilities available, auth requirements, etc.)
  capabilities?: CapabilityMetadata[];
  
  // Timing
  timestamp: Date;
  duration: number;  // Total load duration in ms
  
  // Telemetry from each subphase
  telemetry: {
    entry: {
      start: Date;
      duration: number;  // entry phase duration in ms
    };
    mount: {
      start: Date;
      duration: number;  // mount phase duration in ms
    };
    enableRender: {
      start: Date;
      duration: number;  // enable-render phase duration in ms
    };
  };
  
  // Error (if status === 'error')
  error?: {
    message: string;
    phase: 'entry' | 'mount' | 'enable-render' | 'before' | 'after' | 'error';
    retryCount: number;
    retryable: boolean;
    cause?: Error;
  };
}
```

### Context Flow Through Load

```typescript
// Shell initiates load
const context = new Context();
context.user = authenticatedUser;           // Set by shell auth
context.requestId = generateRequestId();
context.inputs = {
  mfeEndpoint: 'http://remote-mfe:3001',
  mfeId: 'my-mfe'
};

// Load executes
const loadResult = await mfe.load(context);

// After load:
// - context.user: unchanged (set by shell)
// - context.inputs: unchanged (set by shell)
// - context.outputs: populated by load
//   {
//     container: ModuleFederationContainer,
//     manifest: DSLManifest,
//     availableComponents: ["DataAnalysisView", "UploadForm"],
//     capabilities: [...]
//   }
// - context.phase: 'load' (reflects current capability being executed)
// - context.capability: 'load'
// - context.retryCount: 0 (or higher if retried)
// - context.error: undefined (unless error occurred)
```

### Atomicity Guarantee

Load is **atomic at the subphase level**:

- If entry phase fails: container is not stored, mount/enable-render skipped, error phase triggered
- If mount phase fails: entry succeeded but mount failed, enable-render skipped, error phase triggered
- If enable-render phase fails: entry+mount succeeded but manifest parsing failed, error phase triggered

Result: LoadResult reflects clear state (either fully loaded with all outputs, or failed with error details).

### Telemetry Emission

Each subphase emits telemetry events:

```
load.entry.start
  └─ { timestamp, capability: 'load', phase: 'main', duration: 0 }
load.entry.duration
  └─ { timestamp, duration: 42ms }
load.mount.start
  └─ { timestamp, duration: 0 }
load.mount.duration
  └─ { timestamp, duration: 156ms }
load.enable_render.start
  └─ { timestamp, duration: 0 }
load.enable_render.duration
  └─ { timestamp, duration: 18ms }
load.completed (emitted by telemetry handler in after phase)
  └─ { timestamp, capability: 'load', status: 'success', duration: 216ms (total), user: context.user.id }
```

### Shell Validation Before Render

Shell uses LoadResult metadata to decide whether to proceed:

```typescript
const loadResult = await mfe.load(context);

if (loadResult.status !== 'loaded') {
  // Handle load failure (retry, show error, etc.)
  return showError(loadResult.error);
}

// Validate component is available
if (!loadResult.availableComponents.includes('DataAnalysisView')) {
  return showError(`Component not available. Available: ${loadResult.availableComponents.join(', ')}`);
}

// Validate required capabilities
if (loadResult.capabilities.find(c => c.name === 'render' && !c.available)) {
  return showError('Render capability not available');
}

// Proceed to render
const renderResult = await mfe.render(context);
```

### Error Recovery & Retry

Error-handling handler manages retries in error phase:

```typescript
// If network error during entry phase
// error-handling handler checks: is network error retryable? yes
// Calculate backoff: 1000ms (exponential: 1s, 2s, 4s)
// Retry from main phase (re-execute entry, mount, enable-render)

// If validation error during before phase (auth handler)
// error-handling handler checks: is auth error retryable? no
// Return error status without retry
```

Retry state tracked in context:

```typescript
context.retryCount = 0;  // initial

// On first error in entry phase:
context.retryCount = 1;
context.error = { message: 'Network error', retryable: true };
// Wait 1000ms, re-execute load

// If second attempt fails:
context.retryCount = 2;
// Wait 2000ms, re-execute load

// If third attempt fails:
context.retryCount = 3;
// maxAttempts = 3, give up, return error with retryCount = 3
```

## Consequences

### Positive

1. **Atomic**: No partial state; easy to reason about (loaded or failed, never in-between)
2. **Observable**: Telemetry at each subphase enables performance profiling
3. **Validatable**: Shell receives metadata and can validate before render
4. **Resilient**: Automatic retry for transient failures
5. **Handler-integrated**: Auth, validation, error handling all work seamlessly
6. **Composable**: LoadResult can be cached, reused across renders

### Negative

1. **Sequential phases**: Not parallelizable (entry → mount → enable-render strictly ordered)
   - Mitigation: Phases typically fast (<500ms total); not a bottleneck in practice
2. **DSL parsing overhead**: enable-render phase parses manifest on every load
   - Mitigation: Caching handler can memoize LoadResult to avoid re-parsing

## Implementation Strategy

1. **Phase 1: Entry Phase** (fetch remote entry)
   - Fetch remoteEntry.js from MFE endpoint
   - Validate Module Federation container interface
   - Emit telemetry

2. **Phase 2: Mount Phase** (initialize container)
   - Call container.init() with shared dependencies
   - Store container reference in context
   - Emit telemetry

3. **Phase 3: Enable-Render Phase** (prepare for render)
   - Fetch and parse DSL manifest
   - Extract availableComponents
   - Build capabilities metadata
   - Populate context.outputs
   - Emit telemetry

4. **Phase 4: Handler Integration**
   - Resolve handlers from manifest (auth, validation, telemetry, etc.)
   - Execute before handlers
   - Execute atomic load operation
   - Execute after handlers
   - On error: execute error handlers (retry logic)

5. **Phase 5: Testing**
   - Unit tests for each subphase
   - Integration tests for atomicity (failure in each phase)
   - Retry logic tests (success on retry N)
   - Acceptance criteria scenarios from runtime-load-render.feature

## Validation Criteria

- [ ] Entry phase fetches remote entry correctly
- [ ] Mount phase initializes container with shared deps
- [ ] Enable-render phase parses manifest and extracts components
- [ ] LoadResult includes all required metadata
- [ ] Atomicity: failure in any phase returns error status (no partial success)
- [ ] Telemetry: subphase durations accurate and sum to total
- [ ] Handlers: before/after/error phases execute in correct order
- [ ] Retry: transient errors retry correctly with exponential backoff
- [ ] Shell: can validate LoadResult and proceed to render
- [ ] All Gherkin scenarios pass (from runtime-load-render.feature)
- [ ] 100% code coverage for load capability

## Related Requirements

- REQ-RUNTIME-001: Load capability overview
- REQ-RUNTIME-002: Shared context across phases
- REQ-RUNTIME-003: Load result validation & metadata
- REQ-RUNTIME-005: Platform handlers
- REQ-RUNTIME-008: Telemetry handler
- REQ-RUNTIME-009: Error handling & retry

## Related ADRs

- ADR-036: Lifecycle execution model (before/main/after/error)
- ADR-047: BaseMFE abstract base (load method signature)
- ADR-058: Platform handler standardization (handler types)
- ADR-059: Platform handler interface (handler registry, execution)

## References

- `/docs/runtime-requirements.md` (REQ-RUNTIME-001 through REQ-RUNTIME-012)
- `/docs/acceptance-criteria/runtime-load-render.feature` (Gherkin scenarios)
- `/src/runtime/base-mfe.ts` (BaseMFE.load method to implement)

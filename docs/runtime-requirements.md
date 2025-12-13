# Runtime Requirements: Platform Handlers, Load & Render Capabilities

**Document Status:** ✅ Complete  
**Last Updated:** 2025-12-06  
**Related ADRs:** ADR-036, ADR-047, ADR-058, ADR-059, ADR-060, ADR-061

## Overview

This document specifies the runtime behavior for MFE platforms, focusing on platform handler implementations and the load/render capability execution model. The design enables scalable, observable MFE composition with unified error handling and lifecycle management.

---

## REQ-RUNTIME-001: Load Capability - Atomic Entry, Mount, Enable-Render Model

**Status:** 📋 Planned

**Description:**

The `load()` capability is the MFE entry point for shell-initiated loading. It performs a single **atomic operation** with three sequential telemetry checkpoints: entry, mount, and enable-render. Platform handlers execute around this atomic operation (before/main/after hooks).

**Semantics:**

```
load(context: Context): Promise<LoadResult>
  ├─ before hooks (auth, validation per DSL, custom)
  ├─ main: atomic load operation
  │   ├─ entry: Fetch Module Federation remote entry + container
  │   │   └─ [telemetry: load.entry.start, load.entry.duration]
  │   ├─ mount: Initialize container in runtime, wire shared deps
  │   │   └─ [telemetry: load.mount.start, load.mount.duration]
  │   └─ enable-render: Prepare MFE state for render phase
  │       └─ [telemetry: load.enable_render.start, load.enable_render.duration]
  ├─ after hooks (telemetry aggregation, state finalization)
  └─ error hooks (retry logic, recovery, fallback prep)
```

**Load Result Structure:**

```typescript
interface LoadResult {
  status: 'loaded' | 'error';
  container: ModuleFederationContainer; // MFE container ref
  manifest: DSLManifest; // Parsed DSL
  availableComponents: string[]; // List of exposable components
  capabilities: CapabilityMetadata[]; // Available capabilities
  timestamp: Date;
  duration: number; // Load duration in ms
  telemetry: {
    entry: { start: Date; duration: number };
    mount: { start: Date; duration: number };
    enableRender: { start: Date; duration: number };
  };
  [key: string]: unknown;
}

interface CapabilityMetadata {
  name: string; // e.g., "render", "query", "emit"
  available: boolean;
  requiresAuth?: boolean;
  requiresValidation?: boolean;
}

interface ModuleFederationContainer {
  // Standard Module Federation container interface
  init(shared: object): void;
  get(request: string): Promise<Factory>;
  override(override: object): void;
}
```

**Acceptance Criteria:**

- Load completes as a single uninterruptible operation
- All three subphases (entry, mount, enable-render) emit telemetry events
- LoadResult includes parsed manifest and available component list
- Shell can use LoadResult to validate MFE capabilities before render
- If any subphase fails, entire load fails atomically (no partial state)
- Context object flows unchanged through all load phases

**Traceability:**

- ADR-036 (lifecycle execution model)
- ADR-047 (BaseMFE abstract base)

---

## REQ-RUNTIME-002: Shared Context Across All Phases & Lifecycles

**Status:** ✅ Complete  
**Implementation:** `src/runtime/context.ts`  
**Tests:** `src/runtime/__tests__/context.test.ts` (19 tests passing)

**Description:**

All lifecycle phases (before, main, after, error) within a single capability execution, and across multiple capabilities (load → render), use a **shared, mutable Context object**. The context carries user state, authentication, request metadata, and capability-specific inputs/outputs.

**Context Structure:**

```typescript
interface Context {
  // User & Authentication (set once, flows through all phases)
  user?: UserContext;
  jwt?: string;
  requestId: string;
  timestamp: Date;

  // Capability-specific inputs (set before capability execution)
  inputs?: Record<string, unknown>;

  // Capability-specific outputs (populated during/after capability)
  outputs?: Record<string, unknown>;

  // HTTP/Request metadata (if applicable)
  headers?: Record<string, string>;
  query?: Record<string, string>;

  // Lifecycle tracking (internal use by runtime)
  phase?: 'before' | 'main' | 'after' | 'error';
  capability?: string;

  // Error context (populated in error phase)
  error?: Error;
  retryCount?: number;

  // Handler-specific data (mutated by handlers, scoped to current phase)
  [key: string]: unknown;
}

interface UserContext {
  id: string;
  username: string;
  roles: string[];
  permissions?: string[];
  [key: string]: unknown;
}
```

**Context Lifecycle:**

```
User initiates load(context)
  └─ context.phase = 'load'
      └─ before hooks execute, mutate context
          └─ main: Load operation, populate context.outputs
              └─ after hooks execute, validate context
                  └─ Return LoadResult

User initiates render(context)  // Same context from load
  └─ context.phase = 'render'
      └─ Update context.inputs for render params
          └─ before hooks execute (auth still available)
              └─ main: Render operation
                  └─ after hooks execute, emit telemetry
                      └─ Return RenderResult
```

**Acceptance Criteria:**

- Context object is passed by reference through all phases
- User/auth info (user, jwt) persists across load→render boundary
- Each phase can read all prior outputs (load outputs available to render)
- Handlers can mutate context for cross-handler communication
- Context.phase correctly reflects current lifecycle phase
- Context.capability reflects current capability (load, render, query, etc.)

**Traceability:**

- REQ-RUNTIME-001 (load capability)
- ADR-036 (lifecycle execution)

---

## REQ-RUNTIME-003: Load Result Validation & Metadata Return

**Status:** 📋 Planned

**Description:**

The `load()` capability returns a `LoadResult` containing component metadata that the shell can validate before proceeding to render. Load validates that the MFE's remote entry and container are well-formed, and exposes metadata about available components.

**Validation Rules:**

- Module Federation container must be a valid `Container` instance
- DSL manifest must parse without errors
- `availableComponents` list extracted from DSL `exposes` section must not be empty
- Telemetry timings must be non-zero positive numbers
- LoadResult status must be 'loaded' or 'error'

**Metadata Exposure:**

LoadResult.availableComponents includes:

- Component name (from DSL exposes)
- Component type if available (e.g., 'View', 'Widget', 'Tool')
- Required context or props if defined in DSL

**Shell Validation:**

Shell can use LoadResult to decide:

- Is the MFE healthy? (all capabilities marked available: true)
- Does the MFE expose the component I want to render? (check availableComponents)
- Should I retry the load? (check telemetry durations, error reason)

**Acceptance Criteria:**

- LoadResult.availableComponents matches DSL exposes section
- Shell can validate required capabilities before calling render
- LoadResult telemetry is accurate (times match actual execution)
- Invalid LoadResult (missing container, empty components) returns error status
- LoadResult includes timestamp and duration for caching/observability

**Traceability:**

- REQ-RUNTIME-001 (load capability)
- REQ-RUNTIME-002 (shared context)

---

## REQ-RUNTIME-004: Render Capability - Component-Aware, State-Driven

**Status:** 📋 Planned

**Description:**

The `render()` capability takes a component selector (Option A format) and renders it into a DOM container with React lifecycle management, error boundaries, and telemetry. Render is **shell-agnostic**—it receives explicit DOM target and component instructions.

**Render Function Signature:**

```typescript
render(context: Context): Promise<RenderResult>

// Context.inputs for render must include:
interface RenderInput {
  component: string;                     // Exposed component name, e.g., 'DataAnalysisView'
  props?: Record<string, unknown>;       // Props to pass to component
  containerId?: string;                  // DOM container ID (if not in context)
  errorBoundary?: ErrorBoundaryConfig;   // Error boundary config
  theme?: ThemeConfig;                   // Optional theme override
}

interface ErrorBoundaryConfig {
  enabled: boolean;
  fallbackComponent?: React.ComponentType;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ThemeConfig {
  muiTheme?: MuiThemeOptions;
  customTheme?: Record<string, unknown>;
}
```

**Render Result Structure:**

```typescript
interface RenderResult {
  status: 'rendered' | 'error';
  component: string; // Component that was rendered
  element?: HTMLElement; // Reference to mounted DOM element
  componentInstance?: React.Component; // React component instance (if available)
  timestamp: Date;
  duration: number;
  telemetry: {
    renderStart: Date;
    renderDuration: number;
    mountStart: Date;
    mountDuration: number;
  };
  [key: string]: unknown;
}
```

**Validation & Mount:**

1. **Validate component exists**: Check LoadResult.availableComponents includes requested component
2. **Validate container**: Verify containerId points to valid DOM element
3. **Create React root**: Use `createRoot()` for React 18
4. **Apply error boundary**: Wrap component if errorBoundary.enabled
5. **Apply theme**: Wrap with ThemeProvider if theme specified
6. **Mount component**: Render to container
7. **Emit telemetry**: track render + mount times separately

**Cleanup:**

- Render does **not** unmount on subsequent renders—that's shell responsibility
- However, if render fails, leave container clean (no partial DOM)
- Return cleanup function in context for shell to call on component removal

**Acceptance Criteria:**

- Component name must exist in LoadResult.availableComponents
- Container must be a valid DOM element
- Component renders successfully or returns error with fallback UI applied
- RenderResult includes separate render vs. mount durations
- Error boundary catches component errors and applies fallback
- Props passed to component match requested component's input schema (if defined in DSL)
- Multiple renders of different components can use same container (shell manages lifecycle)

**Traceability:**

- REQ-RUNTIME-002 (shared context)
- ADR-036 (lifecycle execution)

---

## REQ-RUNTIME-005: Platform Handlers - Execution Around Load & Render

**Status:** 📋 Planned

**Description:**

Platform handlers are **standardized lifecycle functions** that execute in `before`, `main` (if applicable), `after`, and `error` phases around load and render capabilities. Handlers are **selected based on DSL configuration**—only handlers required by the MFE's DSL metadata are executed.

**Handler Types:**

```
├─ auth (REQ-RUNTIME-006)
├─ validation (REQ-RUNTIME-007)
├─ telemetry (REQ-RUNTIME-008)
├─ error-handling (REQ-RUNTIME-009)
├─ caching (REQ-RUNTIME-010)
├─ rate-limiting
├─ custom handlers (MFE-defined)
```

**Handler Interface:**

```typescript
interface PlatformHandler {
  name: string;
  phases: ('before' | 'main' | 'after' | 'error')[];

  execute(context: Context, phase: string): Promise<void>;
}

interface PlatformHandlerRegistry {
  register(name: string, handler: PlatformHandler): void;
  get(name: string): PlatformHandler | null;
  resolve(capability: string, manifest: DSLManifest): string[]; // Return handler names for this capability
}
```

**Execution Model:**

```
load(context)
  └─ Resolve handlers for load from manifest (e.g., [auth, validation, telemetry])
      └─ handlers[i].execute(context, 'before')  // Sequentially
          └─ If error: jump to error handlers, skip main/after
      └─ main: Atomic load operation
          └─ telemetry checkpoints (entry, mount, enable-render)
      └─ handlers[i].execute(context, 'after')   // Sequentially
          └─ If error: jump to error handlers
      └─ On error: handlers[i].execute(context, 'error')  // Error recovery
```

**Handler Responsibilities by Type:**

See REQ-RUNTIME-006 through REQ-RUNTIME-010.

**Acceptance Criteria:**

- Handlers resolved from DSL manifest (`auth: true`, `validation: true`, etc.)
- If handler not specified in DSL, it's skipped (not executed)
- Handlers execute sequentially in declaration order
- Handler errors halt execution and trigger error phase (unless handler specifies `continueOnError`)
- All handlers can access and mutate shared Context
- Telemetry emitted from handler execution

**Traceability:**

- ADR-058 (platform handler standardization)
- ADR-036 (lifecycle execution)

---

## REQ-RUNTIME-006: Platform Handler - Auth

**Status:** 📋 Planned

**Description:**

The `auth` handler validates user authentication and authorization before load/render. It runs in `before` phase and can read/validate JWT tokens, check user permissions against MFE requirements, and populate `context.user`.

**DSL Configuration:**

```yaml
manifest:
  version: 1.0.0
  name: my-mfe
  auth:
    enabled: true
    requiredRoles: [admin, user] # User must have one of these
    requiresJWT: true
    tokenLocation: headers.authorization # Where to find JWT (default)
```

**Handler Behavior:**

```typescript
// before phase
auth.execute(context, 'before'): Promise<void>
  ├─ Check context.jwt exists (if requiresJWT)
  ├─ Validate JWT signature (if applicable)
  ├─ Extract user info from JWT → context.user
  ├─ Check user.roles includes one of requiredRoles
  └─ If auth fails: throw AuthError → error phase
```

**Acceptance Criteria:**

- JWT must be valid and not expired
- User roles must match at least one required role
- context.user populated with id, username, roles, permissions
- Auth failure prevents load/render (blocks before handlers complete)
- Auth errors emit telemetry with failure reason
- Supports pluggable JWT validation (default: verify RS256 signature)

**Traceability:**

- REQ-RUNTIME-005 (platform handlers)
- ADR-041 (platform handler API)

---

## REQ-RUNTIME-007: Platform Handler - Validation

**Status:** 📋 Planned

**Description:**

The `validation` handler validates MFE inputs and prerequisites before load/render. It runs in `before` phase and checks context.inputs against MFE requirements defined in DSL.

**DSL Configuration:**

```yaml
manifest:
  version: 1.0.0
  name: data-analyzer
  validation:
    enabled: true
    inputSchema:
      type: object
      properties:
        dataUrl:
          type: string
          description: URL to CSV file
          required: true
        format:
          type: string
          enum: [csv, json, parquet]
          default: csv
```

**Handler Behavior:**

```typescript
// before phase
validation.execute(context, 'before'): Promise<void>
  ├─ Load inputSchema from manifest
  ├─ Validate context.inputs against schema (JSON Schema or similar)
  └─ If validation fails: throw ValidationError with path/reason
```

**Acceptance Criteria:**

- Validates context.inputs against DSL inputSchema
- Supports JSON Schema validation
- Provides detailed error messages (field name, expected type, actual value)
- Can validate nested objects and arrays
- Validation errors halt load/render (error phase)
- Optional fields allowed if not marked required
- Telemetry includes validation pass/fail

**Traceability:**

- REQ-RUNTIME-005 (platform handlers)
- ADR-036 (lifecycle execution)

---

## REQ-RUNTIME-008: Platform Handler - Telemetry

**Status:** 📋 Planned

**Description:**

The `telemetry` handler emits observability events throughout load/render lifecycle. It runs in `before`, `after`, and `error` phases, tracking durations, success/failure, user actions, and capability usage.

**Handler Behavior:**

```typescript
// before phase: record start time
telemetry.execute(context, 'before'): Promise<void>
  └─ context.telemetry = { startTime: Date.now() }

// main phase: atomic operation emits internal telemetry (entry, mount, enable-render)

// after phase: aggregate and emit success event
telemetry.execute(context, 'after'): Promise<void>
  └─ Emit event:
       name: 'load.completed'
       duration: Date.now() - startTime
       user: context.user.id
       capability: context.capability
       status: 'success'

// error phase: emit failure event with retry info
telemetry.execute(context, 'error'): Promise<void>
  └─ Emit event:
       name: 'load.failed'
       error: context.error.message
       retryCount: context.retryCount
       timestamp: Date.now()
```

**Telemetry Events:**

```typescript
interface TelemetryEvent {
  name: string; // e.g., 'load.entry.start', 'render.completed'
  capability: string; // load, render, query, emit, etc.
  phase: string; // before, main, after, error
  user?: string; // user.id if available
  duration?: number; // ms
  status: 'start' | 'end' | 'error' | 'success' | 'failure';
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
```

**Acceptance Criteria:**

- Telemetry emitted at start of before, end of after, on error
- Subphase durations (entry, mount, enable-render) tracked separately
- User ID included if user context available
- Can emit to external observability platform (e.g., DataDog, Honeycomb)
- No telemetry blocking (fire-and-forget, failures don't halt capability)
- Configurable log levels (debug, info, warn, error)

**Traceability:**

- REQ-RUNTIME-001 (load telemetry checkpoints)
- REQ-RUNTIME-004 (render telemetry)

---

## REQ-RUNTIME-009: Platform Handler - Error Handling

**Status:** 📋 Planned

**Description:**

The `error-handling` handler manages failures during load/render, including retry logic, fallback preparation, and error boundary integration. It runs in `error` phase and can retry the capability or prepare fallback state.

**DSL Configuration:**

```yaml
manifest:
  version: 1.0.0
  name: my-mfe
  errorHandling:
    enabled: true
    retry:
      maxAttempts: 3
      backoffMs: 1000
      exponential: true # 1s, 2s, 4s
    fallback:
      provideFallbackUI: true # MFE provides fallback component
      requestShellFallback: false # Or shell provides fallback
```

**Handler Behavior:**

```typescript
// error phase
errorHandling.execute(context, 'error'): Promise<void>
  ├─ Check error type and recoverability
  ├─ If retryable (network, timeout):
  │   ├─ Calculate backoff delay (1s, 2s, 4s exponential)
  │   ├─ Increment context.retryCount
  │   └─ If retryCount < maxAttempts: retry the capability
  ├─ If not retryable (validation, auth):
  │   └─ Prepare fallback state (MFE or shell)
  └─ Emit error telemetry
```

**Retry Logic:**

```
Attempt 1: Fails
  └─ backoff: 1000ms
     └─ Attempt 2: Fails
        └─ backoff: 2000ms
           └─ Attempt 3: Fails
              └─ Give up, return error
```

**Error Boundary Integration:**

- If render fails with error boundary enabled, catch error and apply fallback UI
- If load fails, populate context with fallback indicator for shell to handle
- Errors not caught by error boundary propagate to shell

**Acceptance Criteria:**

- Retry logic respects maxAttempts and backoff configuration
- Exponential backoff calculation correct (1s → 2s → 4s)
- Non-retryable errors (auth, validation, 4xx) do not retry
- Retryable errors (network, timeout, 5xx) retry up to maxAttempts
- Fallback UI applied before returning error to shell
- Telemetry includes retry count and final error reason
- Errors can be logged to external error tracking (e.g., Sentry)

**Traceability:**

- REQ-RUNTIME-002 (shared context, retryCount)
- ADR-036 (error phase execution)

---

## REQ-RUNTIME-010: Platform Handler - Caching

**Status:** 📋 Planned

**Description:**

The `caching` handler memoizes load and render results to improve performance on repeated requests. It runs in `before` phase (check cache) and `after` phase (populate cache).

**DSL Configuration:**

```yaml
manifest:
  version: 1.0.0
  name: my-mfe
  caching:
    enabled: true
    strategies:
      load:
        ttl: 3600000 # 1 hour in ms
        keyBy: [mfeId] # Cache key: mfeId
      render:
        ttl: 60000 # 1 minute in ms
        keyBy: [component] # Cache key: component name
```

**Handler Behavior:**

```typescript
// before phase: check cache
caching.execute(context, 'before'): Promise<void>
  ├─ Generate cache key from keyBy fields
  ├─ If cache hit (within TTL):
  │   └─ context.outputs = cachedResult
  │       context.fromCache = true
  └─ Else: proceed with capability

// after phase: populate cache
caching.execute(context, 'after'): Promise<void>
  └─ If context.fromCache === true: skip
  └─ Else: cache[key] = context.outputs, set TTL expiry
```

**Cache Storage:**

- In-memory map for single-process shells
- Redis/distributed cache for multi-process shells (configurable)

**Acceptance Criteria:**

- Cache key generated from specified fields (mfeId, component, etc.)
- TTL respected (cache entries expire after specified duration)
- Cache bypassed if TTL expired
- Cache hit returns identical result as fresh execution
- Telemetry indicates cache hit/miss
- Cache can be manually cleared via API

**Traceability:**

- REQ-RUNTIME-005 (platform handlers)
- ADR-036 (before/after phases)

---

## REQ-RUNTIME-011: Error Boundaries & Fallback UI

**Status:** 📋 Planned

**Description:**

Error boundaries catch React component errors during render and display fallback UI. Fallback can be provided by MFE (via DSL) or requested from shell.

**Error Boundary Behavior:**

```
render(component)
  └─ Create error boundary
      └─ If component throws during render:
         ├─ Catch error (Error Boundary)
         ├─ Check manifest.errorHandling.provideFallbackUI
         ├─ If true: render MFE's fallback component
         ├─ If false: request shell fallback handler
         └─ Return error status + fallback element reference
```

**Shell Fallback Handler:**

Shell provides a default fallback component:

```typescript
interface FallbackUIHandler {
  render(error: Error, context: Context): Promise<React.ComponentType>;
}

// Shell registers:
shell.registerFallbackHandler((error, context) => {
  return ErrorFallback; // Generic error UI
});
```

**Acceptance Criteria:**

- Error boundaries enabled by default during render
- Errors caught before propagating to shell
- MFE can opt-out of shell fallback (provideFallbackUI: true)
- Fallback UI receives error object and context for custom messaging
- Error boundary errors are logged/telemetered
- Multiple renders with different error boundaries work correctly

**Traceability:**

- REQ-RUNTIME-004 (render capability)
- REQ-RUNTIME-009 (error handling)

---

## REQ-RUNTIME-012: Telemetry Emission Points

**Status:** 📋 Planned

**Description:**

Telemetry is emitted at strategic points throughout load/render execution for full observability of MFE lifecycle.

**Load Telemetry Points:**

```
load() start
  ├─ before handlers start
  ├─ before handlers end (duration)
  ├─ entry phase start
  ├─ entry phase end (duration)
  ├─ mount phase start
  ├─ mount phase end (duration)
  ├─ enable-render phase start
  ├─ enable-render phase end (duration)
  ├─ after handlers start
  ├─ after handlers end (duration)
  └─ load() end (total duration)
```

**Render Telemetry Points:**

```
render() start
  ├─ before handlers start/end
  ├─ render phase start
  ├─ render phase end (duration)
  ├─ mount phase start
  ├─ mount phase end (duration)
  ├─ after handlers start/end
  └─ render() end (total duration)
```

**Error Telemetry:**

```
error detected
  ├─ error type (auth, validation, network, unknown)
  ├─ retry attempt N of M
  ├─ backoff delay before retry
  └─ final error (after all retries exhausted)
```

**Acceptance Criteria:**

- All timing measurements in milliseconds
- Telemetry events include timestamps with millisecond precision
- Events include context (capability, user, phase)
- Subphase durations sum to total duration (within rounding)
- Telemetry data available for querying post-execution
- No telemetry blocking (async emission)

**Traceability:**

- REQ-RUNTIME-008 (telemetry handler)

---

## Summary: Load & Render Execution Sequence

```typescript
// === LOAD SEQUENCE ===
const loadContext = new Context();
loadContext.user = authenticatedUser;
loadContext.inputs = { mfeEndpoint: 'http://...' };

const loadResult = await mfe.load(loadContext);
// loadContext.outputs now includes: { container, manifest, availableComponents }

// === RENDER SEQUENCE ===
// Reuse loadContext, add render inputs
loadContext.inputs = {
  component: 'DataAnalysisView',
  props: { data: [...] },
  containerId: 'mfe-root'
};

const renderResult = await mfe.render(loadContext);
// loadContext.outputs now includes: { element, componentInstance }

// === DOM LIFECYCLE ===
// Shell manages unmounting and cleanup:
if (nextComponent !== 'DataAnalysisView') {
  root.unmount();
  loadContext.outputs = {};  // Clear outputs for next render
}
```

---

## Architecture Decisions (ADRs)

The following ADRs document the architectural approach:

1. **ADR-059**: Platform Handler Interface & Execution Model (🟡 In Progress)

   - Handler interface, registry pattern, execution semantics
   - Standard handlers (auth, validation, telemetry, error-handling, caching)
   - DSL-driven handler resolution

2. **ADR-060**: Load Capability Atomic Operation Design (🟡 In Progress)

   - Entry, mount, enable-render subphases
   - Telemetry checkpoints at each phase
   - Atomicity guarantee and error recovery

3. **ADR-061**: Error Boundary & Fallback UI Strategy (📋 Planned)
   - React error boundary implementation
   - MFE vs. shell fallback precedence
   - Error logging and telemetry

## Next Phase

Following requirements elicitation and ADR creation:

1. **ADR-061**: Error Boundary & Fallback UI Strategy (to be created)
2. **GitHub Issues**: Create issues for implementation of each REQ-RUNTIME-XXX requirement
3. **Implementation**: Follow REQ-RUNTIME-001 → REQ-RUNTIME-012 in sequence

---

## Related Documentation

- `/docs/architecture-decisions.md` - ADR-036, ADR-047, ADR-058, ADR-041
- `/docs/dsl-contract-requirements.md` - DSL manifest structure
- `/docs/acceptance-criteria/` - Gherkin scenarios
- `/src/runtime/base-mfe.ts` - BaseMFE abstract class
- `/src/runtime/handlers/` - Platform handler implementations (to be created)

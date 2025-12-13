# Runtime Load & Render Acceptance Criteria

**Status:** 📋 In Development  
**Related Requirements:** REQ-RUNTIME-001 through REQ-RUNTIME-012  
**Last Updated:** 2025-12-06

---

## Feature: Load Capability - Atomic Entry, Mount, Enable-Render

```gherkin
Feature: MFE Load Capability
  As a shell developer
  I want to load remote MFEs atomically with clear state transitions
  So that I can compose MFEs reliably with observability

  Scenario: Load remote MFE successfully
    Given a remote MFE at "http://remote-mfe:3001"
    And the MFE exposes components: ["DataAnalysisView", "UploadForm"]
    And the shell has authenticated user with role "user"
    
    When shell calls load(context)
    Then the load operation completes atomically
    And LoadResult.status is "loaded"
    And LoadResult.container is a valid Module Federation container
    And LoadResult.manifest is the parsed DSL
    And LoadResult.availableComponents includes "DataAnalysisView"
    And LoadResult.availableComponents includes "UploadForm"
    And telemetry events emitted: ["load.entry.start", "load.entry.duration", "load.mount.start", "load.mount.duration", "load.enable_render.start", "load.enable_render.duration"]
    And context.outputs populated with: { container, manifest, availableComponents }

  Scenario: Load fails at entry phase with network error
    Given a remote MFE at "http://remote-mfe:3001" (unreachable)
    And shell configured with error-handling.retry.maxAttempts = 3
    
    When shell calls load(context)
    Then the load operation fails atomically
    And telemetry event "load.entry.start" emitted
    And no subsequent phase events emitted (mount, enable_render skipped)
    And error handler attempts retry #1 after 1000ms backoff
    And error handler attempts retry #2 after 2000ms backoff
    And error handler attempts retry #3 after 4000ms backoff
    And after 3 retries, load fails with status "error"
    And LoadResult.status is "error"
    And context.error contains the network error message

  Scenario: Load fails at mount phase with validation error
    Given a remote MFE with invalid Module Federation container
    
    When shell calls load(context)
    Then entry phase completes successfully
    And mount phase fails with validation error
    And telemetry event "load.mount.duration" emitted (with error indicator)
    And no enable_render phase attempted
    And LoadResult.status is "error"

  Scenario: Context flows unchanged through all load phases
    Given an authenticated context with user.id = "user123"
    And context.inputs = { mfeEndpoint: "..." }
    
    When shell calls load(context) with before/after hooks
    Then context.user remains "user123" throughout all phases
    And context.requestId remains unchanged
    And context.inputs remains { mfeEndpoint: "..." }
    And handlers can mutate context for cross-handler communication
    And context.outputs is empty before load, populated after

  Scenario: Load validates component list matches DSL exposes
    Given a remote MFE with DSL exposes: ["View1", "View2", "Widget1"]
    
    When shell calls load(context)
    Then LoadResult.availableComponents exactly matches DSL exposes list
    And LoadResult.availableComponents order is consistent

  Scenario: Load returns metadata for shell to validate before render
    Given a loaded MFE with LoadResult.capabilities containing capability metadata
    
    When shell inspects LoadResult.capabilities
    Then each capability entry includes: { name, available, requiresAuth?, requiresValidation? }
    And shell can decide to proceed to render based on capability availability
    And shell can decide to fail fast if required capability unavailable

```

---

## Feature: Shared Context Across Load & Render

```gherkin
Feature: Unified Context Object
  As a handler developer
  I want one context object that flows through all lifecycle phases
  So that user state and intermediate results are consistently available

  Scenario: Context persists from load to render
    Given a context with user.id = "user123" after load
    And LoadResult.availableComponents = ["DataView"]
    
    When shell calls render(context) after load
    Then context.user still equals the authenticated user
    And context.requestId remains unchanged (same request)
    And context.outputs from load are accessible to render handlers
    And context.phase changes from "load" to "render"
    And context.capability changes to "render"

  Scenario: Handler can read all prior capability outputs
    Given load completed with context.outputs = { container, manifest }
    
    When render starts and before handlers execute
    Then handlers can read context.outputs.container
    And handlers can read context.outputs.manifest
    And handlers cannot read outputs they haven't seen before (type safety)

  Scenario: Handlers can mutate context for cross-handler communication
    Given multiple handlers in the before phase
    
    When auth handler executes and sets context.authorizedRoles = ["admin"]
    And validation handler executes next
    Then validation handler can read context.authorizedRoles
    And validation handler can use roles for scoped validation
    And context mutations visible to next handler in sequence

  Scenario: Phase tracking in context reflects current lifecycle phase
    Given a load operation with before, main, after, error phases
    
    When before handlers execute
    Then context.phase === "before"
    When main load operation executes
    Then context.phase === "main"
    When after handlers execute
    Then context.phase === "after"
    When error occurs and error handlers execute
    Then context.phase === "error"

```

---

## Feature: Render Capability - Component-Aware, Shell-Agnostic

```gherkin
Feature: MFE Render Capability
  As a shell developer
  I want to render specific components from a loaded MFE
  So that I can compose multiple views without knowing the MFE internals

  Scenario: Render component successfully with Option A format
    Given a loaded MFE with available components ["DataAnalysisView", "UploadForm"]
    And DOM container element with id "mfe-root"
    
    When shell calls render(context) with:
      context.inputs = {
        component: "DataAnalysisView",
        props: { data: [...], onComplete: callback },
        containerId: "mfe-root"
      }
    Then RenderResult.status is "rendered"
    And RenderResult.component is "DataAnalysisView"
    And RenderResult.element is the mounted DOM element
    And component received props correctly
    And telemetry events: ["render.renderStart", "render.renderDuration", "render.mountStart", "render.mountDuration"]

  Scenario: Render validates component exists before mounting
    Given a loaded MFE with available components ["DataAnalysisView"]
    
    When shell calls render(context) with component: "NonExistentView"
    Then RenderResult.status is "error"
    And error message indicates component not found in availableComponents
    And no DOM mounting attempted
    And error telemetry emitted

  Scenario: Render applies error boundary to component
    Given a component that throws an error during render
    And render config with errorBoundary.enabled = true
    
    When shell calls render(context)
    Then error is caught by error boundary
    And fallback UI is displayed (either MFE or shell fallback)
    And component error is logged but doesn't crash shell
    And RenderResult.status is "rendered" (with fallback)

  Scenario: Render applies theme context to component
    Given a theme config with MUI theme overrides
    
    When shell calls render(context) with theme config
    Then component is wrapped with ThemeProvider
    And component can access theme via useTheme()
    And theme overrides are applied correctly
    And component styling respects theme

  Scenario: Render handles props validation against DSL schema
    Given a component with DSL inputSchema defining required props
    
    When shell calls render(context) with incomplete props
    Then validation handler rejects render
    And error indicates missing required props
    And no DOM mounting attempted

  Scenario: Render is shell-agnostic (no routing, nav awareness)
    Given a component that needs routing context
    
    When shell calls render(context)
    Then component renders without shell layout knowledge
    And component can optionally receive routing context via props
    And component does not receive implicit shell state
    And component behavior identical whether in shell or standalone

  Scenario: Multiple renders of different components in same container
    Given DOM container and component A currently rendered
    
    When shell calls render(context) with component: "B"
    Then component A remains mounted (shell manages unmounting)
    And component B is also rendered to same container
    And both components coexist (or shell unmounts A before B, based on shell logic)

  Scenario: Render returns metadata for shell observation
    Given a successfully rendered component
    
    When shell inspects RenderResult
    Then RenderResult includes: { component, element, timestamp, duration }
    And RenderResult.duration includes separate render vs. mount times
    And shell can use duration for performance monitoring
    And shell can reference element for future DOM operations

```

---

## Feature: Platform Handler - Auth

```gherkin
Feature: Auth Platform Handler
  As a security engineer
  I want auth to be enforced before load/render
  So that only authorized users can access MFEs

  Scenario: Auth handler validates JWT before load
    Given a remote MFE requiring auth with requiredRoles: ["admin"]
    And an authenticated user with JWT token and roles: ["admin", "user"]
    
    When auth handler executes in before phase
    Then JWT signature is validated
    And user roles are extracted from JWT
    And user roles are checked against requiredRoles
    And context.user is populated with { id, username, roles }
    And load proceeds to main phase

  Scenario: Auth handler rejects invalid JWT
    Given a remote MFE requiring auth
    And a request with expired JWT
    
    When auth handler executes
    Then auth handler throws AuthError
    And load immediately jumps to error phase
    And error telemetry emitted with reason "invalid_jwt"
    And context.error contains auth failure message

  Scenario: Auth handler rejects insufficient roles
    Given a remote MFE requiring roles: ["admin"]
    And a user with roles: ["user"]
    
    When auth handler executes
    Then auth handler throws AuthError (insufficient roles)
    And load skipped, error phase activated
    And error telemetry includes user.id and required vs. actual roles

  Scenario: Auth handler optional if MFE doesn't require it
    Given a public remote MFE with auth.enabled = false
    
    When auth handler configuration check
    Then auth handler is not included in handler resolution
    And load proceeds without auth checks

```

---

## Feature: Platform Handler - Validation

```gherkin
Feature: Validation Platform Handler
  As an API contract enforcer
  I want input validation before load/render
  So that MFEs receive well-formed data

  Scenario: Validation handler checks inputs against schema
    Given a remote MFE with inputSchema: { properties: { dataUrl: string (required) } }
    And context.inputs = { dataUrl: "http://..." }
    
    When validation handler executes in before phase
    Then inputs are validated against schema
    And validation passes
    And load proceeds to main phase

  Scenario: Validation handler rejects missing required fields
    Given a remote MFE with inputSchema requiring dataUrl
    And context.inputs = { }  (missing dataUrl)
    
    When validation handler executes
    Then validation handler throws ValidationError
    And error message indicates missing field "dataUrl"
    And load immediately jumps to error phase
    And error telemetry includes field path and expected type

  Scenario: Validation handler rejects type mismatches
    Given a remote MFE expecting dataUrl: string
    And context.inputs = { dataUrl: 123 }
    
    When validation handler executes
    Then validation rejects
    And error indicates type mismatch (expected string, got number)

  Scenario: Validation handler supports nested object validation
    Given complex inputSchema with nested properties
    
    When validation handler executes
    Then nested objects validated recursively
    And error path includes full property path (e.g., "config.database.host")

```

---

## Feature: Platform Handler - Error Handling & Retry

```gherkin
Feature: Error Handling Platform Handler
  As a reliability engineer
  I want transient errors to be retried automatically
  So that network blips don't fail the entire load

  Scenario: Error handler retries network failures
    Given a load that fails with network error
    And errorHandling.retry: { maxAttempts: 3, backoffMs: 1000, exponential: true }
    
    When load fails during entry phase
    Then error handler detects network error (retryable)
    And error handler schedules retry after 1000ms
    And retry #1 executes, fails
    And error handler schedules retry after 2000ms
    And retry #2 executes, succeeds
    Then load completes successfully
    And telemetry includes retry count = 2

  Scenario: Error handler gives up after max retries
    Given a load that consistently fails (network down)
    And maxAttempts = 3
    
    When all 3 retries fail
    Then error handler stops retrying
    And load returns error status
    And telemetry includes retryCount = 3 and "max_retries_exceeded"

  Scenario: Error handler doesn't retry non-transient errors
    Given a load that fails with auth error (401)
    
    When load fails during auth handler
    Then error handler detects non-retryable error
    And no retry attempted
    And load fails immediately
    And telemetry includes "auth_error" (no retry)

  Scenario: Error handler doesn't retry validation errors
    Given a load that fails validation (bad input)
    
    When validation fails
    Then error handler detects validation error (non-retryable)
    And no retry attempted
    And load fails immediately

  Scenario: Exponential backoff calculation is correct
    Given errorHandling.retry: { exponential: true, backoffMs: 1000 }
    
    When retries occur
    Then retry #1 backoff = 1000ms
    And retry #2 backoff = 2000ms
    And retry #3 backoff = 4000ms
    And retry #4 backoff = 8000ms

```

---

## Feature: Error Boundaries & Fallback UI

```gherkin
Feature: Error Boundaries and Fallback UI
  As a UX engineer
  I want errors to be handled gracefully with fallback UI
  So that users see helpful messages instead of crashes

  Scenario: Error boundary catches component render error
    Given a component that throws during render
    And render config with errorBoundary.enabled = true
    
    When component renders and throws
    Then error boundary catches error
    And RenderResult.status is "rendered" (with fallback)
    And fallback UI is displayed instead of broken component
    And error is logged to telemetry

  Scenario: MFE provides its own fallback component
    Given a remote MFE with provideFallbackUI = true
    And the MFE has a fallback component defined
    
    When render fails with error boundary
    Then MFE's fallback component is displayed
    And fallback receives error object for custom messaging
    And shell doesn't provide its own fallback

  Scenario: Shell provides fallback if MFE doesn't
    Given a remote MFE with provideFallbackUI = false
    And shell has registered a fallback handler
    
    When render fails with error boundary
    Then shell's fallback handler is called
    And shell's fallback component is displayed
    And fallback includes generic error messaging

  Scenario: Error boundary doesn't hide shell-level errors
    Given an error in shell itself (e.g., invalid container)
    
    When shell code throws before MFE render
    Then error boundary doesn't catch it (not MFE error)
    And error propagates to shell error handling

```

---

## Feature: Telemetry Emission

```gherkin
Feature: Telemetry Observability
  As an operations engineer
  I want detailed telemetry from load/render
  So that I can monitor and troubleshoot MFE behavior

  Scenario: Load emits telemetry at each phase
    Given a load operation with entry, mount, enable-render subphases
    
    When load completes
    Then telemetry events emitted:
      - load.before.start
      - load.before.end (with duration)
      - load.entry.start
      - load.entry.end (with duration)
      - load.mount.start
      - load.mount.end (with duration)
      - load.enable_render.start
      - load.enable_render.end (with duration)
      - load.after.start
      - load.after.end (with duration)
      - load.completed (with total duration)
    And each event includes: { name, capability, user, timestamp }

  Scenario: Render emits telemetry at each phase
    Given a render operation
    
    When render completes
    Then telemetry events include:
      - render.before.start/end
      - render.start (render phase)
      - render.duration (render time)
      - render.mount.start/end
      - render.after.start/end
      - render.completed (total duration)

  Scenario: Error telemetry includes retry information
    Given a load that fails and retries
    
    When load completes with retry
    Then error telemetry includes:
      - error_type: "network" | "auth" | "validation" | etc.
      - retry_count: 2
      - retry_strategy: "exponential"
      - final_error: error message after all retries

  Scenario: Subphase durations sum to total duration
    Given load with entry(100ms) + mount(200ms) + enable_render(50ms) = 350ms total
    
    When telemetry calculated
    Then load.completed.duration ≈ 350ms (within rounding)
    And subphase durations individually accurate

  Scenario: Telemetry includes user context
    Given an authenticated user with id = "user123"
    
    When load completes
    Then each telemetry event includes user: "user123"
    And shell/ops team can correlate events by user

```

---

## Feature: Load Result Metadata Validation

```gherkin
Feature: Load Result Validation
  As a shell developer
  I want to validate load results before proceeding
  So that I catch invalid MFE state early

  Scenario: Load result includes all required metadata
    Given a completed load operation
    
    When shell inspects LoadResult
    Then LoadResult includes:
      - status: "loaded" | "error"
      - container: ModuleFederationContainer (if successful)
      - manifest: DSLManifest
      - availableComponents: string[]
      - capabilities: CapabilityMetadata[]
      - timestamp: Date
      - duration: number
      - telemetry: { entry, mount, enableRender }

  Scenario: Shell validates component exists before render
    Given LoadResult.availableComponents = ["View1", "View2"]
    And shell wants to render "View3"
    
    When shell checks LoadResult.availableComponents
    Then shell can detect that "View3" is not available
    And shell can fail gracefully or show error message
    And shell doesn't attempt render with non-existent component

  Scenario: Shell validates required capabilities available
    Given LoadResult.capabilities with { name: "render", available: true }
    
    When shell inspects capabilities
    Then shell can verify render capability is available
    And shell can decide to proceed or defer render

```

---

## Feature: Context Input/Output Lifecycle

```gherkin
Feature: Context Inputs and Outputs
  As a platform handler developer
  I want clear semantics around context.inputs and context.outputs
  So that I know when data is available and when I can mutate it

  Scenario: Context inputs set before capability execution
    Given shell calls load(context) with context.inputs = { mfeEndpoint: "..." }
    
    When before handlers execute
    Then handlers can read context.inputs
    And handlers can check for required inputs
    And handlers cannot modify context.inputs (read-only)

  Scenario: Context outputs populated during capability execution
    Given load operation in progress
    
    When load main phase completes
    Then context.outputs is populated with: { container, manifest, availableComponents }
    And after handlers can read context.outputs
    And shell receives outputs in LoadResult

  Scenario: Context outputs flow to next capability (load → render)
    Given load completed with context.outputs.container available
    
    When shell calls render(context) reusing same context
    Then render handlers can read context.outputs.container
    And render handlers can read context.outputs.manifest
    And render can use loaded container instead of re-fetching

```

# DSL Contract Implementation Requirements

**Document Status:** Draft - In Progress  
**Created:** 2025-11-26  
**Owner:** Sean  
**Feature:** DSL Platform Contract Implementation  
**Related Docs:**

**Status:** ✅ Complete
**Last Updated:** 2025-11-29
**Owner:** Sean
**Feature:** DSL Platform Contract Implementation

## Purpose

- ADRs: docs/architecture-decisions.md (ADR-036, ADR-046, ADR-048)
- Issues: #39, #41, #44, #46, #49
- Acceptance Criteria: docs/acceptance-criteria/lifecycle-hooks.feature, type-system.feature

All critical requirements (REQ-042 to REQ-058) are **✅ Complete** and implemented.

This document captures detailed requirements for implementing the DSL (Domain Specific Language) platform contract. While the orchestration requirements define WHAT MFEs must expose, this document defines HOW the DSL contract is executed, validated, and enforced at runtime.

- Authorization grammar, dependency resolution, and advanced context features are deferred. See deferred-backlog.md for tracking.

- Language-specific implementation patterns

---

## Requirements Gathering Sessions

### Session 6: DSL Contract Implementation

**Goal:** Define detailed requirements for DSL implementation - types, handlers, lifecycle semantics, and authorization expressions.

**Status:** 🔄 IN PROGRESS

---

## Session 6: DSL Contract Implementation - RESPONSES

**Date:** 2025-11-26

### Question 1: Lifecycle Hook Execution Semantics

**Response:**

**Terminology Decision:**

- ❌ `wrapped` → ✅ `contained` (clearer meaning)

**Confirmed Semantics:**

| Flag              | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `mandatory: true` | Hook MUST execute even if previous hooks failed (cannot be skipped) |
| `contained: true` | Platform wraps hook in try-catch; failures don't crash MFE          |

**Execution Rules:**

2. ✅ Mandatory hooks that fail → **fail silently** (log telemetry, continue chain)

3. ✅ `before`/`main`/`after` phases CAN have `mandatory` and `contained` flags

4. ✅ `before`/`after`/`error` phase failures → fail silently, continue
5. ✅ **ALL hook failures emit telemetry** via `emit` capability

before hooks (fail silently + telemetry) →
main phase (failures propagate to caller) →
after hooks (fail silently + telemetry)
↓ if main failed
error hooks (fail silently + telemetry)

````

**Automatic Telemetry on Hook Failure:**

```yaml
# Platform automatically emits when any hook fails
emit:
  eventType: error
  eventData:
    source: lifecycle-hook
    hook: validateConfig # Hook that failed
    phase: before # Which phase
    capability: load # Parent capability
    mfe: csv-analyzer # MFE name
    error: { message, stack } # Error details
  severity: warn # warn for hooks, error for main
  tags: [lifecycle, hook-failure]
````

---

## Decision Log

### DEC-016: Lifecycle Hook Execution Model

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
DSL defines lifecycle hooks with `mandatory` and `contained` (formerly `wrapped`) flags. Need to define execution semantics for hook failures.

**Decision:**

- Rename `wrapped` to `contained` for clarity
- `mandatory: true` = Hook executes even if previous hooks failed
- `contained: true` = Platform catches exceptions, hook can't crash MFE
- `main` phase failures propagate to caller (capability fails)
- `before`/`after`/`error` phase failures are silent (logged + telemetry)
- ALL hook failures automatically emit telemetry event

**Rationale:**

- **Resilience over strict error propagation** - System continues working even when hooks fail
- **Observability** - All failures captured via telemetry for debugging
- **Clear contract** - `main` is the actual work; lifecycle hooks are enhancements
- **Contained terminology** - Clearer than "wrapped" for describing try-catch behavior

**Consequences:**

- ✅ MFEs are resilient to hook failures
- ✅ Full visibility into all failures via telemetry
- ✅ Clear distinction between capability failure vs hook failure
- ⚠️ Developers must check telemetry to discover hook issues
- ⚠️ Silent failures could mask bugs in development

---

### DEC-017: No Custom Lifecycle Phases

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
Original DSL design included a `custom:` section for domain-specific lifecycle phases. Need to decide if this adds value or complexity.

**Decision:**

- Remove `custom:` lifecycle section entirely
- Only 4 standard phases: `before`, `main`, `after`, `error`
- MFE teams extend standard phases by adding their own hooks
- Declaration order = execution order within each phase

**Rationale:**

- **Simplicity** - Fewer concepts to understand
- **Consistency** - All hooks follow same execution model
- **Flexibility** - Teams can add any hooks to standard phases
- **No phase ordering ambiguity** - Custom phases would require ordering rules

**Consequences:**

- ✅ Simpler mental model for developers
- ✅ All hooks share same telemetry/failure semantics
- ✅ No need for phase ordering configuration
- ⚠️ Less explicit grouping of domain-specific hooks

---

### DEC-018: Handler Array Support

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
Each hook has a `handler` field. Should it support multiple handlers per hook?

**Decision:**

- `handler` can be a single string OR an array of strings
- Handlers execute sequentially within the hook
- **main phase**: AND semantics - all must succeed, first failure stops and propagates
- **before/after/error phases**: OR-like semantics - all run, failures logged but don't stop

**Rationale:**

- **Developer flexibility** - Group related operations in one hook
- **Cleaner DSL** - Fewer hooks when operations are logically related
- **Consistent with resilience principle** - Non-main phases continue on failure

**Examples:**

```yaml
# Single handler (string)
handler: validateCsvFile

# Multiple handlers (array)
handler: [validateCsvFile, checkFileSize, scanForMalicious]
```

**Consequences:**

- ✅ More expressive DSL
- ✅ Reduced hook count for related operations
- ✅ Clear AND vs OR semantics per phase
- ⚠️ Schema validation must accept both string and array

---

### DEC-019: Handler Discovery Convention

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
DSL handler strings (e.g., `handler: initialize`) need a discovery and invocation mechanism. How does the platform find and call these handlers at runtime?

**Decision:**

- **Convention-based hybrid**: DSL defines conformance contract, implementation is domain-specific
- **Neutral handler naming in DSL**: Names are language-agnostic, mapped at runtime
- **Validation timing**:
  - **Capability handlers**: Fail fast at MFE startup (must be discoverable immediately)
  - **Lifecycle handlers**: Deferred validation when capability first invoked
- **Language-specific conventions** applied by code generators:
  - JavaScript/TypeScript: `camelCase` methods on MFE instance
  - Python: `snake_case` functions
  - Go: `PascalCase` exported methods
- **Handler discovery**: Platform uses reflection/introspection per language

**Rationale:**

- **DSL is conformance contract** - "MFE presents itself as conforming to base class contract but manages its own implementation internally"
- **Fail fast for critical handlers** - Missing capability handlers caught at startup, not first use
- **Deferred for lifecycle** - Allows conditional handlers that may not exist until runtime
- **Neutral naming** - DSL doesn't favor any language's conventions
- **Language-native feel** - Generated code uses each ecosystem's idioms

**Examples:**

```yaml
# DSL (neutral)
- load:
    handler: initializeRuntime
    lifecycle:
      before:
        - validateConfig:
            handler: checkConfiguration
```

```typescript
// JavaScript (camelCase) - generated code
class CsvAnalyzerMFE extends BaseMFE {
  initializeRuntime(context: Context): Promise<void> { ... }
  checkConfiguration(context: Context): void { ... }
}
```

```python
# Python (snake_case) - generated code
class CsvAnalyzerMFE(BaseMFE):
    def initialize_runtime(self, context: Context) -> None: ...
    def check_configuration(self, context: Context) -> None: ...
```

```go
// Go (PascalCase) - generated code
func (m *CsvAnalyzerMFE) InitializeRuntime(ctx Context) error { ... }
func (m *CsvAnalyzerMFE) CheckConfiguration(ctx Context) error { ... }
```

**Consequences:**

- ✅ DSL remains language-agnostic
- ✅ Each language runtime implements discovery idiomatically
- ✅ Early failure detection for capability handlers
- ✅ Telemetry emitted on handler-not-found events
- ⚠️ Code generators must implement naming convention mapping
- ⚠️ Neutral naming may not match any language exactly

---

### DEC-020: Unified Type System

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
DSL uses various types (primitives, specialized, GraphQL-aligned, enums, unions). Need a unified type system that flows from DSL → GraphQL → TypeScript/Python/Go.

**Decision:**

1. **Nullability: Follow GraphQL convention** - Types are nullable by default, use `!` for required

   - `string` = nullable string
   - `string!` = required string (non-null)
   - Consistent with GraphQL schema generation

2. **Validation: Hybrid, compile-time heavy** - Failing build is better than runtime defensive coding

   - Code generators produce validation code from DSL constraints
   - Runtime validation is optional double-check, not primary defense
   - Build fails if types/constraints are invalid
   - Generated code includes type guards and assertions

3. **Extensibility: Type system is extensible** - MFE teams can define custom specialized types
   - Platform provides base specialized types (`jwt`, `email`, `datetime`, `file`, etc.)
   - Teams can define domain-specific types that extend primitives
   - Custom types must specify: base type, validation rules, metadata

**Type Hierarchy:**

```
Primitive Types (built-in)
├── string, number, boolean, object, array
│
Specialized Types (platform-provided, extensible)
├── jwt (extends string) - JWT validation, claims extraction
├── datetime (extends string) - ISO 8601 format
├── email (extends string) - RFC 5322 format
├── url (extends string) - URL format with protocol validation
├── id (extends string) - Non-empty, pattern: uuid|cuid
├── file (extends object) - File reference with format/size constraints
├── element (extends object) - DOM element reference
│
Custom Types (team-defined)
├── MFE teams extend primitives or specialized types
├── Define validation, constraints, metadata
└── Registered in DSL types section
```

**Rationale:**

- **GraphQL alignment** - DSL types map cleanly to GraphQL schema
- **Compile-time safety** - Catch type errors at build, not runtime
- **Extensibility** - Teams aren't limited to platform types
- **Single source of truth** - DSL defines types once, generates everywhere

**Type Mapping:**

| DSL          | GraphQL               | TypeScript                | Python              |
| ------------ | --------------------- | ------------------------- | ------------------- |
| `string`     | `String`              | `string \| null`          | `Optional[str]`     |
| `string!`    | `String!`             | `string`                  | `str`               |
| `number`     | `Float`               | `number \| null`          | `Optional[float]`   |
| `number!`    | `Float!`              | `number`                  | `float`             |
| `boolean`    | `Boolean`             | `boolean \| null`         | `Optional[bool]`    |
| `boolean!`   | `Boolean!`            | `boolean`                 | `bool`              |
| `array<T>`   | `[T]`                 | `T[] \| null`             | `Optional[List[T]]` |
| `array<T>!`  | `[T]!`                | `T[]`                     | `List[T]`           |
| `array<T!>!` | `[T!]!`               | `T[]` (no null items)     | `List[T]`           |
| `object`     | `JSON`                | `Record<string, unknown>` | `Dict[str, Any]`    |
| `enum`       | `enum Name {...}`     | `type Name = 'a' \| 'b'`  | `Literal['a', 'b']` |
| `A \| B`     | `union Name = A \| B` | `A \| B`                  | `Union[A, B]`       |
| `jwt`        | `String` + directive  | `string` + validator      | `str` + validator   |
| `datetime`   | `DateTime` scalar     | `string` (ISO)            | `datetime`          |
| `id!`        | `ID!`                 | `string`                  | `str`               |

**Consequences:**

- ✅ Clean DSL → GraphQL → TypeScript/Python flow
- ✅ Compile-time type safety prioritized
- ✅ Teams can extend type system for domain needs
- ✅ Consistent nullability semantics across stack
- ⚠️ Nullable-by-default differs from TypeScript strict mode
- ⚠️ Custom types require validation rule definitions

---

### DEC-021: Data Type Metadata

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
DSL type definitions include metadata fields (`owner`, `tags`). Need to define their purpose and consumption.

**Decision:**

1. **`owner` field purpose:**

   - Primary: Documentation and attribution
   - Future: Access control (only owner team can modify type definition)
   - Potential: Alert routing (notifications go to owner team)

2. **`tags` field purpose:**

   - Custom tags are the default - teams define their own tag vocabulary
   - No platform-enforced tag semantics (e.g., `pii-possible` is informational)
   - Tags enable filtering and categorization

3. **Metadata consumption:**
   - Primary: Tooling - searchable in registry (orchestration feature)
   - Secondary: Code generation (comments, annotations)
   - Future: Access control integration

**Rationale:**

- **Custom tags over prescribed** - Teams have domain-specific categorization needs
- **Tooling-first** - Registry search is the primary value driver
- **Incremental access control** - Start with documentation, add enforcement later

**Examples:**

```yaml
types:
  - AnalysisResult:
      owner: analytics-team # Team responsible for this type
      tags: [pii-possible, cached] # Custom tags for filtering
      fields:
        - name: id
          type: id!
        - name: userId
          type: string! # pii-possible tag signals this
```

**Registry search (orchestration):**

```graphql
query {
  searchTypes(tags: ["pii-possible"]) {
    name
    owner
    mfe
  }
}
```

**Consequences:**

- ✅ Flexible tagging for diverse team needs
- ✅ Registry becomes searchable knowledge base
- ✅ Owner attribution enables future access control
- ⚠️ No tag standardization - teams must coordinate
- ⚠️ Access control deferred to future phase

---

### DEC-022: Language Field and Template Selection

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
DSL includes a `language` field. Need to define supported languages and how language affects code generation and runtime.

**Decision:**

1. **Supported languages for V1**: JavaScript/TypeScript only

   - Primary focus on web MFEs using Module Federation
   - Python, Go, Rust are future considerations

2. **Language affects code generation**:

   - Template selection (language-specific template folders)
   - Build tooling selection (rspack for JS/TS)
   - Handler naming conventions (per DEC-019)

3. **Runtime implications**:
   - JS/TS MFEs use Module Federation for browser loading
   - Non-JS MFEs (future) would be **data-only in a web shell**
   - No native runtime loading for Python/Go in browser
   - Backend MFEs (services) communicate via API, not federation

**Rationale:**

- **Focus on JS/TS** - Module Federation is JavaScript-native
- **Data-only pattern** - Non-JS backends provide data, JS shell renders UI
- **Template-driven** - Language selection drives entire generation pipeline

**Examples:**

```yaml
# JS/TS MFE - full Module Federation
name: csv-analyzer
language: javascript
type: tool
# → Uses src/templates/react/remote/
# → Generates rspack.config.js
# → Browser-loadable via remoteEntry.js

# Future: Python backend service
name: analysis-service
language: python
type: service
# → Uses src/templates/python/service/
# → Generates FastAPI/Flask app
# → Data-only, consumed by JS shell via API
```

**Consequences:**

- ✅ Clear V1 scope (JS/TS only)
- ✅ Template folder structure mirrors language support
- ✅ Non-JS services integrate via data APIs
- ⚠️ Non-JS browser MFEs not supported (no WASM federation yet)
- ⚠️ Multi-language support requires additional templates

---

### DEC-023: Data Lifecycle Alignment

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
DSL example showed a `loading` phase in data lifecycle. Need to clarify if data operations have different lifecycle phases than capabilities.

**Decision:**

1. **No `loading` phase** - It's actually part of `main`

   - `loading` is a handler implementation detail, not a phase
   - UI feedback (loading indicators) is one way to implement a handler
   - Handlers in `main` can do whatever they need (show loading, fetch, etc.)

2. **Data lifecycle aligns with capability lifecycle**

   - Same 4 phases: `before`, `main`, `after`, `error`
   - No special phases for data operations
   - Consistency across all lifecycle definitions

3. **Data fetching is a capability**
   - `fetchData` or similar would be a standard platform capability
   - Uses same lifecycle model as other capabilities
   - Queries/mutations are implementations of data capabilities

**Rationale:**

- **Simplicity** - One lifecycle model for everything
- **Consistency** - Same mental model for capabilities and data
- **Flexibility** - Handlers can implement any behavior (loading UI, etc.)

**Corrected DSL Example:**

```yaml
# WRONG - loading is not a phase
queries:
  - getAnalysis:
      lifecycle:
        loading: [showLoadingIndicator] # ✗ Invalid

# CORRECT - loading indicator is a handler in main
capabilities:
  - fetchData:
      handler: executeQuery
      lifecycle:
        before:
          - validateToken:
              handler: checkAuth
          - checkRateLimit:
              handler: enforceRateLimit
        main:
          - showLoading:
              handler: displayLoadingIndicator
          - executeQuery:
              handler: runGraphQLQuery
          - hideLoading:
              handler: hideLoadingIndicator
        after:
          - cacheResponse:
              handler: updateCache
        error:
          - handleError:
              handler: showErrorMessage
```

**Consequences:**

- ✅ Single lifecycle model (4 phases)
- ✅ Data operations are just capabilities
- ✅ No special-case handling for data lifecycle
- ⚠️ DSL examples in docs need correction
- ⚠️ `loading` phase references should be removed

---

### DEC-024: GeneratedFrom Traceability

**Date:** 2025-11-26  
**Status:** Accepted

**Context:**
DSL includes a `generatedFrom` section indicating source specifications (OpenAPI, GraphQL schemas, etc.). Need to define its purpose.

**Decision:**

1. **Purpose: Data lineage and SOR (System of Record) traceability**

   - Shows downstream source of data/API
   - Documents which spec(s) the MFE's data layer was generated from
   - Enables understanding of data dependencies across MFEs

2. **Indexed for search and dependency analysis**

   - Registry indexes `generatedFrom` for search
   - Query: "Which MFEs use this API spec?"
   - Query: "Which MFEs depend on the same data source?"
   - Enables impact analysis when source spec changes

3. **Machine-readable in DSL (not just comments)**
   - Tooling can parse and use this information
   - Supports automated dependency graphs
   - Enables regeneration workflows

**Rationale:**

- **Dependency understanding** - Know which MFEs share data sources
- **Impact analysis** - When API changes, find affected MFEs
- **Searchability** - Registry queries by source spec
- **Automation** - Regeneration when source spec updates

**Examples:**

```yaml
data:
  generatedFrom:
    - openapi: ./api-spec.yaml
      service: analysis-api
      baseUrl: http://analysis-api:8080
    - graphql: ./schema.graphql
      service: user-service
```

```graphql
# Registry queries enabled:
query findMFEsByService($service: String!) {
  searchMFEs(generatedFrom: { service: $service }) {
    name
    version
    owner
    generatedFrom {
      type
      service
      specPath
      version
    }
  }
}

query findSharedDependencies($mfeName: String!) {
  mfe(name: $mfeName) {
    generatedFrom {
      service
      relatedMFEs {
        name
        owner
      }
    }
  }
}
```

**Consequences:**

- ✅ Data lineage visible in registry
- ✅ Cross-MFE dependency analysis enabled
- ✅ Impact analysis for API changes
- ✅ Regeneration workflows possible
- ⚠️ Requires keeping `generatedFrom` in sync with actual sources
- ⚠️ Additional registry indexing needed

---

## Requirements Catalog

### Lifecycle Requirements

#### REQ-042: Lifecycle Hook Execution Semantics

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
Define execution semantics for lifecycle hooks including failure handling, mandatory execution, and containment behavior.

**Rationale:**
Hooks enhance capabilities without breaking them. Platform must handle hook failures gracefully while maintaining observability.

**Acceptance Criteria:**

- [ ] `mandatory: true` hooks execute even after previous hook failures
- [ ] `contained: true` hooks are wrapped in platform try-catch
- [ ] `main` phase failures propagate to capability caller
- [ ] `before`/`after`/`error` phase failures are caught and logged
- [ ] All hook failures emit telemetry event automatically
- [ ] Hook execution order is preserved within each phase
- [ ] Telemetry includes: hook name, phase, capability, MFE, error details

**Dependencies:** REQ-041 (Emit Capability), REQ-033 (Lifecycle Hooks)

**Technical Notes:**

```typescript
// Platform hook execution pattern
async function executeHook(hook: Hook, context: Context): Promise<void> {
  try {
    await hook.handler(context);
  } catch (error) {
    // Always emit telemetry on failure
    await emit({
      eventType: 'error',
      eventData: {
        source: 'lifecycle-hook',
        hook: hook.name,
        phase: context.phase,
        capability: context.capability,
        mfe: context.mfeName,
        error: { message: error.message, stack: error.stack },
      },
      severity: 'warn',
      tags: ['lifecycle', 'hook-failure'],
    });

    // Only propagate if main phase
    if (context.phase === 'main') {
      throw error;
    }
    // Otherwise silently continue
  }
}
```

---

#### REQ-043: Automatic Telemetry on Hook Failure

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
Platform automatically emits telemetry event when any lifecycle hook throws or fails, regardless of phase or mandatory/contained flags.

**Rationale:**
Ensures complete observability of system behavior. Silent failures are logged for debugging without breaking execution flow.

**Acceptance Criteria:**

- [ ] Every hook failure emits telemetry event
- [ ] Telemetry uses `emit` platform capability
- [ ] Event includes: hook name, phase, capability, MFE name, error details
- [ ] Severity is `warn` for lifecycle hooks, `error` for main phase
- [ ] Tags include `lifecycle` and `hook-failure` for filtering
- [ ] If `emit` itself fails, fallback to console.error locally
- [ ] Telemetry emission is contained (can't cause additional failures)

**Dependencies:** REQ-041 (Emit Capability), REQ-042 (Hook Execution Semantics)

**Technical Notes:**

- Telemetry emission must be contained to prevent infinite loops
- Local fallback ensures visibility even if telemetry backend is down
- Event schema should be consistent for aggregation/alerting

---

#### REQ-044: Standard Lifecycle Phases Only

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
DSL supports only 4 standard lifecycle phases: `before`, `main`, `after`, `error`. No custom phases. MFE teams extend standard phases with their own hooks.

**Rationale:**
Simplifies mental model, ensures all hooks follow same execution semantics, eliminates phase ordering ambiguity.

**Acceptance Criteria:**

- [ ] DSL schema rejects `custom:` section in lifecycle
- [ ] Only `before`, `main`, `after`, `error` phases are valid
- [ ] MFE teams can add any number of hooks to standard phases
- [ ] Declaration order = execution order within each phase
- [ ] Code generator templates use standard phases only
- [ ] Validation warns if `custom:` section detected (migration help)

**Dependencies:** REQ-042 (Hook Execution Semantics)

**Technical Notes:**

- Migration: Move hooks from `custom.validation` to `before`, from `custom.processing` to `main`
- DSL v3.0 removes `custom:` section entirely

---

#### REQ-045: Handler Array Support

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
The `handler` field can be a single string OR an array of strings, allowing multiple handlers per hook with phase-specific execution semantics.

**Rationale:**
Provides flexibility to group related operations, reduces hook count, maintains clear AND/OR semantics.

**Acceptance Criteria:**

- [ ] `handler: singleFunction` is valid (string)
- [ ] `handler: [fn1, fn2, fn3]` is valid (array)
- [ ] Handlers execute sequentially within the hook
- [ ] **main phase**: AND semantics - all must succeed, first failure stops
- [ ] **before/after/error phases**: OR-like - all run, failures don't stop chain
- [ ] Each handler failure emits telemetry (per REQ-043)
- [ ] Schema validation accepts both string and array types

**Dependencies:** REQ-042 (Hook Execution Semantics), REQ-043 (Telemetry)

**Technical Notes:**

```typescript
// Handler execution based on phase
async function executeHandlers(
  handlers: string | string[],
  phase: Phase,
  context: Context
): Promise<void> {
  const handlerList = Array.isArray(handlers) ? handlers : [handlers];

  for (const handler of handlerList) {
    try {
      await invokeHandler(handler, context);
    } catch (error) {
      await emitHookFailure(handler, phase, error);

      // main phase: AND semantics - stop on first failure
      if (phase === 'main') {
        throw error;
      }
      // other phases: OR-like - continue to next handler
    }
  }
}
```

---

#### REQ-046: Handler Discovery and Validation

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
Define how handler strings in DSL are discovered, validated, and invoked at runtime across different programming languages.

**Rationale:**
DSL is a conformance contract. MFEs present themselves as conforming to the base class contract while managing their own implementation internally. Handler discovery must be fail-fast for critical handlers while supporting multiple languages idiomatically.

**Acceptance Criteria:**

- [ ] **Capability handlers** validated at MFE startup (fail fast)
- [ ] **Lifecycle handlers** validated on first capability invocation (deferred)
- [ ] Handler-not-found emits telemetry event with handler name, MFE, capability
- [ ] Startup validation failure prevents MFE registration
- [ ] Deferred validation failure fails the capability call
- [ ] DSL handler names are language-neutral format
- [ ] Code generators map neutral names to language conventions:
  - JavaScript/TypeScript: `camelCase`
  - Python: `snake_case`
  - Go: `PascalCase`
- [ ] Platform runtime uses language-appropriate reflection/introspection
- [ ] Handler signature validation (correct parameters, return type)

**Dependencies:** REQ-042 (Hook Execution Semantics), REQ-043 (Telemetry)

**Technical Notes:**

```typescript
// Handler discovery at startup (JavaScript)
function validateCapabilityHandlers(mfe: BaseMFE, dsl: DSL): void {
  for (const capability of dsl.capabilities) {
    const handlerName = capability.handler;
    if (typeof mfe[handlerName] !== 'function') {
      emit({
        eventType: 'error',
        eventData: {
          source: 'handler-discovery',
          handler: handlerName,
          capability: capability.name,
          mfe: dsl.name,
          error: { message: `Handler not found: ${handlerName}` },
        },
        severity: 'error',
        tags: ['startup', 'handler-missing'],
      });
      throw new Error(
        `MFE ${dsl.name}: Missing handler "${handlerName}" for capability "${capability.name}"`
      );
    }
  }
}

// Naming convention mapping (code generator)
function mapHandlerName(neutralName: string, language: string): string {
  switch (language) {
    case 'python':
      return toSnakeCase(neutralName); // initializeRuntime → initialize_runtime
    case 'go':
      return toPascalCase(neutralName); // initializeRuntime → InitializeRuntime
    default: // javascript, typescript
      return toCamelCase(neutralName); // already camelCase
  }
}
```

---

### Type System Requirements

#### REQ-047: Unified Type System

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
Define a unified type system that flows from DSL → GraphQL → TypeScript/Python/Go with consistent nullability, compile-time validation, and extensibility for custom types.

**Rationale:**
DSL types are the source of truth. They map deterministically to GraphQL schema types, language-specific types, and runtime validation. Failing builds are preferable to runtime defensive coding.

**Acceptance Criteria:**

**Nullability (GraphQL convention):**

- [ ] Types are nullable by default (`string` = nullable)
- [ ] `!` suffix marks required/non-null (`string!` = required)
- [ ] Nullability maps consistently: DSL → GraphQL → TypeScript/Python
- [ ] `string` → `String` (GraphQL) → `string | null` (TS) → `Optional[str]` (Python)
- [ ] `string!` → `String!` (GraphQL) → `string` (TS) → `str` (Python)

**Validation (compile-time heavy, hybrid):**

- [ ] Code generators produce validation code from DSL constraints
- [ ] Build fails if types/constraints are invalid in DSL
- [ ] Generated code includes type guards and assertions
- [ ] Runtime validation is optional double-check, not primary defense
- [ ] Constraint violations at build time > runtime errors

**Type Categories:**

- [ ] **Primitives**: `string`, `number`, `boolean`, `object`, `array`
- [ ] **Collections**: `array<T>`, `array<T!>` (non-null items)
- [ ] **Enums**: `type: enum` with `values: [...]`
- [ ] **Unions**: `A | B` syntax for alternative types
- [ ] **Specialized** (platform): `jwt`, `datetime`, `email`, `url`, `id`, `file`, `element`
- [ ] **Custom** (team-defined): Extend primitives with validation rules

**Extensibility:**

- [ ] MFE teams can define custom specialized types
- [ ] Custom types specify: base type, validation rules, metadata
- [ ] Custom types registered in DSL `types:` section
- [ ] Code generators produce validators for custom types
- [ ] Custom types inherit base type's GraphQL/language mappings

**Constraints:**

- [ ] `string`: `minLength`, `maxLength`, `pattern` (regex)
- [ ] `number`: `min`, `max`, `integer` (boolean)
- [ ] `array`: `minItems`, `maxItems`, `itemConstraints`
- [ ] `enum`: `values` (required), `default` (optional)
- [ ] `file`: `formats`, `maxSize`
- [ ] Constraints generate compile-time validation code

**Dependencies:** REQ-046 (Handler Discovery)

**Technical Notes:**

```yaml
# DSL type definitions
inputs:
  - name: username
    type: string!
    constraints:
      minLength: 3
      maxLength: 50
      pattern: '^[a-zA-Z0-9_]+$'

  - name: severity
    type: enum
    values: [debug, info, warn, error, fatal]
    default: info

  - name: result
    type: AnalysisResult | ErrorResult # union

# Custom type definition
types:
  - PhoneNumber:
      extends: string
      constraints:
        pattern: "^\\+[1-9]\\d{1,14}$"
      metadata:
        format: E.164
        owner: platform-team
```

```typescript
// Generated TypeScript validation
function validateUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('username must be a string');
  }
  if (value.length < 3) {
    throw new RangeError('username must be at least 3 characters');
  }
  if (value.length > 50) {
    throw new RangeError('username must be at most 50 characters');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error('username must match pattern ^[a-zA-Z0-9_]+$');
  }
  return value;
}

// Generated GraphQL schema
type Query {
  getUser(username: String!): User
}

enum Severity {
  DEBUG
  INFO
  WARN
  ERROR
  FATAL
}
```

---

#### REQ-049: Data Type Metadata

**Priority:** P1 (High)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
Define how type metadata (`owner`, `tags`) is used for documentation, tooling, and future access control.

**Rationale:**
Type metadata enables registry search, team attribution, and lays groundwork for future access control. Custom tags provide flexibility for diverse team needs.

**Acceptance Criteria:**

**Owner field:**

- [ ] `owner` is optional string field on type definitions
- [ ] Owner value included in generated code comments
- [ ] Owner indexed in registry for search/filtering
- [ ] Owner displayed in tooling/documentation views
- [ ] Future: Owner used for access control decisions

**Tags field:**

- [ ] `tags` is optional array of strings
- [ ] Tags are custom (team-defined vocabulary)
- [ ] No platform-enforced tag semantics
- [ ] Tags indexed in registry for search/filtering
- [ ] Tags included in generated code annotations

**Registry integration:**

- [ ] Types searchable by owner in registry
- [ ] Types searchable by tags in registry
- [ ] Metadata available via registry GraphQL API
- [ ] Orchestration service indexes metadata on registration

**Code generation:**

- [ ] Owner added as comment in generated type definitions
- [ ] Tags added as annotations/decorators where supported

**Dependencies:** REQ-047 (Unified Type System)

**Technical Notes:**

```yaml
# DSL definition
types:
  - CustomerRecord:
      owner: customer-team
      tags: [pii, gdpr-relevant, cached]
      fields:
        - name: id
          type: id!
        - name: email
          type: email!
        - name: createdAt
          type: datetime!
```

```typescript
// Generated TypeScript
/**
 * CustomerRecord
 * @owner customer-team
 * @tags pii, gdpr-relevant, cached
 */
interface CustomerRecord {
  id: string;
  email: string;
  createdAt: string;
}
```

```graphql
# Registry query
query {
  searchTypes(tags: ["pii"]) {
    name
    owner
    mfe
    tags
  }
}
```

---

#### REQ-052: Language Field and Template Mapping

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
Define how the `language` field drives template selection, build tooling, and runtime behavior.

**Rationale:**
Language field is the primary driver for code generation pipeline. V1 focuses on JavaScript/TypeScript with Module Federation. Non-JS languages are future backend-only services.

**Acceptance Criteria:**

**V1 Language Support:**

- [ ] `javascript` and `typescript` are only valid V1 values
- [ ] Invalid language values fail DSL validation at build time
- [ ] Language field is required in DSL

**Template Selection:**

- [ ] Language maps to template folder: `src/templates/{language}/`
- [ ] Template folders: `react/shell/`, `react/remote/` for JS/TS
- [ ] Future: `python/service/`, `go/service/` for backend services

**Build Tooling:**

- [ ] JS/TS uses rspack for bundling
- [ ] JS/TS generates `rspack.config.js` with Module Federation
- [ ] Future: Python uses appropriate build (pip, poetry)
- [ ] Future: Go uses go build

**Runtime Behavior:**

- [ ] JS/TS MFEs are browser-loadable via `remoteEntry.js`
- [ ] JS/TS MFEs use Module Federation for composition
- [ ] Non-JS backends (future) are data-only services
- [ ] Non-JS consumed by JS shell via REST/GraphQL API

**Dependencies:** REQ-047 (Unified Type System), DEC-019 (Handler Naming)

**Technical Notes:**

```yaml
# DSL
name: csv-analyzer
language: typescript
type: tool

# Code generator logic
if (dsl.language === 'javascript' || dsl.language === 'typescript') {
  templatePath = 'src/templates/react/remote/';
  buildConfig = generateRspackConfig(dsl);
  runtime = 'module-federation';
} else {
  // Future
  templatePath = `src/templates/${dsl.language}/service/`;
  buildConfig = generateServiceBuildConfig(dsl);
  runtime = 'api-only';
}
```

---

#### REQ-053: GeneratedFrom Traceability

**Priority:** P1 (High)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**
Define how `generatedFrom` captures data lineage and enables dependency analysis across MFEs.

**Rationale:**
Understanding which MFEs share data sources enables impact analysis, dependency graphs, and regeneration workflows. Treating this as machine-readable metadata (not just comments) enables tooling automation.

**Acceptance Criteria:**

**DSL Structure:**

- [ ] `generatedFrom` is optional array in `data:` section
- [ ] Each entry specifies source type: `openapi`, `graphql`, `asyncapi`, etc.
- [ ] Each entry includes `service` name (SOR identifier)
- [ ] Optional `baseUrl` for runtime connection
- [ ] Optional `version` for spec versioning

**Registry Indexing:**

- [ ] `generatedFrom` entries indexed in registry
- [ ] Searchable by service name
- [ ] Searchable by spec type (openapi, graphql)
- [ ] Searchable by spec file path

**Dependency Analysis:**

- [ ] Query: "Which MFEs use this API/service?"
- [ ] Query: "Which MFEs share data sources with this MFE?"
- [ ] Impact analysis: "If this API changes, which MFEs are affected?"
- [ ] Dependency graph generation from registry data

**Regeneration Support:**

- [ ] Source spec path enables re-running code generation
- [ ] Version tracking for detecting spec drift
- [ ] Tooling can compare current vs generated-from version

**Dependencies:** REQ-049 (Data Type Metadata)

**Technical Notes:**

```yaml
# DSL definition
data:
  generatedFrom:
    - openapi: ./specs/analysis-api.yaml
      service: analysis-api
      baseUrl: http://analysis-api:8080
      version: 2.1.0
    - graphql: ./specs/user-schema.graphql
      service: user-service
      version: 1.5.0
```

```graphql
# Registry queries
query findMFEsByService($service: String!) {
  searchMFEs(generatedFrom: { service: $service }) {
    name
    version
    owner
    generatedFrom {
      type
      service
      specPath
      version
    }
  }
}

query findSharedDependencies($mfeName: String!) {
  mfe(name: $mfeName) {
    generatedFrom {
      service
      relatedMFEs {
        name
        owner
      }
    }
  }
}
```

---

## Migration & Deprecation Notes

- Removed: `custom:` lifecycle phase, deprecated CLI flags, legacy template folders (`src/templates/react/`, `src/templates/api/`, `src/templates/bff/`).
- Deferred: Authorization grammar, advanced dependency semantics (see deferred-backlog.md).
- All requirements REQ-042 to REQ-058 are now complete and reflected in the DSL schema and platform contract.
- BACKLOG.md is archived; GitHub Issues are the single source of truth for backlog tracking.

## Requirements Summary

### P0 (Critical) - Must Have for V1

| ID          | Requirement                                    | Status      |
| ----------- | ---------------------------------------------- | ----------- |
| REQ-042     | Lifecycle Hook Execution Semantics             | ✅ Accepted |
| REQ-043     | Automatic Telemetry on Hook Failure            | ✅ Accepted |
| REQ-044     | Standard Lifecycle Phases Only                 | ✅ Accepted |
| REQ-045     | Handler Array Support                          | ✅ Accepted |
| REQ-046     | Handler Discovery and Validation               | ✅ Accepted |
| REQ-047     | Unified Type System                            | ✅ Accepted |
| REQ-048     | Authorization Expression Syntax                | 🔶 Deferred |
| REQ-052     | Language Field and Template Mapping            | ✅ Accepted |
| **REQ-054** | **BaseMFE Abstract Class Contract**            | ✅ Accepted |
| **REQ-055** | **Context Object Contract**                    | ✅ Accepted |
| **REQ-056** | **Lifecycle State Machine**                    | ✅ Accepted |
| **REQ-057** | **Boilerplate Generation w/ Custom Lifecycle** | ✅ Accepted |
| **REQ-058** | **Standard Platform Handler Library**          | ✅ Accepted |
| **REQ-059** | **Language-Based Code Generation (Not Type)**  | ✅ Accepted |

### P1 (High) - Should Have for V1

| ID      | Requirement                      | Status      |
| ------- | -------------------------------- | ----------- |
| REQ-049 | Data Type Metadata (owner, tags) | ✅ Accepted |
| REQ-050 | Dependency Version Semantics     | 🔶 Deferred |
| REQ-053 | GeneratedFrom Traceability       | ✅ Accepted |

### P2 (Medium) - V2+

| ID      | Requirement                  | Status     |
| ------- | ---------------------------- | ---------- |
| REQ-051 | GraphQL Subscription Support | ⏳ Pending |

---

## Cross-References

### Related ADRs (to be created)

- ADR-036: Lifecycle Hook Execution Model (DEC-016)
- ADR-037: No Custom Lifecycle Phases (DEC-017)
- ADR-038: Handler Array Support (DEC-018)
- ADR-039: Handler Discovery Convention (DEC-019) ← resolved
- ADR-040: Unified Type System (DEC-020) ← resolved
- ADR-041: Authorization Expression Grammar (deferred)
- ADR-042: Data Type Metadata (DEC-021) ← resolved
- ADR-043: Language Field and Template Selection (DEC-022) ← resolved
- ADR-044: Data Lifecycle Alignment (DEC-023) ← resolved
- ADR-045: GeneratedFrom Traceability (DEC-024) ← resolved

### Related Requirements in Other Documents

- [orchestration-requirements.md](./orchestration-requirements.md)
  - REQ-026: Standard Capabilities Listed in DSL
  - REQ-033: Standardized Extensible Lifecycle Hooks
  - REQ-041: Emit Platform Capability
- [graphql-codegen-requirements.md](./graphql-codegen-requirements.md)
  - GraphQL schema generation patterns
  - Data layer lifecycle hooks

---

## Next Steps

1. ✅ Created DSL contract requirements document
2. ✅ Captured DEC-016, DEC-017, DEC-018
3. ✅ Captured REQ-042, REQ-043, REQ-044, REQ-045
4. ✅ Updated dsl.yaml - removed `custom:` section, added handler array examples
5. ⏳ Continue Q&A for Questions 3-10
6. ⏳ Add corresponding ADRs to architecture-decisions.md
7. ⏳ Update SESSION-RESUME-CHECKLIST.md with Session 6 progress

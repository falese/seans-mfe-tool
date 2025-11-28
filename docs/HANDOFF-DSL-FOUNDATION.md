# DSL Foundation Implementation Handoff

**Date:** 2025-11-28  
**Session:** Requirements Elicitation #7  
**Prepared By:** Requirements Elicitation Agent  
**For:** Implementation Agent

---

## Executive Summary

This handoff document captures architectural decisions from Requirements Elicitation Session #7 that clarify the DSL Foundation implementation approach. Three new requirements (REQ-057, REQ-058, REQ-059) have been added to `docs/dsl-contract-requirements.md` based on critical architectural clarifications.

**Strategic Context:**

- **DSL Foundation must complete BEFORE Orchestration** - User decision: "everything is an MFE," DSL informs orchestration
- **GitHub Issues #22 (Lifecycle Hooks) and #24 (Type System) are implementation-ready**
- **Implementation Priority:** Complete DSL contract → Generate boilerplate → Test with examples → Orchestration

---

## Critical Architectural Clarifications

### 1. DSL as Implementation Guide (Not Runtime Contract)

**Previous Misunderstanding:** DSL was runtime contract for reflection/dynamic method lookup

**Clarification:**

- DSL is **code generation blueprint** - describes WHAT to generate, not WHAT is exposed at runtime
- Handlers listed in DSL → inform code generation → create methods in generated class
- No runtime reflection of DSL structure required
- DSL can be discarded after code generation (kept for documentation)

**Impact:**

- Handler discovery = code generation problem, not runtime reflection
- Generator reads DSL → creates abstract methods in BaseMFE → developer implements
- Platform handlers pre-exist in standard library, referenced during generation

---

### 2. BaseMFE: Abstract Base, Not Type Hierarchy

**Previous Misunderstanding:** Different BaseMFE classes per MFE type (RemoteMFE, BffMFE, ToolMFE)

**Clarification:**

- **One BaseMFE per language** (TypeScript, JavaScript, Python)
- BaseMFE is abstract with 9 platform capabilities as abstract methods
- MFE `type` (remote/bff/tool) determines generated code CONTENT in capability implementations
- Developer implements `doLoad()`, `doRender()`, etc. with type-specific logic

**Pattern:**

```typescript
// GENERATED: Universal for all types
abstract class BaseMFE {
  async load(ctx: Context): Promise<LoadResult> {
    // Platform orchestration wrapper
    await executeLifecycle('load', 'before', ctx);
    const result = await this.doLoad(ctx); // ← Developer implements
    await executeLifecycle('load', 'after', ctx);
    return result;
  }

  protected abstract doLoad(ctx: Context): Promise<LoadResult>;
  // ... 8 more abstract capability methods
}

// DEVELOPER CODE: Type-specific implementation
class MyRemoteMFE extends BaseMFE {
  protected async doLoad(ctx: Context): Promise<LoadResult> {
    // Module Federation logic (because type: 'remote')
    const container = await import(this.manifest.remoteEntry);
    await container.init(__webpack_share_scopes__.default);
    return { status: 'loaded', container };
  }
}

class MyBffMFE extends BaseMFE {
  protected async doLoad(ctx: Context): Promise<LoadResult> {
    // GraphQL Mesh logic (because type: 'bff')
    const mesh = await getMesh(this.extractMeshConfig());
    return { status: 'loaded', mesh };
  }
}
```

**Key Insight:** Same base class, different capability implementations

---

### 3. Handler Resolution: Platform vs Custom

**Previous Misunderstanding:** All handlers discovered via reflection or DSL introspection

**Clarification:**

**Platform Handlers (`platform.handlerName`):**

- Pre-implemented in `src/runtime/handlers/` directory
- Standard library: `platform.verifyJWT`, `platform.checkCORS`, `platform.rateLimit`
- Available to all MFEs without implementation
- Code generator validates existence at generation time

**Custom Handlers (`custom.handlerName` or just `handlerName`):**

- Developer implements as private/protected methods in their MFE class
- Referenced in DSL, generator creates method stub with TODO comment
- Runtime error if custom handler not implemented

**Resolution Order:**

1. `platform.` prefix → Look in platform handlers, throw at generation if not found
2. `custom.` prefix or no prefix → Look in developer class, throw at runtime if not found

**Example DSL:**

```yaml
capabilities:
  - load:
      lifecycle:
        before:
          - auth:
              handler: platform.verifyJWT # Pre-implemented
          - validation:
              handler: custom.checkFileSize # Developer implements
```

**Generated Code:**

```typescript
// Platform provides
import { verifyJWT } from '@mfe-platform/handlers/auth';

class MyMFE extends BaseMFE {
  // Generator creates stub for custom handler
  private async checkFileSize(context: Context): Promise<void> {
    // TODO: Implement custom validation
    throw new Error('checkFileSize not implemented');
  }
}
```

---

### 4. Language-Based Templates (Not Type-Based)

**Previous Misunderstanding:** Templates organized by MFE type (`templates/remote/`, `templates/bff/`)

**Clarification:**

**Template Organization:**

```
src/templates/
├── typescript/          # All TS MFEs (any type)
│   ├── base-mfe.ts.ejs
│   ├── capability-impl.ts.ejs  # Type-conditional logic
│   └── package.json.ejs
├── javascript/          # All JS MFEs (any type)
└── python/              # All Python MFEs (future)
```

**Type-Specific Logic in Templates:**

```typescript
// templates/typescript/capability-impl.ts.ejs
protected async doLoad(context: Context): Promise<LoadResult> {
<% if (type === 'remote') { %>
  // Module Federation implementation
  const container = await import(this.manifest.remoteEntry);
  // ...
<% } else if (type === 'bff') { %>
  // GraphQL Mesh implementation
  const mesh = await getMesh(meshConfig);
  // ...
<% } else if (type === 'tool') { %>
  // Web Worker implementation
  const worker = new Worker(workerUrl);
  // ...
<% } %>
}
```

**Rationale:**

- Type is declaration of intent, not structural difference
- Keeps templates DRY (one BaseMFE per language)
- Enables flexible type mixing (one MFE can implement multiple type patterns)
- Changing type = regenerate capability logic only, not entire structure

---

### 5. Lifecycle Hook Orchestration

**Clarification:**

**Platform Responsibility (Generated Boilerplate):**

- Wrapper methods for all 9 capabilities
- Execute lifecycle phases: `before hooks → doCapability() → after/error hooks`
- Handle state transitions, telemetry, error containment
- Implement `mandatory` and `contained` semantics

**Developer Responsibility (Custom Implementation):**

- Implement abstract `doCapability()` methods with business logic
- Implement custom lifecycle handlers referenced in DSL
- No need to understand lifecycle orchestration internals

**Example Flow:**

```typescript
// PLATFORM GENERATED
async load(context: Context): Promise<LoadResult> {
  this.assertState('ready');
  this.transitionState('loading');

  try {
    // Execute before hooks
    await this.executeLifecycle('load', 'before', context);

    // Call developer implementation
    const result = await this.doLoad(context);

    // Execute after hooks
    await this.executeLifecycle('load', 'after', context);

    this.transitionState('ready');
    return result;
  } catch (error) {
    // Execute error hooks
    await this.executeLifecycle('load', 'error', { ...context, error });
    this.transitionState('error');
    throw error;
  }
}

// DEVELOPER IMPLEMENTS
protected abstract doLoad(context: Context): Promise<LoadResult>;
```

---

## New Requirements Summary

### REQ-057: Boilerplate Capability Generation with Custom Lifecycle Hooks

**Priority:** P0 (Critical)  
**Status:** ✅ Accepted (Session: 2025-11-28)

**Key Points:**

- Platform generates wrapper methods that orchestrate lifecycle phases
- Developer implements abstract `doCapability()` methods with business logic
- Custom lifecycle handlers implemented as class methods
- Platform handlers resolved from standard library
- Code generation creates boilerplate in `src/runtime/base-mfe.{ts,js}`

**Implementation Notes:**

- Templates: `src/templates/{language}/base-mfe.{ts,js}.ejs`
- Generator resolves handlers during code generation, not at runtime
- Missing platform handlers → generation error
- Missing custom handlers → runtime error with clear message

---

### REQ-058: Standard Platform Handler Library

**Priority:** P0 (Critical)  
**Status:** ✅ Accepted (Session: 2025-11-28)

**Key Points:**

- Platform provides reusable handlers: auth, validation, telemetry, caching
- Developers reference with `platform.handlerName` syntax
- Handlers implemented in `src/runtime/handlers/` directory
- Organized by category: `auth/`, `validation/`, `telemetry/`, `caching/`

**V1 Standard Handlers:**

**Authentication & Authorization:**

- `platform.verifyJWT` - JWT validation and parsing
- `platform.checkCORS` - CORS header validation
- `platform.extractUser` - User context from JWT

**Validation:**

- `platform.validateSchema` - JSON schema validation
- `platform.checkRequired` - Required field validation
- `platform.sanitizeInput` - XSS/injection sanitization

**Telemetry & Logging:**

- `platform.recordMetrics` - Metrics emission
- `platform.logRequest` / `platform.logResponse` - Request/response logging
- `platform.startTrace` / `platform.endTrace` - Distributed tracing

**Performance:**

- `platform.rateLimit` - Token bucket rate limiting
- `platform.cacheCheck` / `platform.cacheWrite` - Cache operations

**Implementation Notes:**

- Each handler: standard signature `async (context: Context) => Promise<void>`
- Organized exports: `export * as auth from './auth'`
- Code generator validates platform handler existence at generation time

---

### REQ-059: Language-Based Code Generation (Not Type-Based)

**Priority:** P0 (Critical)  
**Status:** ✅ Accepted (Session: 2025-11-28)

**Key Points:**

- Templates organized by language: `typescript/`, `javascript/`, `python/`
- NOT organized by type: ~~`remote/`, `bff/`, `tool/`~~
- MFE `type` affects generated code CONTENT via conditional logic
- One BaseMFE per language works for all types

**Template Structure:**

```
src/templates/
├── typescript/
│   ├── base-mfe.ts.ejs           # Universal base
│   ├── capability-impl.ts.ejs    # Type-conditional
│   └── package.json.ejs
└── javascript/
    └── ... (same pattern)
```

**Type-Conditional Generation:**

- `type: 'remote'` → Module Federation logic in `doLoad()`
- `type: 'bff'` → GraphQL Mesh logic in `doLoad()`
- `type: 'tool'` → Web Worker logic in `doLoad()`
- `type: 'agent'` → Agentic runtime logic in `doLoad()`

**Key Insight:** Type changes affect capability implementation, not base structure

---

## Implementation Priorities

### Phase 1: Foundation (Issues #22, #24)

**Issue #22: Lifecycle Hook Execution**

- Create `src/runtime/base-mfe.ts` with abstract class
- Implement `executeLifecycle(capability, phase, context)` method
- Support `mandatory`, `contained` flags per REQ-042
- Handle array handlers per REQ-045
- Emit telemetry on hook failures per REQ-043
- Tests: `src/dsl/__tests__/lifecycle-executor.test.ts`

**Issue #24: Type System Implementation**

- Implement Zod-based type parser/validator
- GraphQL nullability conventions: `string` = nullable, `string!` = required
- Support specialized types: `jwt`, `datetime`, `email`, `url`, `id`, `file`, `element`
- Generate validation code from DSL constraints
- Tests: `src/dsl/__tests__/type-system.test.ts`

**Dependencies:**

- REQ-054 (BaseMFE Abstract Class)
- REQ-055 (Context Object)
- REQ-056 (Lifecycle State Machine)

---

### Phase 2: Code Generation (New Work)

**REQ-057 Implementation:**

- Create `src/codegen/MFEGenerator/` directory
- Implement boilerplate generator reading DSL
- Generate BaseMFE wrapper methods with lifecycle orchestration
- Generate abstract `doCapability()` method stubs
- Generate custom lifecycle handler stubs with TODO comments
- Tests: `src/codegen/MFEGenerator/__tests__/boilerplate-generator.test.ts`

**REQ-058 Implementation:**

- Create `src/runtime/handlers/` directory structure
- Implement V1 platform handlers (auth, validation, telemetry, caching)
- Export handlers with consistent signature
- Document handler usage in `docs/platform-handlers.md`
- Tests: `src/runtime/handlers/__tests__/*.test.ts`

**REQ-059 Implementation:**

- Restructure `src/templates/` by language (not type)
- Create `typescript/`, `javascript/` template directories
- Implement type-conditional logic in capability templates
- Update `src/commands/create-remote.js` to use language-based templates
- Tests: `src/commands/__tests__/language-template-selection.test.js`

---

### Phase 3: Integration & Validation

**End-to-End Flow:**

1. Write DSL manifest: `mfe-manifest.yaml`
2. Run: `mfe remote my-mfe --language typescript --type remote`
3. Generator reads DSL, creates project with:
   - BaseMFE with lifecycle orchestration
   - Abstract `doLoad()`, `doRender()`, etc.
   - Custom handler stubs
   - Type-specific boilerplate (Module Federation for 'remote')
4. Developer implements abstract methods
5. MFE runs with full lifecycle support

**Validation Tests:**

- Generate remote MFE, verify Module Federation boilerplate
- Generate bff MFE, verify GraphQL Mesh boilerplate
- Generate tool MFE, verify Web Worker boilerplate
- Test custom handler invocation
- Test platform handler invocation
- Test lifecycle phase execution

---

## Traceability Map

| GitHub Issue | Requirements           | ADRs                      | Status         |
| ------------ | ---------------------- | ------------------------- | -------------- |
| #22          | REQ-042, 043, 044, 045 | ADR-036, 037, 038         | 🟡 In Progress |
| #24          | REQ-047                | ADR-040                   | 🟡 In Progress |
| (TBD)        | REQ-057                | (TBD: Code Gen Model)     | 📋 Planned     |
| (TBD)        | REQ-058                | (TBD: Platform Handlers)  | 📋 Planned     |
| (TBD)        | REQ-059                | (TBD: Template Structure) | 📋 Planned     |

**New Issues to Create:**

1. "Boilerplate Capability Generation (REQ-057)"
   - Labels: `priority-high`, `component-codegen`, `type-feature`, `req-dsl`
2. "Platform Handler Library (REQ-058)"
   - Labels: `priority-high`, `component-orchestration`, `type-feature`, `req-dsl`
3. "Language-Based Template Restructure (REQ-059)"
   - Labels: `priority-medium`, `component-templates`, `type-refactor`, `req-dsl`

---

## ADRs to Create

### ADR-046: DSL as Code Generation Blueprint

**Context:** DSL describes implementation plan, not runtime contract  
**Decision:** DSL is consumed during code generation, not required at runtime  
**Consequences:** Simpler runtime, no reflection needed, clearer separation of concerns

### ADR-047: BaseMFE Abstract Base (Not Type Hierarchy)

**Context:** MFE type affects capability implementations, not structure  
**Decision:** One BaseMFE per language, type determines generated code content  
**Consequences:** DRY templates, flexible type mixing, easier maintenance

### ADR-048: Platform vs Custom Handler Resolution

**Context:** Need standard handlers + custom logic without naming conflicts  
**Decision:** `platform.` prefix for standard library, `custom.` for developer code  
**Consequences:** Clear ownership, compile-time validation, extensible without collisions

### ADR-049: Language-Based Template Organization

**Context:** MFE type is declaration, not structural difference  
**Decision:** Templates organized by language, type affects conditional logic  
**Consequences:** Single BaseMFE per language, type changes don't require new templates

---

## Files Modified

1. **docs/dsl-contract-requirements.md**

   - Added REQ-057: Boilerplate Generation
   - Added REQ-058: Platform Handlers
   - Added REQ-059: Language-Based Templates
   - Updated requirements summary table

2. **GitHub Issues #22, #24** (pending updates)
   - Need to comment with new requirements links
   - Update acceptance criteria if needed

---

## Next Steps for Implementation Agent

### Immediate Actions

1. **Review Documentation:**

   - Read this handoff document fully
   - Review `docs/dsl-contract-requirements.md` REQ-054 through REQ-059
   - Review existing DSL infrastructure: `src/dsl/schema.ts`, `parser.ts`, `validator.ts`

2. **Start with Issue #22 (Lifecycle Hooks):**

   - Create `src/runtime/base-mfe.ts` with abstract BaseMFE class
   - Implement `executeLifecycle()` method
   - Write tests: `src/dsl/__tests__/lifecycle-executor.test.ts`
   - Follow TDD: write tests first, implement to pass

3. **Continue with Issue #24 (Type System):**
   - Implement Zod-based type parser
   - Generate validation code from DSL
   - Write tests: `src/dsl/__tests__/type-system.test.ts`

### Follow-Up Work

4. **REQ-057: Boilerplate Generator**

   - Create `src/codegen/MFEGenerator/`
   - Generate BaseMFE wrappers and abstract methods
   - Test with example DSL manifests

5. **REQ-058: Platform Handlers**

   - Create `src/runtime/handlers/` directory
   - Implement V1 handler library
   - Document handler API

6. **REQ-059: Template Restructure**
   - Reorganize `src/templates/` by language
   - Update CLI commands to use language-based selection
   - Test with all MFE types

---

## Questions for Implementation Agent

If you encounter ambiguity during implementation:

1. **Handler resolution unclear?** → Reference REQ-058 and ADR-048 (platform vs custom)
2. **Type-specific logic placement?** → Reference REQ-059 (conditional in templates, not base class)
3. **Lifecycle orchestration details?** → Reference REQ-042, REQ-054 (BaseMFE wrapper pattern)
4. **What code is generated vs runtime?** → Reference ADR-046 (DSL as blueprint)

**Escalation:** If architectural questions arise, return to Requirements Elicitation Agent for clarification.

---

## Success Criteria

Implementation complete when:

- [ ] Issues #22 and #24 closed with passing tests
- [ ] BaseMFE abstract class implemented and tested
- [ ] Lifecycle hook execution working with `mandatory`/`contained` flags
- [ ] Type system validates DSL and generates validation code
- [ ] Platform handler library implemented (V1 handlers)
- [ ] Code generator creates boilerplate from DSL
- [ ] Templates organized by language with type-conditional logic
- [ ] End-to-end test: Generate remote, bff, tool MFEs → All run successfully
- [ ] Documentation updated: inline comments, user-facing guides
- [ ] All tests pass with 80%+ coverage

---

## References

**Requirements Documents:**

- `docs/dsl-contract-requirements.md` - Complete DSL contract specification
- `docs/orchestration-requirements.md` - Orchestration context (post-DSL)

**Code Files:**

- `src/dsl/schema.ts` - Zod schemas for DSL validation
- `src/dsl/parser.ts`, `validator.ts`, `generator.ts` - Existing DSL infrastructure

**GitHub Issues:**

- Issue #22: Lifecycle Hook Execution Implementation
- Issue #24: Unified Type System Implementation

**Architecture Decisions:**

- `docs/architecture-decisions.md` - See ADRs 036-040, pending ADRs 046-049

---

**Handoff Complete**

This document captures all architectural decisions from Requirements Elicitation Session #7. Implementation Agent has all context needed to proceed with DSL Foundation implementation.

**Priority:** DSL Foundation → Code Generation → Orchestration

**Next Session:** Implementation review and validation testing

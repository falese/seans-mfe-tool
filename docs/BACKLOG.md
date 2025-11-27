# Product Backlog — seans-mfe-tool

**Purpose:** This backlog consolidates all requirements from feature requirements documents into actionable GitHub Issues. Each item maps to specific REQ-* requirements, ADRs, and acceptance criteria for end-to-end traceability.

**Last Updated:** 2025-11-27  
**Source Documents:**

- [Orchestration Requirements](./orchestration-requirements.md)
- [GraphQL BFF Requirements](./graphql-bff-requirements.md)
- [DSL Contract Requirements](./dsl-contract-requirements.md)
- [DSL Remote Requirements](./dsl-remote-requirements.md)
- [Scaffolding Requirements](./scaffolding-requirements.md)
- [Enhancement Plan](./ENHANCEMENT-PLAN.md)

---

## Backlog Organization

### Label System

Labels follow GitHub conventions for easy filtering and tracking:

| Label Category    | Labels                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Type**          | `type: feature`, `type: bug`, `type: enhancement`, `type: refactor`, `type: docs`       |
| **Priority**      | `priority: critical`, `priority: high`, `priority: medium`, `priority: low`              |
| **Status**        | `status: planned`, `status: in-progress`, `status: blocked`, `status: needs-discussion` |
| **Component**     | `component: cli`, `component: codegen`, `component: orchestration`, `component: bff`     |
| **Requirement**   | `req: orchestration`, `req: dsl`, `req: bff`, `req: remote`, `req: scaffold`            |
| **Implementation** | `impl: typescript`, `impl: testing`, `impl: security`, `impl: deployment`                |

### Issue Template

Each backlog item follows this structure:

```markdown
## [ISSUE-NNN] Title

**Labels:** `priority: X`, `type: Y`, `component: Z`, `req: W`  
**Requirements:** REQ-XXX, REQ-YYY  
**ADRs:** ADR-NNN  
**Acceptance:** `docs/acceptance-criteria/feature.feature`  
**Epic:** [Epic Name]

### Description

[Clear problem statement]

### Requirements Mapping

- **REQ-XXX:** [Requirement description and link]
- **REQ-YYY:** [Requirement description and link]

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

### Technical Notes

[Implementation guidance, constraints, dependencies]

### Traceability

- **ADRs:** Links to architecture decisions
- **Tests:** Expected test coverage
- **Docs:** Documentation to create/update
```

---

## Epic Structure

Epics group related issues into cohesive feature sets:

### Epic 1: Core Orchestration System

**Goal:** Enable runtime MFE discovery, registration, and dynamic loading  
**Requirements:** REQ-001 through REQ-010  
**ADRs:** ADR-009, ADR-010, ADR-011, ADR-012, ADR-016, ADR-017, ADR-021  
**Status:** 🟡 In Progress

### Epic 2: GraphQL BFF Layer

**Goal:** Unified data access via GraphQL Mesh for all MFE types  
**Requirements:** REQ-BFF-001 through REQ-BFF-008  
**ADRs:** ADR-046, ADR-022, ADR-045  
**Status:** ✅ Complete

### Epic 3: DSL-First Remote Generation

**Goal:** Generate remotes from DSL manifest with capabilities-driven scaffolding  
**Requirements:** REQ-REMOTE-001 through REQ-REMOTE-010  
**ADRs:** ADR-047, ADR-048, ADR-013  
**Status:** ✅ Complete

### Epic 4: DSL Contract Implementation

**Goal:** Platform-level DSL standards (lifecycle, types, handlers, auth)  
**Requirements:** REQ-042 through REQ-053  
**ADRs:** ADR-036 through ADR-045  
**Status:** 📋 Planned

### Epic 5: Production Readiness

**Goal:** Docker/K8s deployment, security hardening, CI/CD  
**Requirements:** Enhancement Plan Phases 1-3  
**ADRs:** TBD (security, deployment)  
**Status:** 🟡 In Progress

### Epic 6: Testing & Quality

**Goal:** ≥80% coverage, scaffolded test templates, E2E validation  
**Requirements:** REQ-SCAFFOLD-001 through REQ-SCAFFOLD-006  
**ADRs:** ADR-047  
**Status:** 🟡 In Progress

---

## Backlog Items

---

### ORCHESTRATION — Core Runtime

---

#### [ISSUE-001] Orchestration Service Generation in Shell

**Labels:** `priority: critical`, `type: feature`, `component: orchestration`, `req: orchestration`  
**Requirements:** REQ-002, REQ-003  
**ADRs:** ADR-016, ADR-017  
**Epic:** Core Orchestration System

##### Description

When generating a shell via `mfe shell <name>`, include an orchestration service as a separate process (Express/Fastify) with REST API, WebSocket support, and Redis/memory registry storage.

##### Requirements Mapping

- **REQ-002:** Centralized orchestration service maintains MFE registry
- **REQ-003:** Shell runtime (browser) syncs with service via WebSocket

##### Acceptance Criteria

- [ ] `mfe shell my-app` generates `orchestration-service/` directory
- [ ] Service includes REST API: `/api/register`, `/api/discover`, `/health`
- [ ] WebSocket server broadcasts registry updates to shell runtime
- [ ] Docker Compose includes orchestration service + Redis
- [ ] Shell runtime connects to orchestration on startup

##### Technical Notes

```
my-shell/
├── src/
│   └── orchestration-runtime/     # Browser runtime
├── orchestration-service/         # Node.js service
│   ├── server.ts
│   ├── registry/
│   ├── api/
│   └── websocket/
└── docker-compose.yml
```

##### Traceability

- **ADRs:** ADR-016 (service per shell), ADR-017 (Docker-only orchestration)
- **Tests:** `src/commands/__tests__/create-shell.test.js` (extend)
- **Docs:** Update `docs/orchestration-requirements.md` implementation status

---

#### [ISSUE-002] Auto-Registration in Generated Remotes

**Labels:** `priority: critical`, `type: feature`, `component: orchestration`, `req: orchestration`  
**Requirements:** REQ-004  
**ADRs:** ADR-012  
**Epic:** Core Orchestration System

##### Description

Generated remote MFEs must include auto-registration code that registers with the orchestration service on startup, sending DSL endpoint and health check URL.

##### Requirements Mapping

- **REQ-004:** Push-based registration eliminates manual registry updates

##### Acceptance Criteria

- [ ] `mfe remote:init` generates `src/orchestration/register.ts`
- [ ] Registration executes on dev server startup
- [ ] Registration includes: name, endpoint, remoteEntry, dslEndpoint, healthCheck
- [ ] Failed registration logs warning but doesn't crash MFE
- [ ] ENV var `ORCHESTRATION_URL` configures service location

##### Technical Notes

```typescript
// Auto-generated in src/orchestration/register.ts
export async function registerMFE() {
  const registration = {
    name: process.env.MFE_NAME || '<%= name %>',
    endpoint: process.env.MFE_ENDPOINT || 'http://localhost:<%= port %>',
    remoteEntry: `${endpoint}/remoteEntry.js`,
    dslEndpoint: `${endpoint}/.well-known/mfe-manifest.yaml`,
    healthCheck: `${endpoint}/health`,
  };

  const orchestrationUrl = process.env.ORCHESTRATION_URL || 'http://localhost:3100';

  try {
    await fetch(`${orchestrationUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration),
    });
  } catch (error) {
    console.warn('Failed to register with orchestration:', error.message);
  }
}
```

##### Traceability

- **ADRs:** ADR-012 (push-based registration)
- **Tests:** `src/commands/__tests__/remote-init.test.ts` (verify file generation)
- **Docs:** `docs/acceptance-criteria/remote-mfe.feature` (add registration scenario)

---

#### [ISSUE-003] Three-Phase Discovery API

**Labels:** `priority: high`, `type: feature`, `component: orchestration`, `req: orchestration`  
**Requirements:** REQ-011  
**ADRs:** ADR-011  
**Epic:** Core Orchestration System

##### Description

Orchestration service must expose three discovery APIs: Phase A (probabilistic fetch all), Phase C (semantic search), Phase B (deterministic filters). AI agents choose the phase based on task complexity.

##### Requirements Mapping

- **REQ-011:** Three-phase discovery optimizes for different agent reasoning modes

##### Acceptance Criteria

- [ ] `GET /api/discover?phase=A` returns all DSL endpoints
- [ ] `POST /api/discover?phase=C` accepts natural language query, returns ranked results
- [ ] `POST /api/discover?phase=B` accepts filters (type, capability, tags), returns exact matches
- [ ] All phases return consistent schema: `{ mfes: [{ name, dslEndpoint, score? }] }`
- [ ] Phase C uses semantic similarity (cosine, vector embeddings)

##### Technical Notes

Phase C requires semantic search library (e.g., `@tensorflow-models/universal-sentence-encoder` or external vector DB).

##### Traceability

- **ADRs:** ADR-011 (three-phase discovery)
- **Tests:** `orchestration-service/__tests__/discovery.test.ts` (new)
- **Docs:** Update `docs/orchestration-requirements.md` with API examples

---

#### [ISSUE-004] Lightweight Registry (Metadata Only)

**Labels:** `priority: high`, `type: feature`, `component: orchestration`, `req: orchestration`  
**Requirements:** REQ-010  
**ADRs:** ADR-010  
**Epic:** Core Orchestration System

##### Description

Orchestration registry stores only metadata (name, endpoint, health status, last-seen timestamp). DSL is fetched on-demand from `/.well-known/mfe-manifest.yaml`.

##### Requirements Mapping

- **REQ-010:** Lightweight registry reduces storage and keeps data fresh

##### Acceptance Criteria

- [ ] Registry schema: `{ name, endpoint, remoteEntry, dslEndpoint, healthCheck, status, lastSeen }`
- [ ] No DSL content stored in registry
- [ ] DSL fetched on-demand when agent queries Phase A/B/C
- [ ] Cache DSL with 5-minute TTL (configurable)
- [ ] Stale MFEs (no heartbeat for 60s) marked `unhealthy`

##### Technical Notes

```typescript
// Registry storage interface
interface MFERegistration {
  name: string;
  endpoint: string;
  remoteEntry: string;
  dslEndpoint: string;
  healthCheck: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastSeen: Date;
}
```

##### Traceability

- **ADRs:** ADR-010 (lightweight registry)
- **Tests:** `orchestration-service/__tests__/registry.test.ts` (new)
- **Docs:** Update `docs/orchestration-requirements.md` schema section

---

#### [ISSUE-005] Health Check Monitoring with Circuit Breaker

**Labels:** `priority: medium`, `type: feature`, `component: orchestration`, `req: orchestration`  
**Requirements:** REQ-002 (health check sub-requirement)  
**ADRs:** N/A  
**Epic:** Core Orchestration System

##### Description

Orchestration service polls MFE `/health` endpoints every 30 seconds. After 3 consecutive failures, MFE is marked `unhealthy` and removed from discovery results. Implements circuit breaker pattern.

##### Acceptance Criteria

- [ ] Health check interval configurable (default 30s)
- [ ] Circuit breaker: 3 failures → `unhealthy`, removed from discovery
- [ ] Half-open state: After cooldown (2min), retry health check
- [ ] Successful health check resets failure count, status → `healthy`
- [ ] WebSocket broadcasts status changes to connected shells

##### Technical Notes

Use library: `opossum` (Node.js circuit breaker) or implement custom with exponential backoff.

##### Traceability

- **Tests:** `orchestration-service/__tests__/health-monitor.test.ts` (new)
- **Docs:** Add health check configuration to orchestration requirements

---

### BFF (Backend for Frontend)

---

#### [ISSUE-006] BFF Runtime Smoke Test

**Labels:** `priority: high`, `type: testing`, `component: bff`, `req: bff`  
**Requirements:** REQ-BFF-001 through REQ-BFF-004  
**ADRs:** ADR-046  
**Epic:** GraphQL BFF Layer

##### Description

Create end-to-end smoke test that scaffolds BFF, runs `bff:build` and `bff:dev`, verifies GraphQL endpoint serves queries and forwards JWT headers to upstream.

##### Requirements Mapping

- **REQ-BFF-001:** DSL data section extracts to `.meshrc.yaml`
- **REQ-BFF-004:** Single container serves BFF + static assets

##### Acceptance Criteria

- [ ] Test creates temp BFF project with sample OpenAPI spec
- [ ] `mfe bff:build` generates `.mesh/` artifacts without errors
- [ ] `mfe bff:dev` starts server on configured port
- [ ] GraphQL introspection query returns schema
- [ ] Query with `Authorization: Bearer test-jwt` includes header in upstream request
- [ ] Server serves static files from `dist/` (if applicable)

##### Technical Notes

Use `execa` to run CLI commands; `got` or `axios` for HTTP requests; cleanup temp directory after test.

##### Traceability

- **ADRs:** ADR-046 (BFF Mesh)
- **Tests:** `scripts/e2e-bff-smoke.test.js` (new)
- **Docs:** Document in `docs/graphql-bff-requirements.md` E2E section

---

#### [ISSUE-007] Multi-Source OpenAPI Merging Test

**Labels:** `priority: medium`, `type: testing`, `component: bff`, `req: bff`  
**Requirements:** REQ-BFF-002  
**ADRs:** ADR-046  
**Epic:** GraphQL BFF Layer

##### Description

Validate that BFF can merge multiple OpenAPI specs into unified GraphQL schema with prefixing to avoid conflicts.

##### Acceptance Criteria

- [ ] Scaffold BFF with 2 OpenAPI specs (users, orders)
- [ ] DSL `data.sources` includes both with `prefix` transforms
- [ ] `bff:build` generates schema with prefixed types: `User_getUserById`, `Order_getOrder`
- [ ] Introspection shows both query roots merged
- [ ] Test queries both sources via GraphQL

##### Technical Notes

Sample specs in `examples/multi-source-bff/specs/` for repeatability.

##### Traceability

- **Tests:** `src/commands/__tests__/bff-multi-source.test.js` (new)
- **Docs:** Add example to `docs/graphql-bff-requirements.md`

---

### DSL CONTRACT

---

#### [ISSUE-008] Lifecycle Hook Execution Implementation

**Labels:** `priority: critical`, `type: feature`, `component: dsl`, `req: dsl`  
**Requirements:** REQ-042, REQ-043, REQ-044, REQ-045  
**ADRs:** ADR-036, ADR-037, ADR-038  
**Epic:** DSL Contract Implementation

##### Description

Implement lifecycle hook execution engine that respects `mandatory`, `contained` flags, executes handlers in `before`/`main`/`after`/`error` phases, and emits telemetry on failures.

##### Requirements Mapping

- **REQ-042:** Hook execution semantics (mandatory, contained, phases)
- **REQ-043:** Automatic telemetry on hook failure
- **REQ-044:** Only 4 standard phases (no custom)
- **REQ-045:** Handler can be string or array

##### Acceptance Criteria

- [ ] Platform executes hooks in order: `before` → `main` → `after`/`error`
- [ ] `mandatory: true` hooks execute even if previous hooks failed
- [ ] `contained: true` hooks wrapped in try-catch
- [ ] `main` phase failures propagate to caller
- [ ] `before`/`after`/`error` failures are silent (logged + telemetry)
- [ ] Handler array support: `handler: [fn1, fn2]` executes sequentially
- [ ] `main` phase with array: AND semantics (first failure stops)
- [ ] Non-main phases with array: OR-like (all run, failures don't stop chain)

##### Technical Notes

Create base class `BaseMFE` with `executeLifecycle(capability, phase)` method.

```typescript
// Platform hook executor (simplified)
async function executeHook(hook: Hook, context: Context): Promise<void> {
  try {
    if (Array.isArray(hook.handler)) {
      for (const handlerName of hook.handler) {
        await invokeHandler(handlerName, context);
      }
    } else {
      await invokeHandler(hook.handler, context);
    }
  } catch (error) {
    // Emit telemetry
    await emit({
      eventType: 'error',
      eventData: { source: 'lifecycle-hook', hook: hook.name, error },
      severity: context.phase === 'main' ? 'error' : 'warn',
    });

    if (context.phase === 'main') throw error; // Propagate main failures
  }
}
```

##### Traceability

- **ADRs:** ADR-036 (execution model), ADR-037 (no custom phases), ADR-038 (handler arrays)
- **Tests:** `src/dsl/__tests__/lifecycle-executor.test.ts` (new)
- **Docs:** Update `docs/dsl-contract-requirements.md` implementation status

---

#### [ISSUE-009] Handler Discovery and Validation

**Labels:** `priority: critical`, `type: feature`, `component: dsl`, `req: dsl`  
**Requirements:** REQ-046  
**ADRs:** ADR-039  
**Epic:** DSL Contract Implementation

##### Description

Implement handler discovery mechanism that validates capability handlers at startup (fail-fast) and lifecycle handlers on first invocation (deferred). Maps neutral DSL names to language-specific conventions.

##### Requirements Mapping

- **REQ-046:** Handler discovery with fail-fast for capabilities, deferred for lifecycle

##### Acceptance Criteria

- [ ] Capability handlers validated at MFE startup
- [ ] Missing capability handler throws error and prevents registration
- [ ] Lifecycle handlers validated on first capability execution
- [ ] Handler-not-found emits telemetry with handler name, MFE, capability
- [ ] Code generators map DSL names to conventions:
  - JavaScript/TypeScript: `camelCase` (e.g., `initializeRuntime`)
  - Python: `snake_case` (e.g., `initialize_runtime`)
  - Go: `PascalCase` (e.g., `InitializeRuntime`)

##### Technical Notes

```typescript
// Handler discovery (TypeScript example)
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
        },
        severity: 'error',
      });
      throw new Error(`Missing handler "${handlerName}" for capability "${capability.name}"`);
    }
  }
}
```

##### Traceability

- **ADRs:** ADR-039 (handler discovery convention)
- **Tests:** `src/dsl/__tests__/handler-discovery.test.ts` (new)
- **Docs:** Update `docs/dsl-contract-requirements.md` with examples

---

#### [ISSUE-010] Unified Type System Implementation

**Labels:** `priority: high`, `type: feature`, `component: dsl`, `req: dsl`  
**Requirements:** REQ-047  
**ADRs:** ADR-040  
**Epic:** DSL Contract Implementation

##### Description

Implement unified type system that flows DSL → GraphQL → TypeScript/Python with GraphQL nullability conventions, compile-time validation, and extensibility for custom types.

##### Requirements Mapping

- **REQ-047:** Unified type system with nullability, validation, extensibility

##### Acceptance Criteria

- [ ] DSL parser validates types against schema (primitives, collections, enums, unions, specialized)
- [ ] Nullable by default: `string` = nullable, `string!` = required
- [ ] Code generators produce validation code from DSL constraints
- [ ] Build fails if types/constraints invalid in DSL
- [ ] Support specialized types: `jwt`, `datetime`, `email`, `url`, `id`, `file`, `element`
- [ ] Support custom types extending primitives with validation rules
- [ ] Type mapping consistent:
  - `string` → `String` (GraphQL) → `string | null` (TS) → `Optional[str]` (Python)
  - `string!` → `String!` → `string` → `str`

##### Technical Notes

Use Zod for runtime validation; generate GraphQL schema from DSL types.

##### Traceability

- **ADRs:** ADR-040 (unified type system)
- **Tests:** `src/dsl/__tests__/type-system.test.ts` (new)
- **Docs:** Update `docs/dsl-contract-requirements.md` type mapping table

---

#### [ISSUE-011] Authorization Expression Grammar

**Labels:** `priority: medium`, `type: feature`, `component: dsl`, `req: dsl`, `status: needs-discussion`  
**Requirements:** REQ-048 (deferred)  
**ADRs:** ADR-041 (pending)  
**Epic:** DSL Contract Implementation

##### Description

Define authorization expression grammar supporting boolean operators (AND, OR, NOT) and base atoms (user.authenticated, user.role.X, user.permission.Y, user.owns.resource).

##### Requirements Mapping

- **REQ-048:** Authorization expression syntax (deferred in Session 6)

##### Acceptance Criteria

- [ ] Grammar supports: `user.authenticated`, `user.role.<role>`, `user.permission.<perm>`, `user.owns.resource`
- [ ] Boolean operators: `AND`, `OR`, `NOT`, parentheses for precedence
- [ ] Parser validates expressions at DSL validation time
- [ ] Runtime evaluator checks expressions against JWT context
- [ ] Examples:
  - `user.authenticated AND user.role.admin`
  - `user.owns.resource OR user.permission.admin`
  - `user.authenticated AND (user.role.editor OR user.permission.write)`

##### Technical Notes

Deferred for deeper discussion; placeholder in DSL. Consider PEG parser (e.g., `pegjs`) or simple recursive descent.

##### Traceability

- **ADRs:** ADR-041 (to be created)
- **Tests:** `src/dsl/__tests__/authorization.test.ts` (future)
- **Docs:** Create `docs/authorization-requirements.md` when undeferred

---

### DSL-FIRST REMOTE

---

#### [ISSUE-012] Shell Integration E2E Test

**Labels:** `priority: high`, `type: testing`, `component: remote`, `req: remote`  
**Requirements:** REQ-REMOTE-001 through REQ-REMOTE-009  
**ADRs:** ADR-047, ADR-048  
**Epic:** DSL-First Remote Generation

##### Description

Create end-to-end test that generates shell, generates remote with capabilities, starts both, verifies shell consumes remote via Module Federation and displays capabilities.

##### Requirements Mapping

- **REQ-REMOTE-003:** Capabilities generate feature directories and exports
- **REQ-REMOTE-005:** Module Federation config extracted from DSL

##### Acceptance Criteria

- [ ] Test generates shell and remote in temp directories
- [ ] Remote manifest includes 2 capabilities
- [ ] `remote:generate` creates feature directories and `remote.tsx` exports
- [ ] Shell's rspack config includes remote in `remotes` section
- [ ] Both servers start (shell, remote)
- [ ] Shell fetches `remoteEntry.js` from remote successfully
- [ ] Shell lazy-loads remote capability component
- [ ] Component renders with expected content

##### Technical Notes

Use Playwright or Puppeteer for browser automation; verify DOM contains expected elements.

##### Traceability

- **ADRs:** ADR-047 (generated tests), ADR-048 (DSL-first)
- **Tests:** `scripts/e2e-shell-remote.test.js` (new)
- **Docs:** Update `docs/dsl-remote-requirements.md` E2E section

---

#### [ISSUE-013] RTK Query Code Generation from OpenAPI

**Labels:** `priority: high`, `type: feature`, `component: remote`, `req: remote`  
**Requirements:** REQ-REMOTE-004  
**ADRs:** ADR-046, ADR-047  
**Epic:** DSL-First Remote Generation

##### Description

Generate RTK Query API slices and typed hooks from OpenAPI specs listed in DSL `data.sources`. Align with BFF GraphQL approach (queries call GraphQL endpoint, not REST directly).

##### Requirements Mapping

- **REQ-REMOTE-004:** RTK Query generation from data sources

##### Acceptance Criteria

- [ ] Parse OpenAPI specs from DSL `data.sources[]`
- [ ] Generate `platform/api.ts` with RTK Query `createApi` and endpoints
- [ ] Each OpenAPI operation generates query or mutation endpoint
- [ ] Typed hooks auto-generated: `useGetUserQuery`, `useUpdateUserMutation`
- [ ] Store configuration includes API middleware
- [ ] GraphQL queries target BFF endpoint (not REST directly)

##### Technical Notes

Use `@rtk-query/graphql-request-base-query` to call GraphQL BFF. OpenAPI paths map to GraphQL query/mutation names with prefix (e.g., `UserAPI_getUser`).

```typescript
// Generated platform/api.ts
export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: graphqlRequestBaseQuery({ url: '/graphql' }),
  endpoints: (builder) => ({
    getUser: builder.query<User, string>({
      query: (id) => ({
        document: `query GetUser($id: ID!) { UserAPI_getUser(id: $id) { id name } }`,
        variables: { id },
      }),
    }),
  }),
});
```

##### Traceability

- **ADRs:** ADR-046 (BFF alignment), ADR-047 (DSL-first remote)
- **Tests:** `src/codegen/__tests__/rtk-query-generator.test.ts` (new)
- **Docs:** Update `docs/dsl-remote-requirements.md` data layer section

---

### SCAFFOLDING & TESTING

---

#### [ISSUE-014] Generate Test Files for Shell/Remote/API/BFF

**Labels:** `priority: critical`, `type: feature`, `component: scaffold`, `req: scaffold`  
**Requirements:** REQ-SCAFFOLD-001, REQ-SCAFFOLD-002  
**ADRs:** ADR-047  
**Epic:** Testing & Quality

##### Description

All `mfe shell|remote|api|bff:init` commands must generate working test files with real assertions. Tests must pass immediately after scaffolding (`npm test` succeeds).

##### Requirements Mapping

- **REQ-SCAFFOLD-001:** Generated test files for all MFE types
- **REQ-SCAFFOLD-002:** Module Federation mock configuration

##### Acceptance Criteria

- [ ] Shell: Generates `App.test.tsx`, `routing.test.tsx` with component and navigation tests
- [ ] Remote: Generates `App.test.tsx`, `federation.test.tsx` with standalone render and contract tests
- [ ] API: Generates `<entity>.controller.test.ts` with CRUD and validation tests
- [ ] BFF: Generates `graphql.test.ts` with introspection and JWT forwarding tests
- [ ] All tests pass immediately (`npm test` succeeds)
- [ ] Tests demonstrate patterns (mocking, async, error handling)

##### Technical Notes

Use EJS templates for test files with variables: `<%= name %>`, `<%= Name %>`, `<%= testEnvironment %>`.

##### Traceability

- **ADRs:** ADR-047 (generated test templates)
- **Tests:** Verify test file generation in command tests
- **Docs:** Update `docs/scaffolding-requirements.md` implementation status

---

#### [ISSUE-015] Test Utility Helpers Generation

**Labels:** `priority: medium`, `type: feature`, `component: scaffold`, `req: scaffold`  
**Requirements:** REQ-SCAFFOLD-003  
**ADRs:** ADR-047  
**Epic:** Testing & Quality

##### Description

Generate `testUtils.ts` with common helpers: `renderWithProviders()` for React, mock factories, typed helpers.

##### Requirements Mapping

- **REQ-SCAFFOLD-003:** Test utility helpers with providers and factories

##### Acceptance Criteria

- [ ] React projects generate `src/testUtils.ts`
- [ ] Includes `renderWithProviders()` with Router, ThemeProvider
- [ ] Includes `createMockRemote(name)` for Module Federation testing
- [ ] Includes `createMockResponse<T>(data, status)` for fetch mocking
- [ ] Helpers are typed (TypeScript) with JSDoc comments

##### Technical Notes

Template: `src/templates/react/remote/testUtils.ts.ejs`

##### Traceability

- **Tests:** `src/commands/__tests__/remote-init.test.ts` (verify file exists)
- **Docs:** Add usage examples to `docs/scaffolding-requirements.md`

---

#### [ISSUE-016] Jest Coverage Threshold Configuration

**Labels:** `priority: high`, `type: feature`, `component: scaffold`, `req: scaffold`  
**Requirements:** REQ-SCAFFOLD-004  
**ADRs:** ADR-047  
**Epic:** Testing & Quality

##### Description

Generate `jest.config.js` with 80% coverage thresholds, appropriate test environment, and module mappers.

##### Requirements Mapping

- **REQ-SCAFFOLD-004:** Coverage threshold configuration

##### Acceptance Criteria

- [ ] `jest.config.js` generated with 80% thresholds (branches, functions, lines, statements)
- [ ] `testEnvironment` set correctly: `jsdom` for shell/remote, `node` for API/BFF
- [ ] Module name mappers configured for path aliases (`@/`)
- [ ] CSS/SCSS modules mocked with `identity-obj-proxy`
- [ ] `collectCoverageFrom` excludes generated/boilerplate files

##### Technical Notes

Template: `src/templates/react/remote/jest.config.js.ejs`

##### Traceability

- **Tests:** Verify jest.config.js generation
- **Docs:** Document coverage expectations in scaffolding requirements

---

### PRODUCTION READINESS

---

#### [ISSUE-017] Docker Compose Production Deployment

**Labels:** `priority: critical`, `type: feature`, `component: deployment`, `impl: deployment`  
**Requirements:** Enhancement Plan Phase 1  
**ADRs:** TBD  
**Epic:** Production Readiness

##### Description

`mfe deploy --env production` must generate Docker Compose manifests for shell + orchestration + remotes with multi-stage builds, non-root runtime, and healthchecks.

##### Acceptance Criteria

- [ ] `deploy --env production` generates `docker-compose.prod.yml`
- [ ] Includes services: shell, orchestration, redis, remotes
- [ ] Multi-stage Dockerfiles for React (nginx) and Node.js (Express)
- [ ] Non-root user in runtime stage
- [ ] Health checks configured for all services
- [ ] README generated with deployment instructions

##### Technical Notes

Templates: `src/templates/docker/Dockerfile.prod.ejs`, `docker-compose.prod.yml.ejs`

##### Traceability

- **Tests:** `src/commands/__tests__/deploy.test.js` (extend for production)
- **Docs:** Create `docs/production-deployment.md`

---

#### [ISSUE-018] Kubernetes Deployment Manifests

**Labels:** `priority: high`, `type: feature`, `component: deployment`, `impl: deployment`  
**Requirements:** Enhancement Plan Phase 1  
**ADRs:** TBD  
**Epic:** Production Readiness

##### Description

`mfe deploy --target kubernetes` generates K8s manifests: Deployment, Service, Ingress, HPA, ConfigMap, Secret.

##### Acceptance Criteria

- [ ] Generates manifests for shell, orchestration, remotes
- [ ] Deployment includes resource limits, readiness/liveness probes
- [ ] Service with ClusterIP for internal, LoadBalancer for shell
- [ ] Ingress with path-based routing to remotes
- [ ] HPA configured for shell (CPU-based autoscaling)
- [ ] ConfigMap/Secret templates for environment variables

##### Technical Notes

Templates: `src/templates/kubernetes/*.yaml.ejs`

##### Traceability

- **Tests:** `src/commands/__tests__/deploy-k8s.test.js` (new)
- **Docs:** Add K8s section to `docs/production-deployment.md`

---

#### [ISSUE-019] Secure Secrets Generation

**Labels:** `priority: critical`, `type: feature`, `component: security`, `impl: security`  
**Requirements:** Enhancement Plan Phase 1  
**ADRs:** TBD  
**Epic:** Production Readiness

##### Description

All generated `.env` files must use cryptographically secure random secrets (JWT, database passwords). `.env.example` warns against using example values.

##### Acceptance Criteria

- [ ] `src/utils/securityUtils.js` exports `generateSecureSecret(length)`
- [ ] `mfe api:init` uses secure secret for `JWT_SECRET`
- [ ] `mfe bff:init` uses secure secret for session keys
- [ ] `.env.example` includes warnings: `# DO NOT USE THESE VALUES IN PRODUCTION`
- [ ] CLI logs reminder to rotate secrets in production

##### Technical Notes

Use `crypto.randomBytes()` for secret generation.

```javascript
// src/utils/securityUtils.js
const crypto = require('crypto');

function generateSecureSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}
```

##### Traceability

- **Tests:** `src/utils/__tests__/securityUtils.test.js` (extend)
- **Docs:** Add security section to enhancement plan

---

#### [ISSUE-020] CI/CD Pipeline with GitHub Actions

**Labels:** `priority: high`, `type: feature`, `component: ci-cd`, `impl: deployment`  
**Requirements:** Enhancement Plan Phase 3  
**ADRs:** TBD  
**Epic:** Production Readiness

##### Description

Create `.github/workflows/ci.yml` with lint, test, coverage, audit, and release jobs.

##### Acceptance Criteria

- [ ] `ci.yml` runs on push to `main` and pull requests
- [ ] Matrix strategy for Node.js versions (18, 20, 22)
- [ ] Steps: install, lint, test, coverage upload (Codecov)
- [ ] `npm audit` fails on high/critical vulnerabilities
- [ ] Release workflow drafts changelog on tag push
- [ ] README includes build/coverage badges

##### Technical Notes

Use `actions/setup-node@v4`, `codecov/codecov-action@v4`.

##### Traceability

- **Tests:** Verify workflow syntax
- **Docs:** Add CI/CD section to enhancement plan

---

### DEVELOPER EXPERIENCE

---

#### [ISSUE-021] Interactive Command Modes with Inquirer

**Labels:** `priority: medium`, `type: feature`, `component: cli`, `impl: dx`  
**Requirements:** Enhancement Plan Phase 4  
**ADRs:** TBD  
**Epic:** Developer Experience

##### Description

Add interactive prompts to all commands using `inquirer` when no arguments provided. Guides users through options with validation.

##### Acceptance Criteria

- [ ] `mfe shell` (no args) prompts for name, port, orchestration config
- [ ] `mfe remote:init` prompts for name, port, capabilities
- [ ] `mfe api:init` prompts for name, database type, OpenAPI spec path
- [ ] `mfe deploy` prompts for target (docker/k8s), environment
- [ ] Validation on prompts (e.g., port range 1024-65535)
- [ ] Prompts skippable with CLI flags (`--name`, `--port`)

##### Technical Notes

Use `inquirer` for prompts; maintain backwards compatibility with existing flag-based usage.

##### Traceability

- **Tests:** `src/commands/__tests__/interactive.test.js` (new)
- **Docs:** Update command reference with interactive mode examples

---

#### [ISSUE-022] TypeScript Templates for Shell/Remote/API

**Labels:** `priority: medium`, `type: feature`, `component: codegen`, `impl: dx`  
**Requirements:** Enhancement Plan Phase 4  
**ADRs:** ADR-048  
**Epic:** Developer Experience

##### Description

Add TypeScript variants of templates. Default to TypeScript; JavaScript opt-in via `--lang javascript`.

##### Acceptance Criteria

- [ ] Templates: `src/templates/react-ts/`, `src/templates/api-ts/`
- [ ] CLI flag: `--lang typescript|javascript` (default: `typescript`)
- [ ] Generated projects include `tsconfig.json`
- [ ] Build scripts use `tsc` and `ts-node`
- [ ] Tests use `ts-jest`

##### Technical Notes

Reuse existing template structure; add `.ts`/`.tsx` variants with type annotations.

##### Traceability

- **ADRs:** ADR-048 (incremental TypeScript migration)
- **Tests:** Verify TS template generation
- **Docs:** Update scaffolding requirements with TS examples

---

#### [ISSUE-023] Troubleshooting Documentation

**Labels:** `priority: medium`, `type: docs`, `component: docs`, `impl: dx`  
**Requirements:** Enhancement Plan Session 6 Addendum  
**ADRs:** N/A  
**Epic:** Developer Experience

##### Description

Create `docs/troubleshooting.md` covering common issues: Module Federation shared conflicts (React/MUI), CORS, remoteEntry URL validation.

##### Acceptance Criteria

- [ ] Document covers 3 common issues with actionable steps
- [ ] React singleton conflict: symptoms, rspack config fix, verification
- [ ] CORS errors: causes, dev server config, production nginx config
- [ ] remoteEntry 404: URL validation, network tab inspection, port conflicts
- [ ] Linked from main README and generated project READMEs

##### Technical Notes

Include screenshots and code snippets for clarity.

##### Traceability

- **Docs:** New file `docs/troubleshooting.md`
- **Tests:** N/A (documentation)

---

## Traceability Matrix

| Issue       | Requirements                     | ADRs                      | Acceptance              | Epic                          |
| ----------- | -------------------------------- | ------------------------- | ----------------------- | ----------------------------- |
| ISSUE-001   | REQ-002, REQ-003                 | ADR-016, ADR-017          | N/A (new)               | Core Orchestration System     |
| ISSUE-002   | REQ-004                          | ADR-012                   | remote-mfe.feature      | Core Orchestration System     |
| ISSUE-003   | REQ-011                          | ADR-011                   | N/A (new)               | Core Orchestration System     |
| ISSUE-004   | REQ-010                          | ADR-010                   | N/A (new)               | Core Orchestration System     |
| ISSUE-005   | REQ-002 (sub)                    | N/A                       | N/A (new)               | Core Orchestration System     |
| ISSUE-006   | REQ-BFF-001 to REQ-BFF-004       | ADR-046                   | bff.feature             | GraphQL BFF Layer             |
| ISSUE-007   | REQ-BFF-002                      | ADR-046                   | bff.feature             | GraphQL BFF Layer             |
| ISSUE-008   | REQ-042, 043, 044, 045           | ADR-036, 037, 038         | N/A (new)               | DSL Contract Implementation   |
| ISSUE-009   | REQ-046                          | ADR-039                   | N/A (new)               | DSL Contract Implementation   |
| ISSUE-010   | REQ-047                          | ADR-040                   | N/A (new)               | DSL Contract Implementation   |
| ISSUE-011   | REQ-048 (deferred)               | ADR-041 (pending)         | N/A (future)            | DSL Contract Implementation   |
| ISSUE-012   | REQ-REMOTE-001 to 009            | ADR-047, 048              | remote-mfe.feature      | DSL-First Remote Generation   |
| ISSUE-013   | REQ-REMOTE-004                   | ADR-046, 047              | N/A (new)               | DSL-First Remote Generation   |
| ISSUE-014   | REQ-SCAFFOLD-001, 002            | ADR-047                   | N/A (generated)         | Testing & Quality             |
| ISSUE-015   | REQ-SCAFFOLD-003                 | ADR-047                   | N/A (generated)         | Testing & Quality             |
| ISSUE-016   | REQ-SCAFFOLD-004                 | ADR-047                   | N/A (generated)         | Testing & Quality             |
| ISSUE-017   | Enhancement Plan Phase 1         | TBD                       | N/A (new)               | Production Readiness          |
| ISSUE-018   | Enhancement Plan Phase 1         | TBD                       | N/A (new)               | Production Readiness          |
| ISSUE-019   | Enhancement Plan Phase 1         | TBD                       | N/A (new)               | Production Readiness          |
| ISSUE-020   | Enhancement Plan Phase 3         | TBD                       | N/A (new)               | Production Readiness          |
| ISSUE-021   | Enhancement Plan Phase 4         | TBD                       | N/A (new)               | Developer Experience          |
| ISSUE-022   | Enhancement Plan Phase 4         | ADR-048                   | N/A (new)               | Developer Experience          |
| ISSUE-023   | Enhancement Plan Session 6       | N/A                       | N/A (docs)              | Developer Experience          |

---

## Issue Workflow Integration

### Creating Issues from Backlog

1. **Copy issue content** from this backlog to GitHub Issues UI
2. **Apply labels** from Labels section
3. **Link requirements** in issue description (use permalinks)
4. **Reference ADRs** with links to `docs/architecture-decisions.md` anchors
5. **Link acceptance criteria** files if they exist
6. **Add to project board** under appropriate epic column

### Tracking Progress

- **In issue:** Update acceptance criteria checkboxes as work progresses
- **In backlog:** Update issue status label (`status: in-progress`, `status: blocked`)
- **In requirements docs:** Mark requirements as `Status: Implemented` when issues close
- **In ADRs:** Add implementation notes linking to closed issues

### Closing Issues

When closing an issue:

1. Verify all acceptance criteria met
2. Update requirements doc status
3. Update ADR with implementation notes
4. Link PR that implemented the feature
5. Update acceptance criteria file if applicable
6. Update this backlog with completion date

---

## Next Actions

1. **Create GitHub Issue Templates** based on issue template structure above
2. **Define GitHub Labels** matching label system
3. **Create GitHub Project** with epic columns
4. **Import backlog items** to GitHub Issues (start with Epic 1)
5. **Update agent instructions** to reference this backlog for requirements tracking
6. **Add issue creation** to requirements elicitation workflow

---

## Revision History

| Date       | Version | Changes                                               | Author         |
| ---------- | ------- | ----------------------------------------------------- | -------------- |
| 2025-11-27 | 1.0     | Initial backlog from all requirements documents       | Sean + Copilot |
| 2025-11-27 | 1.1     | Added traceability matrix and workflow integration    | Sean + Copilot |


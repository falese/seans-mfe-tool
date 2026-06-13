# seans-mfe-tool — Spec

> Last updated: 2026-05-24

---

## Context

**seans-mfe-tool** is a platform for delivering domain features as independently deployable units, in any framework, language, or federation pattern.

The key idea: a domain team defines _capabilities_ (e.g. `PlayGame`, `ShowCover`) in a DSL manifest. The CLI generates the full project scaffold — bundler config, runtime lifecycle wiring, BFF layer, Docker setup — targeting whatever framework and delivery mechanism the team uses. The generated code conforms to the **platform lifecycle contract** (`@seans-mfe-tool/runtime`), which makes domain capabilities composable in a shell regardless of how they were built.

Federation (Module Federation, native ESM, iframe, web components) is one of several delivery mechanisms, not the purpose of the platform.

Long-term goal: a community marketplace of domain-capability packages — domain expert teams publish adaptor packs; any shell operator can install and compose them.

---

## Hardware and runtime

| Constraint | Value |
|---|---|
| Node | ≥ 18 |
| Dev entry | `bun bin/dev.ts` (no transpile) |
| Published entry | `bin/run.js` (pure Node, loads `dist/commands/`) |
| CLI framework | oclif |
| Build output | `dist/` (TypeScript → CJS) |
| Packages | `packages/contracts/`, `packages/oclif-base/`, `packages/runtime/` |

---

## CLI command surface

```
seans-mfe-tool remote:generate          # Generate/regenerate MFE source from DSL manifest
seans-mfe-tool remote:init              # Scaffold a new remote MFE project
seans-mfe-tool remote:init-angular      # Scaffold a new Angular remote MFE project
seans-mfe-tool bff:init                 # Scaffold a GraphQL BFF for an MFE
seans-mfe-tool deploy                   # Generate Docker/K8s deployment artifacts
seans-mfe-tool schemas                  # Generate JSON schemas from command types
seans-mfe-tool mcp:serve               # Start MCP server (tool registry)
```

All commands accept `--json` for machine-readable `CommandResult<T>` output.  
All mutating commands accept `--dry-run`.

---

## Codegen flow

```
mfe-manifest.yaml
      │
      ▼
seans-mfe-tool remote:generate
      │
      ├─ Parse & validate manifest (Zod schema)
      ├─ Resolve codegen variant (framework + bundler from manifest fields)
      ├─ Select EJS templates from src/codegen/templates/<variant>/
      ├─ Render templates with manifest variables
      └─ Write generated files (skip if unchanged, --force to overwrite)
```

**Manifest fields that drive variant selection:**
- `framework: angular | react | vue | svelte | vanilla`
- `bundler: webpack | rspack | vite | esbuild`
- `language: typescript | javascript` (default: `typescript`)

These fields are **not hardcoded** in templates — they are variables. Adding a new framework means adding a new template variant, not changing the generator logic.

---

## DSL manifest (`mfe-manifest.yaml`)

```yaml
name: my-feature
version: 1.0.0
type: remote
language: typescript
framework: react          # angular | react | vue | svelte | vanilla
bundler: rspack           # webpack | rspack | vite | esbuild

endpoint: http://localhost:3001
remoteEntry: http://localhost:3001/remoteEntry.js
discovery: http://localhost:3001/.well-known/mfe-manifest.yaml

capabilities:
  - MyCapability:
      type: domain
      description: What this capability does

  - Load:
      type: platform
      lifecycle:
        before:
          - onLoadBegin:
              handler: onLoadBegin
              description: Log load entry
        after:
          - onLoadComplete:
              handler: onLoadComplete
              description: Log load success
        error:
          - onLoadError:
              handler: onLoadError
              contained: true
              description: Log load failure

dependencies:
  runtime:
    react: ^18.2.0       # framework-specific runtime deps
```

---

## Domain capability delivery patterns

Domain capabilities are packaged as independently deployable units. The **platform lifecycle contract** is delivery-mechanism-agnostic — the shell doesn't care how a capability was built.

| Delivery mechanism | Generator variant | Shared deps pattern |
|---|---|---|
| rspack Module Federation | `react` | `shared: { react: { singleton: true } }` |
| webpack Module Federation | `angular` | `@angular-architects/module-federation` |
| Native ESM | (future) | no shared dep negotiation |
| iframe | (future) | postMessage contract |
| Web components | (future) | custom element registration |

**The manifest `framework` and `bundler` fields select the generator variant.** Adding Vue support means adding a `vue/rspack` template variant — not changing how the platform lifecycle works.

---

## Runtime platform (`@seans-mfe-tool/runtime`)

**Package:** `packages/runtime/` → published as `@seans-mfe-tool/runtime`  
**Dist:** `dist/runtime/` (compiled, installable via `file:` in Docker)

### Class hierarchy

```
BaseMFE (abstract)
  └── RemoteMFE          — React/rspack MFEs
  └── AngularRemoteMFE   — Angular/webpack MFEs
```

### Platform lifecycle (10 capabilities)

All are inherited by subclasses; domain teams implement `loadDomainComponent()` and their domain capability methods.

| Capability | Description |
|---|---|
| `load()` | Initialize runtime: fetch remoteEntry.js, init Module Federation container |
| `render()` | Mount component into DOM container |
| `refresh()` | Reload data and re-render without unmounting |
| `authorizeAccess()` | Validate JWT and evaluate permissions |
| `health()` | Report liveness/readiness status |
| `describe()` | Return manifest metadata |
| `schema()` | Return JSON schema for capability inputs/outputs |
| `query()` | Execute a read-only domain query |
| `emit()` | Publish a domain event |
| `updateControlPlaneState()` | Push state update to orchestration layer |

### Import paths

```typescript
import { BaseMFE, RemoteMFE } from '@seans-mfe-tool/runtime';
import { AngularRemoteMFE } from '@seans-mfe-tool/runtime/angular';
```

### Docker note

`dist/runtime/package.json` exports conditions must include `require`, `import`, and `default` so both webpack (Angular) and rspack (React) can resolve the package. See `scripts/copy-runtime-files.js`.

---

## BaseCommand + JSON envelope

All oclif commands extend `BaseCommand` from `@seans-mfe/oclif-base`.

```typescript
// Subclasses implement runCommand(), NOT run()
protected abstract runCommand(): Promise<T>;
```

`BaseCommand.run()` owns:
- JSON envelope wrapping under `--json`
- Exit code mapping from typed errors
- stdout/stderr split (progress → stderr, result → stdout under `--json`)
- Rejection of interactive prompts when `--json` is active

**`CommandResult<T>` shape:**
```typescript
{ ok: true;  data: T }
{ ok: false; error: { code: string; message: string; exitCode: number } }
```

---

## Typed errors

Import from `@seans-mfe/contracts` (post-C1) or `src/runtime/errors/` (pre-C1).

| Error class | Exit code | When to use |
|---|---|---|
| `ValidationError` | 64 | Bad user input, missing flag, Zod failure |
| `BusinessError` | 65 | Rule violation (directory exists, missing --force) |
| `NetworkError` | 66 | Registry, HTTP, WebSocket failure |
| `SystemError` | 69 | FS read, missing binary, prompt under --json |
| `TimeoutError` | 124 | Operation exceeded time budget |
| `SecurityError` | 77 | Auth/permission failure |

Never `throw new Error(...)` in command code. Always use typed errors.

---

## Observability

All generation and training workflows emit structured JSON to stderr (or log file at `--log-level debug`).

```json
{ "ts": "...", "event": "generate_start", "command": "remote:generate", "manifest": "..." }
{ "ts": "...", "event": "generate_complete", "files_written": 8, "files_skipped": 22, "duration_ms": 430 }
```

---

## ADR index

All architecture decisions live in `docs/architecture-decisions/`. **Before implementing anything that touches the platform contract, bundler integration, lifecycle, or BFF layer — look here first.**

| ADR | Title | Area | Status |
|-----|-------|------|--------|
| ADR-001 | Lifecycle Re-Entrancy Guard in BaseMFE | Runtime lifecycle | Accepted |
| ADR-002 | Lifecycle Hook Execution Model | Runtime lifecycle | Implemented |
| ADR-003 | No Custom Lifecycle Phases | Runtime lifecycle | Implemented |
| ADR-004 | Handler Array Support | Runtime lifecycle | Implemented |
| ADR-005 | Handler Discovery Convention | Runtime lifecycle | Implemented |
| ADR-006 | Unified Type System | DSL / types | Implemented |
| ADR-007 | Authorization Expression Grammar | DSL / security | Deferred |
| ADR-008 | Data Type Metadata | DSL | Implemented |
| ADR-009 | Language Field and Template Selection | Codegen | Implemented |
| ADR-010 | Data Lifecycle Alignment | DSL | Implemented |
| ADR-011 | GeneratedFrom Traceability | DSL | Implemented |
| ADR-012 | GraphQL Mesh BFF Layer | BFF | Implemented |
| ADR-013 | Generated MFE Test Templates | Codegen / testing | Implemented |
| ADR-014 | Incremental TypeScript Migration | Codebase | Implemented |
| ADR-015 | oclif as CLI framework — replace Commander | CLI | Accepted |
| ADR-016 | BaseCommand pattern | CLI / contracts | Accepted |
| ADR-017 | Typed error hierarchy | CLI / contracts | Accepted |
| ADR-018 | CommandResult\<T\> JSON envelope | CLI / contracts | Accepted |
| ADR-019 | MCP child-process isolation | MCP | Accepted |
| ADR-020 | Bun for dev, Node for publish | CLI dev workflow | Accepted |
| ADR-021 | Package namespace strategy (@seans-mfe/* vs @falese/*) | Packages | Accepted |
| ADR-022 | Plugin-first architecture | Architecture | Accepted |
| ADR-023 | No-any TypeScript discipline | TypeScript | Accepted |
| ADR-024 | Platform Handler Library Standardization | Runtime handlers | Planned |
| ADR-025 | Platform Handler Interface & Execution Model | Runtime handlers | In Progress |
| ADR-026 | Load Capability — Atomic Operation Design | Runtime lifecycle | In Progress |
| ADR-027 | GraphQL Mesh v0.100.x with Production Plugins & Transforms | BFF layer | Implemented |
| ADR-028 | Parallel Handler Execution with Context Isolation | Lifecycle engine | Proposed |
| ADR-029 | Timeout Protection with AbortSignal | Lifecycle engine | Proposed |
| ADR-030 | Error Classification with Hybrid Detection | Lifecycle engine | Proposed |
| ADR-031 | Conditional Execution with Jexl Expression Engine | Lifecycle engine | Proposed |
| ADR-032 | Inter-Hook Communication with TypeScript Code Generation | Lifecycle engine | Proposed |
| ADR-033 | Two-headed giant — AI-native + human-legible DX | Developer model | Accepted |
| ADR-034 | Pluggable bundler + framework via codegen variants | Codegen / polyglot | Accepted |
| ADR-035 | Docker build orchestration via Turborepo task graph | Docker / CI | Accepted |
| ADR-036 | Framework plugin system — `BaseFrameworkPlugin` + `loadFrameworkPlugin()` | Build / codegen / deploy | Accepted |
| ADR-037 | TDD-always development discipline | Process | Accepted |
| ADR-038 | Conventional Commits and branch naming | Process | Accepted |
| ADR-039 | Structured logger — no console.log in production code | CLI / logging | Accepted |
| ADR-040 | Manifest-Declared Handler Sources | DSL / handlers / codegen | Accepted |
| ADR-041 | BaseMFE Abstract Base Class & Platform Capability Contract | Runtime / base-class | Accepted |
| ADR-042 | MFE Lifecycle State Machine | Runtime lifecycle | Accepted |
| ADR-043 | Manifest-Driven Code Generation Pipeline | Codegen / DSL | Accepted |
| ADR-044 | Production Container Hardening for Generated MFEs | Docker / deploy / security | Accepted |
| ADR-045 | Package Manager and Local Runtime Pinning | Tooling / package manager / runtime | Proposed |
| ADR-046 | Environment Configuration and Secret Validation | Configuration / security | Proposed |
| ADR-047 | CODEOWNERS and Review Routing for Architectural Surfaces | Governance / review | Proposed |
| ADR-048 | Dependency Update and Vulnerability Response Policy | Dependencies / security | Proposed |
| ADR-049 | Release, Versioning, and Publish Automation | Release / packages | Proposed |
| ADR-050 | Dependency Governance — Pinning, hasBff Gate, DEPENDENCY_VERSIONS | Codegen / dependencies / security | Implemented |
| ADR-051 | Angular 19 Upgrade — Resolve XSS CVEs in Generated MFEs | Angular / security | Implemented |
| ADR-052 | BFF Demo Mode — Per-Request Mock Switch via resolversComposition | BFF / mock / demo-mode | Implemented |
| ADR-053 | RemoteMFE.doQuery — Remove throw; BaseMFE.doQuery is sufficient | Runtime / query / BFF | Implemented |
| ADR-054 | Control-Plane Message Protocol as a Shared Contract in @seans-mfe/contracts | Contracts / daemon / control-plane | Implemented |
| ADR-055 | LayoutManager — Daemon-Driven Slot Composition for Generic Shells | Runtime / shell / layout / control-plane | Implemented |
| ADR-056 | MFE Presentation Boundary and Host-Side Composition Providers (Polyglot VM Model) | Runtime / boundary / providers / polyglot | Proposed |

---

## Definition of done

**A feature is complete when:**

- [ ] All tests pass (`npm test`)
- [ ] `npm run typecheck` clean (tsc --noEmit)
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds (catches broken oclif manifest)
- [ ] Post-B5: `npm run build:schemas && git diff --exit-code schemas/`
- [ ] PR body links the issue (`Closes #N`) and references governing ADRs
- [ ] New architectural decisions either cite an existing ADR or include a new ADR file

---

## Out of scope (v1)

- Hosted marketplace registry (v1 uses git-based `--from-git`)
- Multi-capability composition within a single render context
- Hot-swap adaptor loading at runtime
- Vite / esbuild bundler variants (webpack + rspack only in v1)
- Vue, Svelte, vanilla framework variants (React + Angular only in v1)
- Windows / Linux support

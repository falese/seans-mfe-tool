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

**Generated** from ADR frontmatter (ADR-075 §1) — do not hand-edit. Run
`npm run build:adr-index` after changing an ADR's `status`, `area`, `title`, or
`impl`; CI gates it with `npm run build:adr-index:check`.

<!-- BEGIN GENERATED: adr-index -->

| ADR | Title | Area | Status |
|-----|-------|------|--------|
| [ADR-001](./architecture-decisions/ADR-001-lifecycle-reentrancy-guard.md) | Lifecycle Re-Entrancy Guard in BaseMFE | Runtime lifecycle | Implemented |
| [ADR-002](./architecture-decisions/ADR-002-lifecycle-hook-execution-model.md) | Lifecycle Hook Execution Model | Runtime lifecycle | Implemented |
| [ADR-003](./architecture-decisions/ADR-003-no-custom-lifecycle-phases.md) | No Custom Lifecycle Phases | Runtime lifecycle | Implemented |
| [ADR-004](./architecture-decisions/ADR-004-handler-array-support.md) | Handler Array Support | Runtime lifecycle | Implemented |
| [ADR-005](./architecture-decisions/ADR-005-handler-discovery-convention.md) | Handler Discovery Convention | Runtime lifecycle | Implemented |
| [ADR-006](./architecture-decisions/ADR-006-unified-type-system.md) | Unified Type System | DSL / types | Implemented |
| [ADR-007](./architecture-decisions/ADR-007-authorization-expression-grammar.md) | Authorization Expression Grammar | DSL / security | Deferred |
| [ADR-008](./architecture-decisions/ADR-008-data-type-metadata.md) | Data Type Metadata | DSL | Implemented |
| [ADR-009](./architecture-decisions/ADR-009-language-field-template-selection.md) | Language Field and Template Selection | Codegen | Implemented |
| [ADR-010](./architecture-decisions/ADR-010-data-lifecycle-alignment.md) | Data Lifecycle Alignment | DSL | Implemented |
| [ADR-011](./architecture-decisions/ADR-011-generated-from-traceability.md) | GeneratedFrom Traceability | DSL | Implemented |
| [ADR-012](./architecture-decisions/ADR-012-graphql-mesh-bff-layer.md) | GraphQL Mesh for BFF Layer with DSL-Embedded Configuration | BFF | Implemented |
| [ADR-013](./architecture-decisions/ADR-013-generated-mfe-test-templates.md) | Generated MFE Test Templates | Codegen / testing | Implemented |
| [ADR-014](./architecture-decisions/ADR-014-incremental-typescript-migration.md) | Incremental TypeScript Migration | Codebase | Implemented |
| [ADR-015](./architecture-decisions/ADR-015-oclif-migration.md) | oclif as CLI framework — replace Commander | CLI | Implemented |
| [ADR-016](./architecture-decisions/ADR-016-base-command-pattern.md) | BaseCommand pattern — every oclif command extends BaseCommand | CLI / contracts | Implemented |
| [ADR-017](./architecture-decisions/ADR-017-typed-error-hierarchy.md) | Typed error hierarchy — never throw raw Error | CLI / contracts | Implemented |
| [ADR-018](./architecture-decisions/ADR-018-command-result-envelope.md) | CommandResult\<T\> JSON envelope — single stdout line under --json | CLI / contracts | Implemented |
| [ADR-019](./architecture-decisions/ADR-019-mcp-child-process-isolation.md) | MCP child-process isolation — spawn seans-mfe-tool per tool call | MCP | Implemented |
| [ADR-020](./architecture-decisions/ADR-020-bun-node-split.md) | Bun for dev entry, Node for published entry — permanent split | CLI dev workflow | Implemented |
| [ADR-021](./architecture-decisions/ADR-021-package-namespace-strategy.md) | Package namespace strategy — @seans-mfe/* vs @falese/* | Packages | Accepted |
| [ADR-022](./architecture-decisions/ADR-022-plugin-first-architecture.md) | Plugin-first architecture — falese/daemon and falese/coder as oclif plugins | Architecture | Accepted |
| [ADR-023](./architecture-decisions/ADR-023-no-any-typescript-discipline.md) | No-any TypeScript discipline — use unknown and narrow | TypeScript | Implemented |
| [ADR-024](./architecture-decisions/ADR-024-platform-handler-library.md) | Platform Handler Library Standardization | Runtime handlers | Proposed |
| [ADR-025](./architecture-decisions/ADR-025-platform-handler-interface.md) | Platform Handler Interface & Execution Model | Runtime handlers | Superseded |
| [ADR-026](./architecture-decisions/ADR-026-load-capability-atomic.md) | Load Capability — Atomic Operation Design | Runtime lifecycle | Accepted (impl phased, #318) |
| [ADR-027](./architecture-decisions/ADR-027-mesh-v0100-plugins.md) | GraphQL Mesh v0.100.x with Production Plugins & Transforms | BFF layer | Implemented |
| [ADR-028](./architecture-decisions/ADR-028-parallel-execution.md) | Parallel Handler Execution with Context Isolation | Lifecycle engine | Proposed |
| [ADR-029](./architecture-decisions/ADR-029-timeout-protection.md) | Timeout Protection with AbortSignal | Lifecycle engine | Implemented |
| [ADR-030](./architecture-decisions/ADR-030-error-classification.md) | Error Classification with Hybrid Detection | Lifecycle engine | Implemented |
| [ADR-031](./architecture-decisions/ADR-031-conditional-execution.md) | Conditional Execution with Jexl Expression Engine | Lifecycle engine | Proposed |
| [ADR-032](./architecture-decisions/ADR-032-inter-hook-communication.md) | Inter-Hook Communication with TypeScript Code Generation | Lifecycle engine | Proposed |
| [ADR-033](./architecture-decisions/ADR-033-two-headed-giant-developer-model.md) | Two-headed giant — AI-native + human-legible developer experience | Developer model | Accepted |
| [ADR-034](./architecture-decisions/ADR-034-pluggable-bundler-framework.md) | Pluggable bundler + framework via codegen variants | Codegen / polyglot | Implemented |
| [ADR-035](./architecture-decisions/ADR-035-docker-turborepo-integration.md) | Docker Build Orchestration via Turborepo Task Graph | Docker / CI | Implemented |
| [ADR-036](./architecture-decisions/ADR-036-framework-plugins.md) | Framework plugins — abstract BaseFrameworkPlugin with concrete implementations | Build / codegen / deploy | Implemented |
| [ADR-037](./architecture-decisions/ADR-037-tdd-always.md) | TDD-always — write the failing test before the code | Process | Accepted |
| [ADR-038](./architecture-decisions/ADR-038-conventional-commits-branch-discipline.md) | Conventional Commits and branch discipline | Process | Accepted |
| [ADR-039](./architecture-decisions/ADR-039-structured-logger-no-console-log.md) | Structured logger — no console.log in production code | CLI / logging | Superseded |
| [ADR-040](./architecture-decisions/ADR-040-manifest-declared-handler-sources.md) | Manifest-Declared Handler Sources | DSL / handlers / codegen | Implemented |
| [ADR-041](./architecture-decisions/ADR-041-base-mfe-abstract-base.md) | BaseMFE Abstract Base Class & Platform Capability Contract | Runtime / base-class | Implemented |
| [ADR-042](./architecture-decisions/ADR-042-mfe-lifecycle-state-machine.md) | MFE Lifecycle State Machine | Runtime lifecycle | Implemented |
| [ADR-043](./architecture-decisions/ADR-043-manifest-driven-codegen.md) | Manifest-Driven Code Generation Pipeline | Codegen / DSL | Implemented |
| [ADR-044](./architecture-decisions/ADR-044-production-container-hardening.md) | Production Container Hardening for Generated MFEs | Docker / deploy / security | Implemented |
| [ADR-045](./architecture-decisions/ADR-045-package-manager-and-runtime-pinning.md) | Package Manager and Local Runtime Pinning | Tooling / package manager / runtime | Proposed |
| [ADR-046](./architecture-decisions/ADR-046-environment-configuration-and-secret-validation.md) | Environment Configuration and Secret Validation | Configuration / security | Proposed |
| [ADR-047](./architecture-decisions/ADR-047-codeowners-and-review-routing.md) | CODEOWNERS and Review Routing for Architectural Surfaces | Governance / review | Proposed |
| [ADR-048](./architecture-decisions/ADR-048-dependency-update-and-vulnerability-response.md) | Dependency Update and Vulnerability Response Policy | Dependencies / security | Proposed |
| [ADR-049](./architecture-decisions/ADR-049-release-versioning-and-publish-automation.md) | Release, Versioning, and Publish Automation | Release / packages | Proposed |
| [ADR-050](./architecture-decisions/ADR-050-dependency-governance.md) | Dependency Governance — Pinning Strategy, hasBff Gate, and DEPENDENCY_VERSIONS | Codegen / dependencies / security | Implemented |
| [ADR-051](./architecture-decisions/ADR-051-angular-19-upgrade.md) | Angular 19 Upgrade — Resolve XSS CVEs in Generated MFEs | Angular / security | Implemented |
| [ADR-052](./architecture-decisions/ADR-052-bff-demo-mode-mock-switch.md) | BFF Demo Mode — Per-Request Mock Switch via resolversComposition | BFF / mock / demo-mode | Implemented |
| [ADR-053](./architecture-decisions/ADR-053-remote-mfe-doquery.md) | RemoteMFE.doQuery — Remove throw; BaseMFE.doQuery is sufficient for all MFE+BFF combinations | Runtime / query / BFF | Implemented |
| [ADR-054](./architecture-decisions/ADR-054-control-plane-message-protocol.md) | Control-Plane Message Protocol as a Shared Contract in @seans-mfe/contracts | Contracts / daemon / control-plane | Implemented |
| [ADR-055](./architecture-decisions/ADR-055-layout-manager-daemon-driven-shells.md) | LayoutManager — Daemon-Driven Slot Composition for Generic Shells | Runtime / shell / layout / control-plane | Implemented |
| [ADR-056](./architecture-decisions/ADR-056-mfe-presentation-boundary.md) | MFE Presentation Boundary and Host-Side Composition Providers (Polyglot VM Model) | Runtime / boundary / providers / polyglot | Implemented |
| [ADR-057](./architecture-decisions/ADR-057-virtualized-daemon-socket.md) | Virtualized daemon socket: per-slot control-plane channels over one host connection | Runtime / control-plane / channels | Implemented |
| [ADR-058](./architecture-decisions/ADR-058-slot-provider-mfes.md) | Slot-provider MFEs: MFEs contribute named slots to the host layout | Runtime / slots / composition | Implemented |
| [ADR-059](./architecture-decisions/ADR-059-base-control-plane.md) | BaseControlPlane: abstract base for all control-plane implementations | Runtime / control-plane / abstract-base | Implemented |
| [ADR-060](./architecture-decisions/ADR-060-contextualized-vm-composition.md) | Contextualized VM composition: value-injection, slot-scoped self-healing, and control-plane re-resolution | Runtime / composition / resilience / context | Implemented |
| [ADR-061](./architecture-decisions/ADR-061-dsl-and-codegen-as-packages.md) | `@seans-mfe/dsl` and `@seans-mfe/codegen` as first-class packages; framework variant is injected, not resolved | Codegen / DSL / packaging | Implemented |
| [ADR-062](./architecture-decisions/ADR-062-deploy-is-dev-convenience-production-is-a-plugin-axis.md) | `deploy` is a dev-convenience wrapper; production deployment returns as a plugin-resolved target axis | Deploy / plugins / scope | Accepted (impl deferred, #250) |
| [ADR-063](./architecture-decisions/ADR-063-api-generation-as-a-plugin-axis.md) | API-backend generation is a plugin axis, not a wrapper around one OSS codegen | Codegen / API / plugins | Accepted (impl deferred, #251) |
| [ADR-064](./architecture-decisions/ADR-064-runtime-as-a-published-package.md) | The runtime's future is a semver-published package, not a staged `dist/runtime` folder | Runtime / packaging / distribution | Accepted (impl deferred, #252) |
| [ADR-065](./architecture-decisions/ADR-065-generated-api-reference.md) | Generated API Reference with Drift Gate; DSL Manifest JSON Schema from the Zod Source of Truth | Docs / tooling / packaging | Implemented |
| [ADR-066](./architecture-decisions/ADR-066-stable-slot-addressing-desired-state-placement.md) | Stable slot addressing and desired-state placement | Runtime / slots / addressing / control-plane | Implemented |
| [ADR-067](./architecture-decisions/ADR-067-manifest-declared-slot-contract.md) | Manifest-declared slot contract: slots are declared in the DSL, code is generated from the declaration | DSL / codegen / slots / contract | Implemented |
| [ADR-068](./architecture-decisions/ADR-068-provider-scoped-slot-addresses.md) | Provider-scoped slot addresses | Runtime / slots / addressing / ownership | Implemented |
| [ADR-069](./architecture-decisions/ADR-069-slot-grammar-single-source.md) | Slot grammar single-sourced in contracts | Contracts / DSL / runtime / packaging | Implemented |
| [ADR-070](./architecture-decisions/ADR-070-control-plane-owned-data-fetch-lifecycle.md) | Experience-scoped federated supergraph (control-plane-composed data over participant MFE BFFs) | Runtime / control-plane / data / federation / lifecycle | Accepted (impl phased, #282, #284, #285, #286, #287, #288) |
| [ADR-071](./architecture-decisions/ADR-071-manifest-driven-client-dependencies.md) | Manifest-Driven Client Dependencies and Federation Shared | Codegen / dependencies / module-federation | Implemented |
| [ADR-072](./architecture-decisions/ADR-072-slot-registration-api.md) | The sanctioned slot registration API: `DeclaredSlot`, typed by the manifest | Codegen / slots / app-code API / typing | Implemented |
| [ADR-073](./architecture-decisions/ADR-073-slot-contract-in-contracts-design-time-validation.md) | Slot contract logic moves to `@seans-mfe/contracts`; placement targets become validatable | Contracts / CLI / slots / design-time validation | Implemented |
| [ADR-074](./architecture-decisions/ADR-074-registration-is-a-build-artifact.md) | The MFE Registration Is a Build Artifact — Register on Build, Not by Hand | Codegen / control-plane / registration / module-federation / drift | Proposed |
| [ADR-075](./architecture-decisions/ADR-075-adr-library-under-drift-control.md) | The ADR Library Is Itself Under Drift Control | Governance / docs / tooling | Implemented |
| [ADR-076](./architecture-decisions/ADR-076-platform-handler-dispatch.md) | Platform handlers dispatch by exported function name from a static library, not a registry class | Runtime handlers | Implemented |
| [ADR-077](./architecture-decisions/ADR-077-two-headed-giant-re-derived.md) | The two-headed giant's implementation plan is re-derived from measured friction, not from the April spec | Developer model / DX / agent contract | Accepted (impl phased, #139) |
| [ADR-078](./architecture-decisions/ADR-078-control-plane-in-platform.md) | The control plane ships in the platform, and a composition environment is generated from a manifest | Control plane / codegen / packaging | Proposed (impl deferred, #139) |
| [ADR-079](./architecture-decisions/ADR-079-single-execution-substitution-seam.md) | There is one seam for substituting handler execution, and it sits inside the lifecycle contract | Runtime / lifecycle / dependency injection | Implemented |
| [ADR-080](./architecture-decisions/ADR-080-platform-contract-single-source.md) | The ten platform capabilities and the MFE lifecycle machine are defined once, in `@seans-mfe/contracts` | Contracts / DSL / runtime / codegen | Implemented |
| [ADR-081](./architecture-decisions/ADR-081-platform-observability-schema.md) | One OpenTelemetry-shaped event schema for the whole platform, propagated by W3C trace context | Observability / contracts / CLI | Accepted (impl phased, #322) |
| [ADR-082](./architecture-decisions/ADR-082-platform-migrations-warn-never-rewrite.md) | The platform reports its own breaking changes in code it does not own, and never rewrites that code | Codegen / ownership / DX | Implemented |
| [ADR-083](./architecture-decisions/ADR-083-runtime-barrel-stays-polyglot.md) | The runtime barrel carries no framework; the specialized abstracts live behind subpaths | Runtime / packaging / framework boundary | Implemented |

<!-- END GENERATED: adr-index -->

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

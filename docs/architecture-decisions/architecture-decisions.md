# Architecture Decision Records

> Canonical index of all ADRs for seans-mfe-tool.
> Each entry links to its individual file. Full narrative, context, and code examples live there.
> Numbers are sequential starting at ADR-001 (the abandoned Agent Orchestrator and MFE Orchestration Service eras were deleted; history is preserved in git).

For ADR governance rules see [CLAUDE.md](../../CLAUDE.md#adr-governance).

---

## DSL Contract era (ADR-001 – ADR-014)

| ADR | Title | Area | Status |
|-----|-------|------|--------|
| [ADR-001](ADR-001-lifecycle-reentrancy-guard.md) | Lifecycle Re-Entrancy Guard in BaseMFE | Runtime lifecycle | Accepted |
| [ADR-002](ADR-002-lifecycle-hook-execution-model.md) | Lifecycle Hook Execution Model | Runtime lifecycle | Implemented |
| [ADR-003](ADR-003-no-custom-lifecycle-phases.md) | No Custom Lifecycle Phases | DSL / lifecycle | Implemented |
| [ADR-004](ADR-004-handler-array-support.md) | Handler Array Support | DSL / lifecycle | Implemented |
| [ADR-005](ADR-005-handler-discovery-convention.md) | Handler Discovery Convention | DSL / handlers | Implemented |
| [ADR-006](ADR-006-unified-type-system.md) | Unified Type System | DSL / types | Implemented |
| [ADR-007](ADR-007-authorization-expression-grammar.md) | Authorization Expression Grammar | DSL / security | Deferred |
| [ADR-008](ADR-008-data-type-metadata.md) | Data Type Metadata | DSL | Implemented |
| [ADR-009](ADR-009-language-field-template-selection.md) | Language Field and Template Selection | Codegen | Implemented |
| [ADR-010](ADR-010-data-lifecycle-alignment.md) | Data Lifecycle Alignment | DSL | Implemented |
| [ADR-011](ADR-011-generated-from-traceability.md) | GeneratedFrom Traceability | DSL | Implemented |
| [ADR-012](ADR-012-graphql-mesh-bff-layer.md) | GraphQL Mesh for BFF Layer | BFF | Implemented |
| [ADR-013](ADR-013-generated-mfe-test-templates.md) | Generated MFE Test Templates | Codegen / testing | Implemented |
| [ADR-014](ADR-014-incremental-typescript-migration.md) | Incremental TypeScript Migration | Codebase | Implemented |

---

## oclif CLI + Contracts era (ADR-015 – ADR-023)

| ADR | Title | Area | Status |
|-----|-------|------|--------|
| [ADR-015](ADR-015-oclif-migration.md) | oclif as CLI framework — replace Commander | CLI | Accepted |
| [ADR-016](ADR-016-base-command-pattern.md) | BaseCommand pattern | CLI / contracts | Accepted |
| [ADR-017](ADR-017-typed-error-hierarchy.md) | Typed error hierarchy | CLI / contracts | Accepted |
| [ADR-018](ADR-018-command-result-envelope.md) | CommandResult\<T\> JSON envelope | CLI / contracts | Accepted |
| [ADR-019](ADR-019-mcp-child-process-isolation.md) | MCP child-process isolation | MCP | Accepted |
| [ADR-020](ADR-020-bun-node-split.md) | Bun for dev, Node for publish | CLI dev workflow | Accepted |
| [ADR-021](ADR-021-package-namespace-strategy.md) | Package namespace strategy | Packages | Accepted |
| [ADR-022](ADR-022-plugin-first-architecture.md) | Plugin-first architecture | Architecture | Accepted |
| [ADR-023](ADR-023-no-any-typescript-discipline.md) | No-any TypeScript discipline | TypeScript | Accepted |

---

## Runtime platform era (ADR-024 – ADR-032)

| ADR | Title | Area | Status |
|-----|-------|------|--------|
| [ADR-024](ADR-024-platform-handler-library.md) | Platform Handler Library Standardization | Runtime handlers | Planned |
| [ADR-025](ADR-025-platform-handler-interface.md) | Platform Handler Interface & Execution Model | Runtime handlers | In Progress |
| [ADR-026](ADR-026-load-capability-atomic.md) | Load Capability — Atomic Operation Design | Runtime lifecycle | In Progress |
| [ADR-027](ADR-027-mesh-v0100-plugins.md) | GraphQL Mesh v0.100.x with Production Plugins & Transforms | BFF layer | Implemented |
| [ADR-028](ADR-028-parallel-execution.md) | Parallel Handler Execution with Context Isolation | Lifecycle engine | Proposed |
| [ADR-029](ADR-029-timeout-protection.md) | Timeout Protection with AbortSignal | Lifecycle engine | Proposed |
| [ADR-030](ADR-030-error-classification.md) | Error Classification with Hybrid Detection | Lifecycle engine | Proposed |
| [ADR-031](ADR-031-conditional-execution.md) | Conditional Execution with Jexl Expression Engine | Lifecycle engine | Proposed |
| [ADR-032](ADR-032-inter-hook-communication.md) | Inter-Hook Communication with TypeScript Code Generation | Lifecycle engine | Proposed |

---

## Architecture, DevX & Process (ADR-033 – ADR-039)

| ADR | Title | Area | Status |
|-----|-------|------|--------|
| [ADR-033](ADR-033-two-headed-giant-developer-model.md) | Two-headed giant — AI-native + human-legible DX | Developer model | Accepted |
| [ADR-034](ADR-034-pluggable-bundler-framework.md) | Pluggable bundler + framework via codegen variants | Codegen / polyglot | Accepted |
| [ADR-035](ADR-035-docker-turborepo-integration.md) | Docker Build Orchestration via Turborepo Task Graph | Docker / CI | Accepted |
| [ADR-036](ADR-036-framework-plugins.md) | Framework plugin system — BaseFrameworkPlugin + loadFrameworkPlugin() | Build / codegen / deploy | Accepted |
| [ADR-037](ADR-037-tdd-always.md) | TDD-always development discipline | Process | Accepted |
| [ADR-038](ADR-038-conventional-commits-branch-discipline.md) | Conventional Commits and branch naming | Process | Accepted |
| [ADR-039](ADR-039-structured-logger-no-console-log.md) | Structured logger — no console.log in production code | CLI / logging | Accepted |
| [ADR-040](ADR-040-manifest-declared-handler-sources.md) | Manifest-Declared Handler Sources | DSL / handlers / codegen | Accepted |

---

## Runtime contract & codegen spine (ADR-041 – ADR-043)

| ADR | Title | Area | Status |
|-----|-------|------|--------|
| [ADR-041](ADR-041-base-mfe-abstract-base.md) | BaseMFE Abstract Base Class & Platform Capability Contract | Runtime / base-class | Accepted |
| [ADR-042](ADR-042-mfe-lifecycle-state-machine.md) | MFE Lifecycle State Machine | Runtime lifecycle | Accepted |
| [ADR-043](ADR-043-manifest-driven-codegen.md) | Manifest-Driven Code Generation Pipeline | Codegen / DSL | Accepted |

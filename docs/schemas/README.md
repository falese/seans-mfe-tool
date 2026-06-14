# Types & Schema — Platform Pillar 2

The platform treats its type system as a first-class architectural pillar. Every data
contract — from the DSL manifest that defines an MFE, to the CLI envelope that wraps
every command response, to the wire protocol between daemon and renderer — is captured
as a versioned, validated, documented type rather than an implicit convention.

This directory is the single navigable reference for all platform schemas. Types are
defined once (in source) and this documentation is derived from them; do not add fields
here that do not exist in the implementation.

## Why a type pillar?

| Problem | Type-pillar answer |
|---|---|
| Docs drift from code | Types are the docs; prose follows types |
| Runtime surprises | Every boundary is validated (Zod at ingress, TypeScript at build time) |
| Cross-team integration | A published `@seans-mfe/contracts` package is the shared vocabulary |
| Framework diversity | Open-string fields (`framework`, `bundler`) accept unknown values; guards reject structurally invalid payloads |

## Two domains

The pillar spans two distinct domains. Keep them separate in your mental model:

### Domain A — DSL types (manifest-time)

Defined in `src/dsl/` (Zod) and validated when a manifest is parsed or a command is
run. These types describe what an MFE **is** and what it **declares**.

| Sub-document | What it covers |
|---|---|
| [DSL manifest fields](dsl-manifest.md) | Every `mfe-manifest.yaml` field — required, optional, enums, nested objects |
| [DSL type system](dsl-types.md) | How capability inputs/outputs are typed (`string!`, `array<User!>!`, etc.) |

### Domain B — Platform contract types (runtime)

Exported from `packages/contracts/` and shared across the CLI, daemon, registry, and
renderer. These types describe what the platform **does** and what flows over the wire.

| Sub-document | What it covers |
|---|---|
| [CLI envelope](envelope.md) | `CommandResult<T>` shape, exit codes, `--json` mode contract |
| [Error hierarchy](errors.md) | `ValidationError` → `SecurityError` class ladder and the classifier |
| [Control-plane messages](control-plane-messages.md) | Daemon ↔ registry ↔ renderer wire protocol |
| [Presentation contracts](presentation.md) | `PresentationHandle` thin waist — imperative floor + native upgrade |
| [Framework plugin interface](framework-plugin.md) | `BaseFrameworkPlugin` abstract — the contract every framework plugin implements |
| [Control plane interface](control-plane.md) | `BaseControlPlane` abstract — daemon + registry + LayoutManager bundled under a three-line host API |

## Governing ADRs

| ADR | Decision |
|---|---|
| ADR-006 | Unified type system — DSL is the single source of truth |
| ADR-008 | Type metadata (`owner`, `tags`) |
| ADR-010 | Data lifecycle alignment |
| ADR-011 | `generatedFrom` traceability |
| ADR-018 | CLI JSON envelope format |
| ADR-030 | Error classification strategy |
| ADR-036 | Open-string `framework`/`bundler` fields |
| ADR-040 | Manifest-declared handler sources |
| ADR-043 | Manifest as codegen source of truth |
| ADR-053 | Control-plane message protocol |
| ADR-054 | Isomorphic correlation ID (no Node `crypto` import) |
| ADR-055 | Module Federation experience output shape |
| ADR-056 | Presentation handle thin waist |
| ADR-057 | Virtualized daemon socket (DaemonChannel) |
| ADR-058 | Slot-provider MFEs |
| ADR-059 | BaseControlPlane abstract base |

## Authoritative source locations

| Schema | Source file |
|---|---|
| DSL manifest | `src/dsl/schema.ts` (Zod, inferred TypeScript) |
| DSL type parser | `src/dsl/type-system.ts` |
| CLI envelope | `packages/contracts/src/envelope.ts` |
| Error classes | `packages/contracts/src/errors/` |
| Error classifier | `packages/contracts/src/error-classifier.ts` |
| Control-plane messages | `packages/contracts/src/messages.ts` |
| Presentation handles | `packages/contracts/src/presentation.ts` |
| Framework plugin base | `packages/contracts/src/framework-plugin.ts` |
| Control plane base | `src/runtime/base-control-plane.ts` |
| Generated command schemas | `schemas/*.json` (machine-generated — never hand-edit) |

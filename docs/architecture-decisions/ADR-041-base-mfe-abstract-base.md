---
id: 0041
title: BaseMFE Abstract Base Class & Platform Capability Contract
status: Accepted
date: 2026-05-28
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [runtime, base-class, lifecycle, capabilities, contract]
summary: All MFEs extend a single `BaseMFE` abstract class that owns lifecycle orchestration, state management, and handler dispatch, and exposes exactly ten platform capabilities. Subclasses differ only by the content of their abstract `do*()` overrides — not by introducing new capabilities or a parallel type hierarchy.
rationale-summary: A single abstract base keeps the platform lifecycle contract identical across every delivery mechanism (rspack/React, webpack/Angular, future ESM/iframe/web-component variants); the "what" is fixed in the base, only the "how" varies per subclass via `do*()`.
long-form: true
---

# ADR-041: BaseMFE Abstract Base Class & Platform Capability Contract

## Context

Every generated MFE — regardless of framework, bundler, or delivery
mechanism — must expose the same platform lifecycle to a shell or daemon:
load, render, refresh, authorize, report health, describe itself, expose a
schema, answer queries, emit telemetry, and push control-plane state. The
shell composes capabilities without knowing how any of them were built
(`CLAUDE.md`, "Framework-agnostic runtime contract").

This decision was made early in the runtime platform's life and is
implemented in `src/runtime/base-mfe.ts`, but its ADR was lost during the
ADR library reflow into 001–040 (PR #194). The class header still carries a
dangling reference — `Following ADR-013: BaseMFE Abstract Base (Not Type
Hierarchy)` — to a number that now belongs to "Generated MFE Test
Templates." There is currently **no ADR of record** for the most
foundational runtime decision in the repo. This ADR re-establishes it and
the code comment is repointed to ADR-041.

Two shapes were possible:

1. **A type hierarchy** — distinct base classes per MFE *type* (`ToolMFE`,
   `DomainMFE`, …), each with its own method set.
2. **A single abstract base** — one `BaseMFE` whose abstract `do*()` methods
   are the only thing subclasses fill in; MFE *type* and *framework* affect
   the generated *content* of those methods, not the class shape.

## Decision

There is exactly one runtime base class: **`BaseMFE` (abstract)**. The class
hierarchy is intentionally shallow:

```
BaseMFE (abstract)
  ├── RemoteMFE          — React / rspack Module Federation
  └── AngularRemoteMFE   — Angular / webpack Module Federation
```

`BaseMFE` owns the **platform responsibilities** (`base-mfe.ts:189-203`):

- Lifecycle orchestration (`before → main → after/error` hooks, ADR-002).
- State management and transition validation (ADR-042).
- Re-entrancy protection (ADR-001).
- Telemetry emission on hook failure.
- Handler dispatch — `platform.*` library handlers, `customHandlers` DI map,
  and method reflection (ADR-024, ADR-025, ADR-040).

Subclasses (and domain teams) own the **developer responsibilities**: they
implement the abstract `do*()` methods. The platform contract is **exactly
ten capabilities**, each a public orchestrated method on `BaseMFE` backed by
one abstract `do*()` override:

| Public capability | Abstract method | Purpose |
|---|---|---|
| `load()` | `doLoad()` | Initialize runtime — fetch `remoteEntry.js`, init the federation container |
| `render()` | `doRender()` | Mount the component into the DOM container |
| `refresh()` | `doRefresh()` | Reload data and re-render without unmounting |
| `authorizeAccess()` | `doAuthorizeAccess()` | Validate JWT, evaluate permissions |
| `health()` | `doHealth()` | Report liveness/readiness |
| `describe()` | `doDescribe()` | Return manifest metadata |
| `schema()` | `doSchema()` | Return the capability input/output schema |
| `query()` | `doQuery()` | Execute a read-only domain query |
| `emit()` | `doEmit()` | Publish a domain event/telemetry |
| `updateControlPlaneState()` | `doUpdateControlPlaneState()` | Push state to the orchestration layer |

The public method is the **orchestrated** entry point: it asserts the
required state (ADR-042), runs the lifecycle phases around the `do*()` body,
and transitions state on success/failure. The `do*()` method is the **only**
thing a subclass or generated MFE overrides. Adding a framework is a new
*subclass + template variant* (ADR-034, ADR-036); it never adds a capability.

`doEmit` is the one method dispatched with a runtime existence check rather
than pure `abstract` enforcement (`base-mfe.ts:736-740`), so an MFE that does
not emit telemetry fails loudly only if `emit()` is actually called.

## Consequences

- The platform lifecycle contract is identical across every delivery
  mechanism. A shell can drive any MFE through the same ten methods.
- New frameworks cost a template variant and a thin subclass, not a new
  contract — this is what makes the marketplace thesis (PDR-006) tractable.
- The capability set is closed. Proposals to add an eleventh capability are
  architectural changes that require a new ADR, not a subclass override.
- Generated code stays small: codegen only fills `do*()` bodies and lifecycle
  stubs; orchestration, state, and dispatch are inherited, never regenerated.
- The dangling `ADR-013` reference in `base-mfe.ts` is corrected to ADR-041.

## Alternatives Considered

- **Per-type class hierarchy (`ToolMFE`, `DomainMFE`, …)** — rejected. MFE
  `type` is a manifest field that changes generated method *content*, not the
  surface a shell talks to. Distinct base classes would fragment the contract
  and force the shell to branch on type.
- **Interface-only contract (no shared base)** — rejected. Lifecycle
  orchestration, re-entrancy guarding, state validation, and handler dispatch
  are cross-cutting and identical for every MFE; duplicating them per
  implementation guarantees drift.
- **Composition over inheritance (mix-ins per capability)** — rejected for v1.
  The ten capabilities are a fixed, cohesive contract; the simplicity of one
  abstract base with ten `do*()` slots outweighs the flexibility of opt-in
  mix-ins, and keeps generated code legible (ADR-033).

## Traceability

- ADR-001: Lifecycle Re-Entrancy Guard in BaseMFE
- ADR-002: Lifecycle Hook Execution Model
- ADR-042: MFE Lifecycle State Machine (state assertions/transitions used here)
- ADR-024 / ADR-025 / ADR-040: handler library, interface, and sources
- ADR-034 / ADR-036: framework/bundler variants and framework plugins
- REQ-042, REQ-056, REQ-057
- Files:
  - `src/runtime/base-mfe.ts` — `abstract class BaseMFE`, the ten `do*()`
    methods (`:795-852`), public orchestrated capabilities (`:579-795`)
  - `src/runtime/remote-mfe.ts` — `RemoteMFE` (React/rspack)
  - `src/runtime/angular-remote-mfe.ts` — `AngularRemoteMFE` (Angular/webpack)
  - `PLATFORM-CONTRACT.md` — long-form capability reference

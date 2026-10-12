---
id: 0108
title: >-
  The LayoutManager is the only thing that mounts an MFE — no host-side component may drive a
  presentation handle itself
status: Implemented
date: 2026-10-12
deciders: [sean]
area: Runtime / composition / mounting
enforcement: code
tags: [runtime, layout-manager, composition, react, boundary]
relates-to: [55, 56, 57, 58, 60, 66, 82]
supersedes: []
superseded-by: []
implements-pdr: [5]
implemented-by:
  - packages/runtime/src/layout-adaptors.ts
  - packages/framework-react/src/runtime/index.ts
  - packages/codegen/src/platform-migrations.ts
verified-by:
  - src/__tests__/layout-manager-sole-mounter.test.ts
  - packages/codegen/src/__tests__/platform-migrations.test.ts
tracked-by: ["#407"]
summary: >-
  An MFE's imperative presentation handle is mounted only by the content-type adaptor the
  LayoutManager hands each experience to. `@seans-mfe/framework-react`'s `MfeHost` and `useMfe`,
  which called `handle.mount` themselves, are removed. A repository test fails if anything other
  than `packages/runtime/src/layout-adaptors.ts` calls a presentation handle's `mount`, and the
  `mfe-host-removed` platform migration names any remaining use in developer-owned code. This
  replaces ADR-056 Decision item 4.
rationale-summary: >-
  Every guarantee a mounted slot gets — slot state, slot-scoped error isolation and escalation,
  slot ownership and provided slots, per-slot daemon channels, and boundary stamps — lives on the
  LayoutManager path. A second mounter silently opts out of all of them, and nothing used it. One
  mounter keeps those guarantees universal and gives every later boundary feature exactly one
  place to land.
long-form: true
---

## Context

ADR-056 Decision item 4 specified React host providers, `useMfe(experienceId)` and
`<MfeHost experienceId=… />`, as "thin shells over the same provider; neither touches the
core." What shipped in `packages/framework-react/src/runtime/MfeHost.tsx` took a raw handle
and called `handle.mount(element, …)` itself. That made it a second mounting path that bypassed:

- `data-layout-slot` / `data-slot-state` (ADR-060)
- slot-scoped error isolation and escalation to the control plane (ADR-060)
- slot ownership and provided-slot registration (ADR-058, ADR-066)
- per-slot daemon channels (ADR-057)
- value-injected host context (ADR-060)

ADR-060 then rejected the in-tree React provider these surfaces were scaffolding toward.
Nothing used them: both reference shells mount only through the LayoutManager, and no template
or generated MFE references them (#407).

## Decision

### 1. One mounter

Only the LayoutManager's content-type adaptors (`packages/runtime/src/layout-adaptors.ts`)
call an MFE's presentation handle `mount`. A React shell gets the same result by giving the
LayoutManager a container element.

### 2. The bypass is removed

`MfeHost`, `useMfe` and their types (`MfeHostProps`, `UseMfeOptions`, `MfeHandleInput`) are
removed from `@seans-mfe/framework-react/runtime`. `DeclaredSlot` and `useControlPlaneState`
remain: they register slots and push state through the platform rather than mount anything.

### 3. Enforced by a test

`src/__tests__/layout-manager-sole-mounter.test.ts` scans `src`, `packages` and `examples`
(`.ts`, `.tsx`, `.ejs`) and fails on any `handle.mount(` / `handles.imperative.mount(` call
outside `layout-adaptors.ts`. It also asserts it still finds the sanctioned call, so it
cannot pass by matching nothing.

### 4. Outside users are told

The `mfe-host-removed` entry in `PLATFORM_MIGRATIONS` (ADR-082) is an error on arrival. It
matches a use of any removed name in developer-owned code and gives the LayoutManager
replacement as its fix.

## Boundaries

- This ADR governs who mounts. It does not change what an adaptor does, or how an MFE
  implements its own `mount` (the Rust/wasm remote entry's `m.mount` is the MFE's side of the
  port, not a host calling it).
- ADR-056's remaining items stand. Its file is not edited; this ADR replaces item 4 only.

## Consequences

Every mounted MFE gets the same slot guarantees, and future boundary features (the
`data-smt-*` stamps in #408) have a single place to land. The cost is a breaking removal from a
published package. It's mitigated by the migration entry and by there being no known consumer.

## References

- ADR-056 — item 4 (React host providers) is replaced by this decision.
- ADR-060 — contextualized VM composition: the guarantees the bypass skipped.
- ADR-055 — the LayoutManager drives every shell.
- ADR-057, ADR-058, ADR-066 — per-slot channels, provided slots, stable slot addressing.
- ADR-082 — platform migrations; the `mfe-host-removed` entry.
- #407 — this work; #408 — the boundary stamps that depend on it.

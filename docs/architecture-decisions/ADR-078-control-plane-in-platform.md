---
id: 0078
title: The control plane ships in the platform, and a composition environment is generated from a manifest
status: Proposed
impl:
  stage: deferred
  refs: ["#139"]
date: 2026-07-26
deciders: [sean]
area: Control plane / codegen / packaging
enforcement: code
tags: [control-plane, registry, daemon, codegen, packaging, persistence, drift]
relates-to: [54, 55, 57, 59, 60, 66, 73, 74, 77]
supersedes: []
superseded-by: []
implements-pdr: [5]
implemented-by: []
verified-by: []
tracked-by: ["#139"]
summary: >-
  The registry and daemon move from a vendored copy inside each reference app into
  `packages/control-plane`, and `platform:init` generates a runnable composition environment —
  generic daemon-driven shell, compose topology, control-plane config, seeded rules — from a
  control-plane manifest. Persistence becomes a manifest field rather than a fork of the
  registry, and `@falese/daemon` is retired.
rationale-summary: >-
  The registry (526 LOC) and daemon (770 LOC) are byte-identical copies in two reference apps,
  each carrying a header saying the canonical version lives in another repo. That is the
  hand-copied-restatement pattern ADR-074 exists to eliminate, sitting inside the examples the
  platform uses to prove itself. Making the control plane a package and its topology a generated
  artifact applies the platform's own thesis to its own runtime.
long-form: true
---

# ADR-078: The control plane ships in the platform

## Context

Every MFE in the fleet is generated from a manifest and held in place by a drift gate. The thing
that *composes* them is not.

`examples/abc-kids/control-plane/` and `examples/meridian-station/control-plane/` each contain a
526-line `simple-registry.js` and a 770-line `simple-daemon.js`. `diff` reports them
**byte-identical**. Both carry the same header:

> This is a demo-scoped copy for the abc-kids fleet — the canonical implementation lives in
> falese/daemon; reconcile against upstream when it changes.

"Reconcile against upstream when it changes" is a manual drift process, of exactly the kind the
platform has spent the last two months replacing with gates. It sits in the middle of the two
reference apps that exist to demonstrate the platform's discipline.

Three further consequences follow from the control plane living outside the platform:

**The shells are hand-written.** ADR-033 §"Shell first-class" complained about this in April and
proposed `shell:init` (#144). PR #153 attempted it and was closed as a stale draft. Both reference
shells are still hand-written today, and `examples/abc-kids/shell/` has no `mfe-manifest.yaml` at
all. A new adopter's only path to a working shell is to copy one out of an example.

**#144's original spec is now wrong.** It proposed generating a host with static `remotes[]` and a
manifest-derived `remotes.d.ts`. ADR-055 subsequently made shells daemon-driven: Meridian's shell
ships `remotes: {}` and its `App.tsx` states it "knows NOTHING about which MFEs exist". Generating
static remotes would regress the architecture.

**Persistence has nowhere to live.** The registry is in-memory with a 10-minute component TTL.
Registrations and rules do not survive a restart. Adding storage to a vendored copy would fork it
twice over.

PDR-005 (runtime composition via shell + daemon control plane + registry) is still `Proposed`
despite 20+ ADRs implementing it, because `docs/product-decisions/BACKLOG.md` gates its promotion
on PR #153 — which was closed, not merged. That condition can never be met as written.

## Decision

### 1. The registry and daemon become `packages/control-plane`

Promoted from the vendored copies, not rewritten. `packages/runtime/src/base-control-plane.ts`
(ADR-059) already owns the abstract shape; this package provides the concrete registry and daemon
that the shape describes. Both reference apps consume the package, and the two 1,296-line copies
are deleted.

`@falese/daemon` is retired. This narrows PDR-004's plugin-first stance — see PDR-008 — and does
so for the daemon only; coder remains a plugin.

### 2. A control-plane manifest, with persistence as configuration

The control plane is described by a manifest in the same DSL as everything else, and its storage
is a field in that manifest rather than a code change:

```yaml
persistence:
  driver: memory   # memory | mongo
```

The driver interface sits behind the registry's existing component/rule/registration store. A
`mongo` driver adds a compose service and a connection string; it does not add a second registry.

### 3. `platform:init` generates the composition environment

One command scaffolds a runnable system: the generic shell
(ADR-055 — LayoutManager daemon-driven slot composition, so no static remotes and no
`remotes.d.ts`), the compose topology including registry, daemon, and the configured persistence
service, the control-plane configuration, and a seeded `rules.json`.

The generated project owns its *composition* — its topology and its placement rules. It never owns
the registry's or the daemon's source.

### 4. Generated registration, per ADR-074

`platform:init`'s seeded rules carry generated `registration` blocks and hand-authored `routes`.
Placement stays an operator decision because it is not derivable; registration is derivable and is
therefore generated.

## Boundaries

This does not change the control-plane message protocol (ADR-054), the LayoutManager (ADR-055),
the slot contract (ADR-066–073), or the virtualized socket (ADR-057). It changes where the
implementation lives and how a project acquires one.

It does not make the control plane a production deployment target. ADR-062 keeps production
deployment a plugin axis, and `platform:init` generates a development composition — the same
scope `deploy` has today.

Retiring `@falese/daemon` is a cross-repo action outside this repository's gates. This ADR records
the decision; the migration is tracked separately.

`persistence.driver: mongo` is a durability decision, not a scaling one. Nothing here claims the
registry is horizontally scalable.

## Consequences

**Better.** The last hand-copied artifact in the reference apps disappears. A fix to the registry
reaches both fleets by version bump instead of by remembering to copy it twice.

**Better.** A new adopter runs one command instead of copying a shell out of an example and
hand-wiring a control plane. This is the concrete unblocking of PDR-005's promotion condition,
which PDR-008 rewrites against `platform:init` instead of the closed PR #153.

**Better.** Durable registrations become a manifest field, which means the demo and the durable
configuration are the same artifact with one line different.

**Worse.** This repository takes on a long-running process it did not previously own — a daemon
and a registry are operationally different from a CLI, with their own failure modes, and
`packages/control-plane` will need its own test and release discipline.

**Worse.** It narrows PDR-004. The plugin-first architecture stays, but with a named exception,
and exceptions to an architectural stance are load-bearing precedent. PDR-008 states the boundary
explicitly so the exception does not generalise by drift.

**Cost accepted.** Vendored copies are trivially hackable; a package is not. Teams that patched
their control plane in place will have to contribute upstream or configure instead.

## References

- ADR-074 — registration is a build artifact; the generate-don't-check principle this applies to
  the control plane itself.
- ADR-055 — LayoutManager and daemon-driven shells; the reason #144's static-remotes spec is
  rewritten rather than implemented.
- ADR-059 — `BaseControlPlane`, the abstract shape this package's concrete implementation fills.
- ADR-054 — the control-plane message protocol, unchanged by this decision.
- ADR-062 — production deployment is a plugin axis; bounds what `platform:init` generates.
- ADR-077 — the two-headed giant's re-derived implementation plan, which splits this work out
  from agent-contract completion.
- PDR-005 — runtime composition; its promotion condition is unblocked by `platform:init`.
- PDR-008 — the product decision to bring the control plane into the platform.
- #139 — the epic this work is split out of.

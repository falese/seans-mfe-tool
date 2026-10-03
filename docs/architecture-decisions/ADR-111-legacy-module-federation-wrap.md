---
id: 0111
title: >-
  During decomposition the monolith runs as one generated SMT MFE, wrapped by Module Federation,
  and composes through the existing adaptor — no special legacy path in the runtime
status: Proposed
date: 2026-10-03
deciders: [sean]
area: Decomposition / strangler
enforcement: tooling
tags: [decomposition, strangler, module-federation, legacy, composition]
relates-to: [55, 56, 60, 83, 110]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by: []
verified-by: []
tracked-by: ["#410", "#417", "#419"]
summary: >-
  The agent adds a Module Federation remote entry to the monolith's own build and generates a
  normal SMT MFE, `legacy-<app>`, whose single capability renders the monolith's root. The shell
  places that capability like any other, through the `moduleFederation` adaptor and the
  LayoutManager. Strangling is then ordinary composition: one placement at a time moves from the
  legacy capability to a new MFE's capability in `control-plane.yaml`.
rationale-summary: >-
  Making the monolith a first-class MFE keeps the runtime free of a legacy special case, keeps
  every mount on the LayoutManager path, and turns each strangler step into a one-line
  composition change that the parity gate can check. An iframe adaptor would work with no build
  change but isolates context and styling more than an incremental migration can tolerate.
long-form: true
---

## Context

PDR-011 strangles the monolith rather than replacing it in one cut. The runtime composes only
through the LayoutManager and its content-type adaptors (ADR-055; sole mounter per #407). It
has no legacy or iframe content type.

## Decision

### 1. The monolith becomes a generated MFE

`decompose:scaffold` generates `legacy-<app>` with one domain capability that mounts the
monolith's root component, and adds a Module Federation remote entry to the monolith's
bundler config so the shell can load it.

### 2. It composes like any other MFE

No new adaptor, content type or runtime branch. Host context reaches it by value injection
(ADR-060), as for any island.

### 3. Strangling is composition

The initial `control-plane.yaml` places the legacy capability everywhere. Each step moves one
placement to a new MFE's capability and recompiles `rules.json`; the parity gate runs after
each step.

## Boundaries

- The monolith's bundler must be able to emit a Module Federation remote; v1 targets React
  SPAs whose build can take the federation plugin.
- The monolith keeps its own internal routing until routing is mapped to state keys; that
  mapping is a separate track.

## Consequences

The runtime stays uniform and each migration step is small and reversible. The cost is a
change to the monolith's build, and shared singletons (React, router) must be reconciled in
federation `shared` config.

## References

- PDR-011 — the product decision this serves.
- ADR-055 — the LayoutManager drives every shell.
- ADR-060 — contextualized VM composition: host context reaches the island by value-injection.
- ADR-083 — composition is a compiled document; strangler steps edit it.
- #407 — the LayoutManager is the sole mounter.
- #417, #419 — scaffold and the strangle loop.

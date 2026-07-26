---
id: 0008
title: The control plane is part of the platform, not a plugin
status: Accepted
date: 2026-07-26
deciders: [sean]
supersedes: []
superseded-by: []
tags: [control-plane, packaging, runtime, composition]
summary: The registry and daemon ship inside seans-mfe-tool rather than as a separate repo and plugin; this narrows PDR-004's plugin-first stance for the composition runtime only, because a shell without a control plane is not a runnable system.
---

# PDR-008: The control plane is part of the platform, not a plugin

## Problem space

PDR-004 made the platform plugin-first: shared contracts in published packages, the daemon and
coder as oclif plugins, the CLI as integration hub. For coder that has held. For the control
plane it has not, and the evidence is sitting in the repository.

Both reference apps vendor a copy of the registry and daemon —
`examples/abc-kids/control-plane/` and `examples/meridian-station/control-plane/` — and the copies
are **byte-identical**: a 526-line registry and a 770-line daemon, duplicated, each headed with a
note that the canonical version lives in `falese/daemon` and should be "reconciled against
upstream when it changes."

Nobody vendored those files out of laziness. They are there because **a shell without a control
plane is not a runnable system**. Under ADR-055 the shell composes whatever the registry resolves;
with no registry there is nothing to compose and nothing to demo. So every attempt to show the
platform working has had to bring a control plane along, and the only mechanism available for
that — a plugin in another repo — could not be depended on from an example. The copy was the
workaround.

The costs are now concrete. Both reference shells are still hand-written fifteen months after
ADR-033 named that a problem, because `shell:init` (#144) needs a control plane to generate
alongside the shell and PR #153 was closed rather than solved. Registrations and rules are
in-memory with a 10-minute TTL and do not survive a restart, because adding storage would mean
forking a vendored copy twice. And PDR-005 — the decision that *describes* this runtime — is
still `Proposed` despite twenty-odd ADRs implementing it, because its promotion was gated on PR
#153 landing, which can no longer happen.

Meanwhile the platform spent two months eliminating exactly this pattern everywhere else. ADR-074:
*"Generating it removes the disagreement rather than checking for it."* The control plane is the
last hand-copied restatement in the repository, and it is in the examples that exist to prove the
platform's discipline.

## Decision

**The composition runtime ships with the platform.** The registry and daemon move into
`packages/control-plane`; `platform:init` generates a runnable composition environment — generic
daemon-driven shell, compose topology, control-plane configuration, seeded placement rules — from
a manifest, with persistence selected by a manifest field rather than by forking the registry.
`@falese/daemon` is retired.

This narrows PDR-004 for one component. Plugin-first remains the stance for everything that
*extends* the platform: frameworks, BFF, API generation, deploy targets, coder. The control plane
is not an extension — it is the runtime the platform's own composition model requires in order to
run at all.

## Why this over alternatives

- **Keep it a plugin and publish it properly (rejected).** This is PDR-004 executed faithfully, and
  it would fix the vendoring. But it leaves a scaffolded project's ability to run gated on
  installing a plugin from another repo, and it means `platform:init` — the command whose whole
  job is to produce something runnable — cannot guarantee it produced something runnable. The
  dependency is not optional, so modelling it as optional is the mistake.
- **Leave the vendored copies and add a drift gate (rejected).** Cheap, and consistent with how
  the platform handles other two-sided artifacts. But ADR-074 already settled the tie-breaker:
  when one side is a pure restatement of the other, generate it rather than check it. Two
  byte-identical copies of the same 1,296 lines are not two artifacts that must exist separately.

## Success signals

- A new adopter goes from nothing to a composing shell with one command, without copying a
  directory out of `examples/`.
- A registry fix reaches both reference fleets by version bump, and `diff` between the two
  `control-plane/` directories has nothing left to compare because the directories are gone.
- Switching a demo to durable storage is a one-line manifest change, not a code change.
- PDR-005 can be promoted to `Accepted` against a condition that is actually reachable.

## Consequences / trade-offs

- **Positive:** The reference apps stop containing the anti-pattern the platform teaches against.
- **Positive:** `shell:init` becomes tractable — it was blocked on having a control plane to
  generate alongside the shell, which is why #144 stalled and #153 closed.
- **Negative:** This repository takes ownership of a long-running process. A daemon and a registry
  have operational failure modes a CLI does not, and they need their own release and test
  discipline.
- **Negative:** It creates a named exception to PDR-004. Exceptions to an architectural stance are
  precedent, so the boundary is stated explicitly above: extensions are plugins; the composition
  runtime is not an extension. Anything that reaches for this precedent has to argue that it, too,
  is required for the platform to run at all.
- **Neutral:** `docs/MERGE-PLAN.md` Phase 2 (monorepo consolidation) is pulled forward for one
  component. The rest of the merge plan is unaffected and stays gated on contract publication.

## Implemented by

- ADRs: ADR-078 (control plane in the platform; control-plane manifest; `platform:init`),
  ADR-077 (the epic split that separates this from agent-contract work).
- Related: PDR-004 (plugin-first — narrowed, not replaced), PDR-005 (runtime composition — its
  promotion condition is rewritten against `platform:init`), PDR-001 (generate, don't hand-write —
  the principle this applies to the control plane).
- Code: `packages/control-plane/` (to be created), `packages/runtime/src/base-control-plane.ts`
  (ADR-059, the abstract shape already in place).
- Issues: #139 (the epic being split), #144 (`shell:init`, rewritten into `platform:init`).

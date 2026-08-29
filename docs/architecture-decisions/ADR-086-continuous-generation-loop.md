---
id: 0086
title: The generation loop closes on the existing CI gates; continuous deployment waits on registry persistence
status: Proposed
date: 2026-08-29
deciders: [sean]
area: CI-CD / control plane / generation
enforcement: convention
tags: [generative, ci-cd, control-plane, deployment, drift, registry, persistence]
relates-to: [78, 83, 62, 84]
supersedes: []
superseded-by: []
implements-pdr: [9]
implemented-by: []
verified-by: []
tracked-by: ["#139"]
summary: >-
  The source side of the continuous-generation loop needs no new gate: a generated
  manifest is integrated the moment it passes the drift, compose and slots checks
  already in `test.yml`, which are therefore the acceptance oracle. The deployment side
  is a named gap — there is no workflow that builds the control-plane/MFE images or
  applies `rules.json` to a live registry — and it is sequenced *after* registry
  persistence (#139) so registrations survive restart and can be drift-reconciled
  against the committed payload rather than replayed by hand.
rationale-summary: >-
  The platform already treats composition drift as a CI-gated invariant, so continuous
  *integration* of generated manifests is free — reuse the gates as the oracle. But the
  registry is in-memory and registration is a manual script (`register-station.sh`),
  so building continuous *deployment* on top of it would mean re-registering on every
  restart with no source of truth to reconcile against. Persistence (#139) is the
  precondition that turns `rules.json` into a desired state a deploy step can apply and
  a check can diff, so the CD half is ordered behind it deliberately.
long-form: true
---

# ADR-086: The generation loop closes on the existing CI gates; continuous deployment waits on registry persistence

## Context

PDR-009 asks for generation that is "continuously integrated and deployed". Two halves
of that already stand in very different states.

Continuous **integration** is essentially built. `.github/workflows/test.yml`'s
`quality` job already runs `check:mfe-drift:check`, `compose:validate --check`,
`slots:validate`, and `check:mfe-consistency` — the exact gates that decide whether a
manifest (hand-written or, per ADR-084, generated) is contract-conformant. A generated
manifest committed to a branch is fenced by these with no new machinery.

Continuous **deployment** does not exist. Image builds are manual fleet scripts, MFE
registration is `scripts/register-station.sh` `curl`-ing each `rules.json` entry into
the registry, and the registry (`packages/control-plane/registry/simple-registry.js`)
is **in-memory** — registrations evict on a TTL and do not survive restart (ADR-078 §2,
#139). There is no workflow that pushes images or applies composition to a running
stack, and production deploy is deliberately a plugin axis (ADR-062).

## Decision

### 1. The existing CI gates are the acceptance oracle — no new source-side gate

Integration of a generated manifest is defined as passing the drift/compose/slots/
consistency gates already in `test.yml`. This ADR adds no gate; it names those gates as
the oracle ADR-084's pipeline is validated against. Generation that fails them is not
integrated.

### 2. The CD gap is named, and its shape fixed

Continuous deployment is a workflow that (a) builds and pushes the
`packages/control-plane/{registry,daemon}` and MFE images, and (b) **applies** the
committed `rules.json` to a live registry — replacing the manual
`register-station.sh` — as a desired-state apply, not a per-restart replay.

### 3. CD is sequenced after registry persistence (#139)

The apply step and its drift reconciliation require registrations that survive restart.
Until #139 gives the registry persistence, `rules.json` cannot be treated as a desired
state the runtime converges to. So the CD half is ordered behind #139 by design; the
runtime drift check (diff live `GET /rules` against committed `rules.json`, the runtime
analogue of `compose:validate --check`) lands with it.

## Boundaries

- This ADR does not choose a CD vendor, a registry, or an image host — it fixes the
  loop's shape and its ordering dependency, not an implementation.
- It does not change the production-deploy-as-plugin-axis stance (ADR-062); the apply
  step targets the platform's own dev-grade control plane, and productionizing it
  remains a plugin concern.
- It adds no new CI gate; §1 is a naming of existing gates, not new tooling.

## Consequences

- **Better:** the integration half of PDR-009 is closed today with zero new gate; the
  deployment half has a defined shape and an honest, explicit precondition rather than
  being hand-waved as "and then it deploys".
- **Worse / the cost accepted:** the "continuously deployed" promise is genuinely
  blocked on #139 and cannot be delivered before it. Until then the loop closes at
  "merged, CI-green manifest + generated code", and deployment stays manual — a real
  limit of the current claim, stated rather than hidden.

## References

- ADR-078 — the control plane in the platform and its §2 persistence gap (#139).
- ADR-083 — `rules.json` as the compiled composition payload the apply step targets.
- ADR-062 — production deployment as a plugin axis, unchanged here.
- ADR-084 — generation targets the manifest, not source; that validated manifest is the
  artifact these gates accept.
- #139 — registry persistence, the sequencing dependency for the CD half.
- PDR-009 — the product decision this implements.

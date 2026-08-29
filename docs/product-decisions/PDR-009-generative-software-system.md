---
id: 0009
title: A generative software system — business intents compile to the platform contract, continuously
status: Accepted
date: 2026-08-29
deciders: [sean]
supersedes: []
superseded-by: []
tags: [generative, ai, intent, codegen, ci-cd, open-weights, strategy]
summary: The platform's authoring surface moves upstream from the hand-written DSL manifest to a refined business intent; a tunable open-weight model (hosted in coder) compiles that intent into a validated manifest, and the existing deterministic codegen, drift gates, and composition pipeline carry it to running MFEs — continuously integrated and, once the registry persists, continuously deployed.
---

# PDR-009: A generative software system — business intents compile to the platform contract, continuously

## Problem space

SMT has sprawled. The platform proved (PDR-006) that the marginal cost of the *N*th
MFE stays flat *once a manifest exists* — but authoring that manifest is still human
work, and it grows with the fleet. Every new capability, every fleet, every
composition route is a hand-written `mfe-manifest.yaml` / `control-plane.yaml` that a
person must get right against a large DSL. The generative surface today *begins* at
that structured YAML; there is no path from a **business intent** ("parents need a
letter-tracing game with progress that syncs to the console") to a running MFE without
a human translating intent into DSL by hand.

Two costs compound. First, the translation itself is the bottleneck PDR-006 did not
close — sprawl is manifests multiplying faster than people can author and review them.
Second, when AI *is* used to help author, it is used through a metered, hosted API:
per-token credits that scale with generation volume, which is exactly the thing a
"generate continuously" ambition maximizes.

## Decision

Make intent the authoring surface. A **refined business intent** is compiled — by a
model, not a person — into a **validated platform manifest**, and everything
downstream is the deterministic pipeline that already exists: codegen, drift gates,
composition, CI. The bet has three commitments:

1. **The manifest stays the boundary.** The model's output is a validated DSL
   document, never source code. The deterministic, drift-gated core (PDR-001) is
   untouched, so generation gains authoring leverage without surrendering
   reproducibility. (How: ADR-084.)
2. **The model is a tunable open weight, hosted in coder.** Generation runs on weights
   the platform can fine-tune on its own corpus of intent→manifest→MFE examples,
   ending the per-token credit cost of continuous generation. Coder stays an external
   service (a local Bun/MLX binary the host wraps, not an in-process plugin); this repo
   owns only the seam it plugs into. (How: ADR-085.)
3. **The loop is continuous.** Generated manifests are accepted only when the existing
   CI gates pass — CI is the acceptance oracle for stochastic output — and, once the
   registry persists (#139), the same loop deploys. (How: ADR-086.)

## Why this over alternatives

- **Model generates code directly (rejected).** Maximally "generative", but it destroys
  the single invariant the platform is built on: `check:mfe-drift` and the
  generator-owned/developer-owned seam. Reproducibility is worth more than the extra
  reach, and the DSL is expressive enough to be the target.
- **Keep hand-authoring manifests (rejected — the status quo).** This is the sprawl
  that prompted the decision; it does not scale with the fleet.
- **Keep using a metered hosted model (rejected as the steady state).** Fine for
  bootstrapping, but continuous generation makes per-token cost the dominant line
  item; open weights the platform tunes on its own corpus is the durable answer.

## Success signals

- A refined intent compiles to a manifest that passes `parseAndValidateDirectory` and
  the fleet drift/compose gates with no human edit to the DSL, and `remote:generate`
  produces a conformant MFE from it.
- The intent→manifest step runs on a tuned open weight in coder with no metered-API
  call in the inner loop.
- A bad generation fails a CI gate and never reaches a running shell — the loop fails
  closed.

## Consequences / trade-offs

- **Positive:** the authoring bottleneck moves off humans while the reproducibility
  guarantee is preserved end to end; continuous generation stops being a metered cost.
- **Negative / honest:** anything the DSL cannot express, the model cannot generate —
  this puts sustained pressure on DSL expressiveness (`packages/dsl/src/schema.ts`).
  The open-weights value depends on work in a repo this decision does not own (coder),
  and the "continuously deployed" half depends on registry persistence (#139), which is
  not yet built.
- **Neutral:** this is a living thesis extending PDR-006; update it as the signals are
  met or fail.

## Implemented by

- ADRs: ADR-084 (intent→manifest boundary), ADR-085 (coder as an external local model
  service), ADR-086 (continuous generation loop), ADR-087 (coder's source adaptor fills
  the developer-owned lane — the second, non-overlapping generation lane).
- Composes: PDR-006 (scaling thesis), PDR-003 (AI-native tooling, manifest-as-boundary),
  PDR-001 (generate, don't hand-write), PDR-004/PDR-008 (coder stays a plugin).
- Open dependencies: #139 (registry persistence) for the CD half; coder-repo tuning
  against ADR-085's contract.

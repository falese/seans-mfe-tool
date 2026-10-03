---
id: 0110
title: >-
  A decomposition is agreed as one reviewable document, decomposition.yaml, from which the
  manifests and composition are derived — humans edit the proposal, never the derived files
status: Proposed
date: 2026-10-03
deciders: [sean]
area: Decomposition / proposal
enforcement: tooling
tags: [decomposition, proposal, agreement, manifest, composition]
relates-to: [83, 84, 109, 111]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by: []
verified-by: []
tracked-by: ["#410", "#415", "#416", "#425"]
summary: >-
  `decompose:propose` writes `decomposition.yaml`: the domains, the components and files each
  owns, the backends each fronts, the slots each occupies, the test triage, and per-signal
  evidence scores for every boundary. Draft `mfe-manifest.yaml` files and a
  `control-plane.yaml` are derived from it and must pass the same validation a hand-written
  one does. Agreement is merging the proposal PR; a human changes domains by editing
  `decomposition.yaml` and re-deriving, never by editing the derived manifests.
rationale-summary: >-
  People agree on domains, not on YAML for seven services. One document at the level of the
  decision keeps the human gate meaningful, keeps evidence attached to each boundary, and keeps
  the derived manifests consistent with each other — the same single-source pattern as
  control-plane.yaml → rules.json (ADR-083).
long-form: true
---

## Context

PDR-011 requires a human agreement step before generation. ADR-084 fixes the model's output
as manifests. But a decomposition spans many manifests plus composition, and reviewing them
separately hides the actual decision — where the boundaries are and why.

## Decision

### 1. `decomposition.yaml` is the agreed artifact

It lists domains with: owned components and files, fronted backends, occupied slots,
capabilities, shared code it depends on, and the evidence score per signal (network, DOM,
navigation, source, ownership) behind its boundary.

### 1a. The first draft is deterministic; judgment is the agent's, recorded as edits

`decompose:propose` produces the first `decomposition.yaml` by deterministic graph clustering
over the evidence, so the same bundle always yields the same draft and the draft can be
tested and scored in CI. The operating agent (an MCP client following the decomposition
playbook) then makes the judgment calls — naming, merging, splitting, assigning ambiguous
components — as edits to `decomposition.yaml`. No model runs inside the CLI on this path;
this is PDR-010's split of a model that reads wide over a deterministic floor that executes.

### 2. Manifests and composition are derived, and validated like hand-written ones

Each domain becomes a draft `mfe-manifest.yaml` (validated with `validateFull`); the
placements become `control-plane.yaml` (validated with `compileControlPlane`). Derivation is
re-runnable: `decompose:propose --from decomposition.yaml`.

### 3. Agreement is a merged PR

The proposal PR carries `decomposition.yaml`, a readable summary, the derived files, and the
Figma boundary overlay. Merging it is the agreement; nothing is scaffolded before that.
Any later approval surface — such as a review UI for non-engineers (#425) — writes to the same
`decomposition.yaml` on the same PR, so the PR stays the single system of record.

### 4. Edits go to the proposal

Merging, splitting or renaming domains is an edit to `decomposition.yaml` followed by
re-derivation. Hand edits to derived manifests before scaffolding are overwritten.

## Boundaries

- After scaffolding, manifests follow normal ownership rules; this ADR governs only the
  proposal stage.
- Evidence scores inform the human; they are not a gate.

## Consequences

The human gate stays at the level of the real decision, and every boundary carries its
reasons. The cost is a new schema to maintain alongside the manifest schema.

## References

- PDR-011 — the product decision this serves.
- ADR-083 — the single-source composition document this mirrors.
- ADR-084 — generation targets the manifest, not source; derived manifests pass the same gates.
- ADR-109 — the evidence the scores are computed from.
- #415, #416 — `decompose:propose` and the agreement artifact.

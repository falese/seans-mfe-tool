---
id: 0110
title: >-
  A decomposition is agreed as one reviewable document, decomposition.yaml, from which the
  manifests and composition are derived — humans edit the proposal, never the derived files
status: Accepted
impl:
  stage: phased
  refs: ["#422"]
date: 2026-10-03
deciders: [sean]
area: Decomposition / proposal
enforcement: tooling
tags: [decomposition, proposal, agreement, manifest, composition]
relates-to: [83, 84, 109, 111]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by:
  - src/commands/decompose/propose.ts
  - src/commands/decompose/score.ts
  - packages/decompose/src/model.ts
  - src/decompose/propose/cluster.ts
  - packages/decompose/src/derive.ts
  - src/decompose/propose/triage.ts
  - src/decompose/propose/score.ts
  - src/commands/decompose/edit.ts
  - src/commands/decompose/present.ts
  - packages/decompose/src/edit.ts
  - packages/decompose/src/present.ts
verified-by:
  - src/decompose/propose/__tests__/meridian-monolith.test.ts
  - packages/decompose/src/__tests__/derive.test.ts
  - src/decompose/propose/__tests__/score.test.ts
  - packages/decompose/src/__tests__/edit.test.ts
  - packages/decompose/src/__tests__/present.test.ts
tracked-by: ["#410", "#415", "#416", "#425", "#440"]
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

As implemented (#415), the draft is built in four steps:

1. **Seeds.** A route that puts a component in the primary area seeds a domain; the files
   only that route reaches join it.
2. **Shell.** Files only the entry reaches form the shell.
3. **Data affinity.** A component left over — rendered by the shell, or by a route with no
   primary area — joins the domain that supplies at least half of the data it reads. Chrome
   (navigation, headers, the route table) stays in the shell, and its reads of other domains'
   data become couplings.
4. **Shared** files get a suggestion instead of an owner.

Each domain carries a 0–1 score per signal (route, data, imports, runtime, co-change, ownership;
null where absent). The proposal also records couplings through the shared store or the shell,
slots and routes, repeated placements (one tile per item), test triage, and capabilities no
kept test covers. `proposal.base.yaml` keeps the draft so the agent's edits can be diffed
against it.

### 2. Manifests and composition are derived, and validated like hand-written ones

Each domain becomes a draft `mfe-manifest.yaml` (validated with `validateFull`); the
placements become `control-plane.yaml` (validated with `compileControlPlane`). Derivation is
re-runnable: `decompose:propose --from decomposition.yaml`.

As implemented, the derived fleet has a project's layout (`<mfe>/mfe-manifest.yaml`,
`control-plane/control-plane.yaml`), so `compose:validate` reads it like any fleet.
Repeated placements stay in the proposal: their keys (`{id}`) are bound with `forEach` when
composed, and the source does not know them. Each BFF names its OpenAPI document; inferring it
is #440 (ADR-112).

### 2a. Scoring and the corpus

`decompose:score` grades a proposal against an answer key. It matches domains by shared files
and slots by shared placements, so names never count. It scores the draft and the edited
proposal separately, lists the edits between them, and with `--corpus` writes the run as one
training record (PDR-009).

### 3. Agreement is a merged PR

The proposal PR carries `decomposition.yaml`, a readable summary, the derived files, and the
Figma boundary overlay. Merging it is the agreement; nothing is scaffolded before that.
Any later approval surface — such as a review UI for non-engineers (#425) — writes to the same
`decomposition.yaml` on the same PR, so the PR stays the single system of record.

### 4. Edits go to the proposal

Merging, splitting or renaming domains is an edit to `decomposition.yaml` followed by
re-derivation. Hand edits to derived manifests before scaffolding are overwritten.

As implemented (#416), `decompose:edit` applies edits as named operations — rename or merge
domains, move a file (with any capability it holds), rename a capability or slot — so every
reference moves with what changed and the re-derived fleet stays consistent. They are the
same kinds `decompose:score` lists, so an agent's edits read back the way they were made.
`decompose:present` writes the agreement artifact for the PR in §3: `PROPOSAL.md`, and an
overlay of the proposed domains and couplings on the captured screens, as an HTML page and a
Figma plugin.

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

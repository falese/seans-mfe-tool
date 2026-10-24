---
id: 0116
title: >-
  The decomposition workspace is a local, stateless UI for the product owner over
  decomposition.yaml; the agent works beside them, and every change is an edit to that document
status: Proposed
date: 2026-10-24
deciders: [sean]
area: Decomposition / agreement / UI
enforcement: tooling
tags: [decomposition, ui, agreement, product-owner, agent, stateless]
relates-to: [84, 109, 110]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by: []
verified-by: []
tracked-by: ["#410", "#425"]
summary: >-
  `seans-mfe-tool decompose:workspace` serves a local web UI in which a product owner reviews and
  shapes a decomposition: the monolith's screens with the proposed domains overlaid, the evidence
  behind each boundary, and actions to merge, split, rename, reassign, comment and approve. The
  UI keeps no state. It renders `decomposition.yaml` and the evidence bundle, and every action,
  the agent's included, is an edit to `decomposition.yaml` made through the CLI, validated and
  re-derived. Approval is recorded in the document and lands on the proposal PR.
rationale-summary: >-
  The people who must agree on domain boundaries are product owners, and a PR full of YAML is an
  engineer's tool. Making the decomposition DSL the only state means the UI, the agent, the CLI
  and the PR can never disagree. Everything the UI shows can be regenerated from the repository,
  and the UI stays a thin client rather than a second product.
long-form: true
---

## Context

ADR-110 makes `decomposition.yaml` the agreed artifact and a merged PR the agreement, and it
parks a non-engineer review surface (#425). The product owner is the person whose agreement
matters most, and the person least served by a PR. Their part is more than one approval click:
they shape the proposal (this belongs with cargo, that is two products) while the agent does
the mechanical work.

## Decision

### 1. The product owner is the primary user

The workspace is designed for someone who does not read YAML, run git, or open a terminal
beyond launching it. Engineers keep the CLI and the agent directly; the workspace is not their
main tool.

### 2. Local

`seans-mfe-tool decompose:workspace <project>` serves the UI on localhost from the CLI, beside
the repository and the evidence bundle. No hosted service, accounts or database.

### 3. Stateless: the decomposition DSL is the only source of truth

The UI holds no durable state of its own. It renders:

- `decomposition.yaml` — domains, ownership, backends, slots, test triage, evidence scores;
- the evidence bundle (ADR-109) — screenshots with region outlines, attributed traffic;
- validation of the derived manifests and composition (ADR-110 §2).

Every action is a named edit to `decomposition.yaml`: merge, split, rename, reassign a
component, comment, approve. The CLI applies it, validates the result and re-derives. A reload,
a second browser tab, or a restart shows the same thing, because there is nothing else to show.
Comments and approvals live in the document too, so the PR carries the whole conversation.

### 4. The agent works through the same edits

The workspace has an agent pane. The product owner asks in plain language ("split cargo from
docking"), and the operating agent answers by proposing edits. Those edits are the same named
operations the UI's own controls use, so it has no private path into the document. Each agent
edit is shown as a change the product owner accepts or rejects before it is applied. The model
runs outside the CLI, as in ADR-110 §1a and PDR-010; the workspace connects to an agent and
hosts no model.

### 5. Approval lands on the PR

Approving records who approved, when, and a hash of the approved document in
`decomposition.yaml`. The workspace then commits to the proposal branch, and the PR stays the
system of record (ADR-110 §3). Any later edit invalidates the recorded hash, so an approval
always names exactly what was approved.

## Boundaries

- The workspace governs the proposal stage only. Scaffolding, porting and strangling stay CLI
  and agent work; a progress view of them is a possible later addition, not part of this
  decision.
- v1 assumes the product owner's machine has the CLI, the repository and access to an agent.
  Packaging that for someone with no developer setup (a single launcher, or an engineer
  hosting a session) is a follow-up.
- The named edit operations and the approval and comment fields are new `decomposition.yaml`
  schema. They are defined when ADR-110's schema is implemented (#415, #416), not here.

## Consequences

Agreement moves to the person who owns the decision, without a second source of truth. The
agent's work becomes reviewable edit by edit. The cost is an edit-operation API and a UI to
maintain, and the requirement that every proposal output (regions, scores, validation) be
structured enough to render. That requirement also applies to M2–M4 (#413–#415) as they are
built.

## References

- PDR-011 — agent-driven monolith decomposition.
- ADR-110 — `decomposition.yaml` and agreement by merged PR; this ADR adds the surface over it.
- ADR-109 — the evidence bundle the workspace renders.
- ADR-084, PDR-010 — the model's output is a structured document; the deterministic floor executes.
- #425 — the workspace; #410 — the decomposition epic.

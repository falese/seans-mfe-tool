---
id: 0011
title: An agent decomposes a running monolith into SMT MFEs from observed evidence, and proves the result behaves the same
status: Proposed
date: 2026-10-03
deciders: [sean]
supersedes: []
superseded-by: []
tags: [generative, decomposition, migration, agent, evidence, regression, strategy]
summary: Given a monolithic React SPA — its running app and its full source — an agent with a playbook and the SMT toolchain captures what the app actually does, reads how it is built, proposes a decomposition into MFEs and BFFs with the evidence for every boundary, gets human agreement, generates the fleet with every enabling piece (BFFs, composition, Figma designs, regression tests), strangles the monolith one placement at a time, and proves parity against what it captured. The model still emits manifests, never generator-owned source (ADR-084); what is new is the evidence before the manifest and the proof after it.
---

# PDR-011: An agent decomposes a running monolith into SMT MFEs from observed evidence, and proves the result behaves the same

## Problem space

Every team that wants independently deployable domain features starts from the same
place: a monolith. The platform today assumes the opposite — it generates MFEs from a
manifest someone already wrote, which presumes someone already knows where the domain
boundaries are. In a real migration that knowledge is the expensive part, and it is
usually missing:

- **The boundaries are not written down.** They live in which screen calls which
  backend, which components change together, and which team owns which folder. Nobody
  holds all of it, and workshops to recover it take weeks.
- **The tests cannot be trusted to define behavior.** A real monolith's suite is
  thin, uneven, snapshot-heavy, coupled to implementation, and partly skipped. "Keep
  the tests green" is not a migration safety net when the tests barely exist.
- **Migrations stall halfway.** Big-bang rewrites fail; incremental ones lose momentum
  because each step is hand work with no proof it changed nothing.
- **The enabling pieces are an afterthought.** BFFs, composition, design assets and
  regression suites are rebuilt by hand per MFE, if at all.

The platform's own reference apps already model the mess (PDR-007): overlapping
backends, data ownership split by organizational accident. That is what a monolith's
seams look like from the inside.

## Decision

Make **decomposition of an existing app** a first-class generative path, alongside
intent→manifest (PDR-009). An agent operating the toolchain through its agent profile
(PDR-003):

1. **Runs the app and captures evidence** — what each region of the screen renders,
   which backends it calls on which interaction, how navigation flows, what errors it
   already throws — and maps every region to the component and source file behind it.
2. **Reads the code** — route table, import graph, API call sites, co-change history,
   ownership.
3. **Proposes** a decomposition where every boundary carries the evidence for it,
   as draft manifests and composition that pass the same validation a human's would.
   The first draft comes from deterministic clustering of the evidence; the agent's
   judgment (naming, merging, splitting) is applied on top as reviewable edits.
4. **Stops for agreement.** A human approves, merges, splits or renames domains before
   anything is generated. In v1 the agreement is a merged proposal PR.
5. **Generates and strangles.** The monolith is wrapped as one MFE; new MFEs replace it
   one placement at a time.
6. **Proves parity** against the captured baseline at every step, with a regression
   suite it builds — triaging the monolith's existing tests and generating the coverage
   they never had. The runtime capture, not the old suite, defines "what the app does".

The manifest stays the boundary (ADR-084): the agent's design output is manifests and
composition; generator-owned code stays deterministic; the agent writes only
developer-owned files (ADR-087).

## Why this over alternatives

- **A static code analyzer that suggests boundaries.** Source alone misses the
  strongest signal — which backends a region actually calls at runtime — and cannot
  prove the result behaves the same. Running the app gives both.
- **A migration guide for humans.** It leaves the expensive parts (finding boundaries,
  building the safety net) as hand work, which is why migrations stall today.
- **Fully autonomous decomposition with no human gate.** Domain boundaries are
  organizational decisions as much as technical ones. The agent proposes with evidence;
  people decide.

## Success signals

- On `meridian-monolith` — the reference app rebuilt as one SPA with a deliberately
  poor test suite and an answer key — the agent's proposal scores at least 0.8 F1 on
  component-to-domain assignment, and its test triage agrees with the answer key.
- The decomposed fleet passes every repo gate and the parity gate after every
  strangler step, with behavioral coverage measurably above the monolith's own.
- A product owner can approve a proposal from the Figma boundary overlay without
  reading YAML.
- The same run works on a real external React SPA with no change to the toolchain.

## Consequences / trade-offs

- **The platform grows an inbound half.** Capture, analysis and proposal are new
  surface, and the toolchain must start *producing* OpenAPI specs (inferred from
  traffic), not only consuming them.
- **Dev builds become a requirement for the best evidence.** Mapping regions to source
  relies on React's development-mode metadata; production-only apps get weaker
  evidence.
- **React SPAs first.** Other stacks need their own source analysis; runtime capture
  is framework-agnostic and carries over.
- **Routing becomes a dependency.** Strangling a real app needs its URLs mapped onto
  control-plane state keys. That is its own track, not required for the reference app,
  but required before a real customer app.
- **Evaluation needs ground truth.** The reference app and its answer key are part of
  the product, not a test fixture, and must be maintained like one.
- **Agreement starts in GitHub.** A merged PR is the v1 approval, which suits engineers
  better than product owners. A purpose-built approval UI for non-engineers is a later
  phase (#425); it must write to the same proposal document so there is one system of
  record.

## Implemented by

- ADRs: ADR-109 (evidence bundle), ADR-110 (decomposition proposal), ADR-111 (legacy
  Module Federation wrap), ADR-112 (OpenAPI inference), ADR-113 (parity gate) — all
  Proposed
- Prerequisites: #407 (LayoutManager is the sole mounter), #408 (`data-smt-*` boundary
  stamps), #409 (capture fidelity, building on #406)
- Work: epic #410, milestones #411–#420
- Composes PDR-009 (generative system), PDR-007 (messy reality), PDR-003 (agent-operable
  tooling), PDR-001 (generate, don't hand-write)

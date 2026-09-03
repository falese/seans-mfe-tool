---
id: 0010
title: The governance+generation machinery is a reusable, self-hosting kernel — SMT is reference implementation #1
status: Accepted
date: 2026-09-03
deciders: [sean]
supersedes: []
superseded-by: []
tags: [generative, governance, kernel, drift, ports-adapters, self-hosting, strategy]
summary: Across the generative-system work the platform re-derived one domain-agnostic pattern — a model reads wide, emits a typed artifact, and a deterministic floor executes it. Generation is one instance of it (business intent → manifest, validateFull decides); governance is the other (ADR↔code drift → a typed migration entry, mfe:validate executes it). Both halves are the same contract. That contract plus the machinery around it — decision-record system, traceability gates, a drift auditor, and a generation loop — is extracted into a reusable governance/generation kernel that lives as a package inside SMT and governs its own records. SMT is reference implementation #1; the kernel governing itself is the reflexive second instance.
---

# PDR-010: The governance+generation machinery is a reusable, self-hosting kernel — SMT is reference implementation #1

## Problem space

PDR-009 committed the platform to a generative authoring surface: a model compiles a
business intent into a validated manifest, and the deterministic pipeline carries it to a
running MFE. Building that out, one shape kept recurring — and it was never specific to
MFEs:

> **A model reads wide, emits a typed artifact, and a deterministic floor executes it.**

It shows up twice already, in two apparently unrelated corners of the repo:

- **Generation** (PDR-009, ADR-084): business intent → a manifest; `validateFull`
  (`packages/dsl/src/validator.ts`) is the deterministic oracle that accepts or rejects it.
- **Governance** (ADR-082): a drift between an ADR and the code that is supposed to carry it
  → a typed `PlatformMigration` entry (`packages/codegen/src/platform-migrations.ts`);
  `mfe:validate` executes that entry against the affected artifact and reports it where the
  developer already is.

These were built months apart as two features. They are the same contract. In both, a small
**typed schema is simultaneously three things**: the result format the fuzzy layer must fill,
an anti-hallucination narrow-waist (output that cannot be expressed in the schema is not
emitted), and a precision filter (a finding that cannot be written as a typed, mechanizable
check is either not real or not actionable). The deterministic floor is what makes stochastic
output safe to act on, in generation and in governance alike.

The cost of *not* naming this pattern is that the platform keeps re-deriving it per feature,
and the machinery around each instance — decision records, traceability, the audit that finds
drift, the loop that proposes and validates — is entangled with MFE specifics that are
incidental to the pattern itself.

## Decision

Name the pattern, extract its machinery, and make the platform host its first two consumers.

The governance+generation machinery is a **reusable, self-hosting kernel**. It is coupled to
SMT only through a minimal set of **ports** (adapters the consuming project implements); the
machinery it *provides* is generic. SMT is **reference implementation #1** — its existing
`validateFull` / `findManifest` / `generateAllFiles` / `PlatformMigration` code becomes the
adapter set behind the ports, and its full gate suite must still pass through them. The kernel
also **governs its own decision records with its own gates**, which is a real second instance
(n=2) without needing an external consumer.

Three commitments:

1. **The typed-artifact contract is the shared invariant.** Generation and governance are two
   instances of one contract: model reads wide → emits a typed artifact → a deterministic floor
   executes it. The kernel owns that contract; SMT owns the adapters. (How: ADR-089 fixes the
   port surface; ADR-090 fixes the auditor's typed output.)
2. **Floor-first, and never self-host the floor.** The deterministic gates (the decision-record
   schema, the traceability and existence checks, the `HardenedCheck` verifier) are extracted as
   plain, independently-tested code. The fuzzy layer never *produces* the floor — a Trusting-Trust
   guardrail: a kernel whose own audit gates were model-generated could be blind to its own drift.
   The MVP is the floor plus the ports; the auditor is post-MVP.
3. **Drift detection first, audit-first, self-liquidating.** The first consumer capability is
   drift detection between decisions and the code that carries them — not general governance. It
   runs audit-first and hardens findings into typed, usage-detectable checks (the ADR-082 shape),
   so the auditor's surface shrinks as the deterministic floor accumulates the checks it found.

## Why this over alternatives

- **Leave the two instances as separate features (rejected — the status quo).** They keep drifting
  from each other and the machinery stays welded to MFE specifics, so nothing is reusable and the
  n=2 self-check never exists.
- **Build a general governance framework up front (rejected).** Universality against a foreign
  domain is unfalsifiable until a real third consumer exists; every speculative knob is an SMT-ism
  in disguise (YAGNI). The port surface stays minimal until a foreign consumer forces a real one.
- **Ship the kernel as its own repo now (rejected as premature).** The API is still moving. Home is
  a package inside SMT, coupled only through ports and free of SMT imports past them, so a later
  extraction to a neutral-identity peer repo (not `@seans-mfe/*`; name TBD) is mechanical. This is
  the same monorepo-first-while-unstable discipline the `bff-plugin` / `coder-plugin` seams used.
- **Fine-tune a drift detector (rejected).** The sample size is tiny and the corpus is current; a
  retrieval + judgment auditor stays grounded and up to date. The git history of `implemented-by`
  fixes labels the evaluation, not model weights.

## Success signals

- **n=1:** after the ports land, SMT's existing gates — `check:adr`, `check:mfe-drift`,
  `check:mfe-consistency`, `compose:validate` — all pass *through* the kernel ports, and nothing
  MFE-shaped leaks past `validate` / `materialize`.
- **n=2 / self-host:** the kernel's own ADRs pass the kernel's own decision-record gates.
- **Auditor (post-MVP):** a git-mined evaluation checks out the commit *before* a known
  `implemented-by` fix, runs the audit, and confirms it emits a `HardenedCheck` that fires on the
  affected artifact. The auditor reports "N ranked suspected drifts" and never an all-clear.

## Consequences / trade-offs

- **Positive:** the platform stops re-deriving the same pattern per feature; the machinery becomes
  a reusable asset with a real second consumer (itself); and the typed floor keeps stochastic
  output — in both generation and governance — safe to act on.
- **Negative / honest:** extraction is refactoring work that buys no new user-facing behavior on
  its own, and the kernel's value as a *general* asset is unproven until a genuinely foreign third
  consumer exists — which this decision deliberately does not pursue yet. The self-hosting guardrail
  (never let the fuzzy layer produce the floor) is a discipline the mechanism cannot enforce on
  itself; it is written down here and in ADR-089/090.
- **Neutral:** this is a living thesis extending PDR-006 and PDR-009. Update it as the n=1 and n=2
  signals are met or fail, and revisit the "own repo" question only when the port surface stops
  moving.

## Implemented by

- ADRs: ADR-089 (the kernel's ports & adapters interface — `validate` / `locateArtifacts` /
  `materialize` / `HardenedCheck`, and the generic-vs-incidental boundary), ADR-090 (the drift
  auditor emits a typed `HardenedCheck | SemanticFinding`; the migration entry is the model's
  output contract; audit hardens into a deterministic check).
- Composes: PDR-009 (generative software system — the generation instance of the contract),
  PDR-006 (ecosystem scaling thesis), PDR-003 (AI-native tooling — the manifest/artifact as the
  boundary between the human and machine heads).
- Reuses: ADR-082 (platform migrations — the governance instance the kernel generalizes),
  ADR-084 (generation targets a typed artifact, not source), ADR-075 (the decision-record system
  and its drift gates, extracted as provided machinery).

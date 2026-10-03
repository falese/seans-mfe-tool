---
id: 0113
title: >-
  A decomposition step is accepted only when the composed app passes the parity gate — the
  captured journeys produce the same regions, the same backend calls, the same visuals and no
  new errors as the monolith
status: Proposed
date: 2026-10-03
deciders: [sean]
area: Decomposition / regression
enforcement: code
tags: [decomposition, regression, parity, playwright, visual, testing]
relates-to: [52, 84, 86, 109, 111, 112]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by: []
verified-by: []
tracked-by: ["#410", "#418", "#419"]
summary: >-
  The monolith's own tests cannot define its behavior — real suites are thin, coupled and
  partly skipped — so the captured evidence bundle does. From it the toolchain generates
  characterization tests (per-region content and structure, backend calls made, no new console
  errors) and per-region visual baselines, proves them green against the monolith, then runs the
  same journeys against the composed app on recorded data. Existing tests are triaged keep,
  rewrite or discard and migrated with their components. Every strangler step and the final
  sign-off must pass this gate.
rationale-summary: >-
  Without an executable definition of "behaves the same", incremental migration has no safety
  net and stalls. Deriving that definition from observed behavior, rather than from a suite
  nobody trusts, makes it possible to prove each step changed nothing — and makes CI the
  acceptance oracle for decomposition as it already is for generation (ADR-086).
long-form: true
---

## Context

PDR-011 promises proof that the decomposed app behaves like the monolith. Real monoliths'
suites are poor, which is why the reference app ships one deliberately (#412). The
platform already treats CI as the acceptance oracle for generated output (ADR-084, ADR-086).

## Decision

### 1. Captured behavior is the baseline

The evidence bundle (ADR-109), not the existing suite, defines what the app does.

### 2. The gate has four parts

- **Characterization tests** generated from journeys: per-region content and structure, and
  the backend calls each interaction makes.
- **Visual baselines** per region.
- **Console baseline**: no errors beyond those the monolith already throws.
- **Contract tests** for each BFF against recorded traffic (ADR-112).

### 3. Proven on the monolith first

Generated tests must pass against the monolith before they may judge the composed app.

### 4. Deterministic data

Both sides run on recorded responses served through the BFF mock switch (ADR-052).

### 5. Existing tests are triaged, not trusted

Each is classified keep, rewrite or discard. Keepers move with their component into the
MFE's developer-owned tests; rewrites become behavioral tests; discards are recorded with a
reason. Gaps between captured behavior and covered behavior are filled by characterization
tests.

### 6. Every step runs it

Each strangler step (ADR-111) and the final sign-off require a green gate.

## Boundaries

- Parity covers what the journeys exercised; uncaptured behavior is reported as a coverage
  gap, not assumed equal.
- Intentional changes during migration need an explicit baseline update in the PR, not a
  silent re-record.
- Region selectors move to the `data-smt-*` boundary stamps (#408) after scaffolding.

## Consequences

Migration steps become provable and reversible, and the decomposed fleet ends with better
coverage than the monolith had. The cost is a larger, slower suite and baselines that must
be curated when behavior changes on purpose.

## References

- PDR-011 — the product decision this serves.
- ADR-052 — mock switch serving recorded data.
- ADR-084, ADR-086 — CI is the acceptance oracle.
- ADR-109 — the evidence bundle that is the captured baseline.
- ADR-111 — the strangler steps this gates.
- ADR-112 — inferred specs used by contract tests.
- #408 — region selectors after scaffolding.
- #412, #418, #419 — the reference suite, the regression milestone, and the strangle loop.

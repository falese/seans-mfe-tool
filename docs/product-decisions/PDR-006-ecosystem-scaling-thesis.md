---
id: 0006
title: Ecosystem scaling thesis
status: Proposed
date: 2026-05-21
deciders: [sean]
supersedes: []
superseded-by: []
tags: [ecosystem, strategy, scaling, roadmap]
summary: PDR-001 through PDR-005 compose into a single thesis — a contract-defined, generated, agent-operable, federated platform scales from a handful of MFEs to an ecosystem across teams and languages — and this record states what is proven today and what investment unlocks next.
---

# PDR-006: Ecosystem scaling thesis

## Problem space

The five preceding PDRs are individually defensible, but the reason they were chosen is a
single bet: **this approach scales from a handful of MFEs to an ecosystem of them, across
many teams and languages, without the usual decay.** That bet needs to be stated
explicitly, because the alternative — adding MFEs to a hand-maintained shell with
per-team boilerplate — is known to decay in a predictable way:

- Integration cost grows with the number of MFEs (every new remote touches the host).
- Consistency decays as more teams hand-write the contract.
- The platform team becomes a bottleneck on every team's day-one plumbing and every
  contract upgrade.
- Onboarding a non-blessed stack means a fork, and forks fragment the platform.

If those failure modes are real, "more MFEs" makes the platform *worse*, and the
ecosystem ambition is self-defeating. This PDR records why the chosen approach inverts
each curve, what is already proven, and where the remaining investment goes.

## Decision

Treat the platform as an **ecosystem substrate**, and let the four supporting decisions
each neutralize one decay curve:

| Decay curve as MFEs scale | Neutralized by | Mechanism |
| ------------------------- | -------------- | --------- |
| Boilerplate / contract drift | **PDR-001** | Manifest → generated, contract-enforcing code |
| Stack lock-in & forking | **PDR-002** | Framework-/language-neutral contract; siblings, not forks |
| Human review can't keep up | **PDR-003** | Agents generate at scale; output stays machine-checkable and human-auditable |
| Teams blocked on each other | **PDR-004** | Plugin-first federation; independent cadences against published contracts |
| Host becomes the bottleneck | **PDR-005** | Generated control plane composes MFEs at runtime |

The thesis: with all five in place, the marginal cost of the *N*th MFE stays roughly
flat instead of rising with *N*.

## Why this over alternatives

- **Grow the current hand-built shell (rejected).** This is the decay path above; it is
  the status quo the platform was built to escape.
- **Adopt an off-the-shelf micro-frontend framework (considered).** Existing solutions
  solve build-time federation well but assume a single stack and a present human
  developer, and none provide a generated, agent-operable, runtime control plane keyed
  to a language-neutral contract. The combination — not any single piece — is the bet.

## Success signals

Already demonstrated:

- React and Angular MFEs run in the **same shell** through one contract with identical
  telemetry (PDR-002 / PR #161) — the strongest evidence the contract is genuinely
  stack-neutral.
- MFEs are generated, not hand-written, with contract compliance by construction
  (PDR-001).
- The tooling is driven by agents in sandboxes and remains auditable by humans (PDR-003).

To prove the thesis at ecosystem scale (the investment frontier):

- The *N*th MFE's integration cost stays flat — measured as host edits per added MFE
  trending to ~zero once PDR-005's control plane lands.
- A second framework team and a polyglot (non-TS) MFE join with no fork and no host
  changes.
- The plugin ecosystem (PDR-004) has ≥2 external plugins federating through `mcp serve`
  against published contracts.

## Consequences / trade-offs

- **Positive:** A coherent, evidence-backed story for why scaling MFEs on this platform
  is sustainable — the basis for asking the team (and sponsors) to invest in the next
  phase rather than in another hand-built shell.
- **Negative / honest:** The thesis is only partly proven. The control plane (PDR-005)
  is still in-flight (PR #153), the polyglot story is stubs not production MFEs, and the
  plugin ecosystem (PDR-004) is gated on publishing the contract packages. The
  investment ask is precisely to close these gaps.
- **Neutral:** This PDR is a living thesis. As the success signals are met (or fail),
  update it — it is the record future-us checks the bet against.

## Implemented by

- Composes: PDR-001, PDR-002, PDR-003, PDR-004, PDR-005.
- Status / roadmap: `docs/PROJECT-STATUS.md` (what's shipped / active / deferred),
  `MERGE-PLAN.md` (federation → monorepo phases and their gates).
- Open frontier: PR #153 (control plane), MERGE-PLAN Phase 1 (publish contracts),
  `examples/polyglot-stubs/` → production polyglot MFEs.

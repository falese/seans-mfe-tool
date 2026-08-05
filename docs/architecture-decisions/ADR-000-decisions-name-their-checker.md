---
id: 0000
title: A decision claiming automated enforcement must name the checker that proves it
status: Implemented
date: 2026-08-05
deciders: [sean]
area: Governance / ADR library / conformance
enforcement: code
tags: [governance, adr, conformance, drift, testing]
relates-to: [75, 82]
supersedes: []
superseded-by: []
implements-pdr: [3]
implemented-by:
  - packages/dsl/src/adr-validation.ts
  - docs/architecture-decisions/conformance-backlog.json
verified-by:
  - packages/dsl/src/__tests__/adr-validation.test.ts
  - packages/dsl/src/__tests__/adr-schema.test.ts
long-form: true
summary: >-
  An ADR declaring enforcement of code or tooling must name a verified-by gate — an npm script,
  a test, or a purpose-written conformance pack — and a ratcheting backlog holds the decisions
  that predate the rule, failing on any addition.
rationale-summary: >-
  enforcement was a claim about the codebase that nothing could falsify, so 49 of 74 ADRs
  asserted automated enforcement while naming no checker at all, and the decisions drifted
  until a human happened to grep.
---

## Context

This is the root decision, numbered before all others because every other ADR
must satisfy it.

ADR-075 put the ADR *library* under drift control: frontmatter is the source of
truth, the index is generated, references must resolve. What it did not put
under control is the relationship between a decision and the code it governs. An
ADR could declare `enforcement: code` — a claim that a gate enforces this — and
name nothing. Nothing checked the claim, so nothing stopped the decision from
quietly ceasing to be true.

Measured when this was written: **74 ADRs declared `enforcement: code`, and 49
of them (66%) named no `verified-by` at all.** The field already existed
(`adr-schema.ts`), and was already validated to *resolve* to a live npm script
or repo file when present. It was simply optional.
`adr-validation.ts` even stated the principle and stopped one step short of
applying it to itself: *"a declared field nothing checks is a field that rots."*

The cost was not hypothetical. In a single working session the same defect
surfaced five times, each in different clothes:

- `DeclaredSlot` carried a "keep in lock-step … must land in both" comment that
  no gate enforced. The two copies drifted; a commit re-aligned them by hand.
- ADR-084 §4 requires a generated manifest to declare plain semver
  "permanently". Nine `package.json` files sat on a `file:` path to the retired
  staging directory, and every gate passed them, because the rule that looked at
  that dependency checked only that it was *present*.
- ADR-085's compile contract could not reach existing MFEs at all.
- BFF MFEs never typechecked their `.tsx` — the compiler was simply never handed
  them.
- `MfeHost`/`useMfe` shipped with a signature contradicting ADR-056's own text,
  because nothing exercises it.

Every one was found by a human reading code, which is precisely the failure mode
the ADR library exists to prevent.

## Decision

### 1. `enforcement: code` or `tooling` requires a `verified-by`

The `enforced-claims-a-gate` rule fails an ADR that claims automated enforcement
and names no checker. `enforcement: convention` is deliberately exempt: it
states that humans enforce the decision, which is honest, and demanding a gate
for it would only push authors to mislabel their ADRs to get past the linter.

### 2. A checker may be an existing gate or a purpose-written pack

`verified-by` accepts an npm script or a repo path, and both are already
resolved by `implemented-claims-evidence`. Some decisions already have a real
checker that was simply never named — ADR-056's boundary test is one, and its
docstring describes itself as *"the bright line made machine-checked"*. Others
have none and need one written.

A conformance pack is a jest test scoped to a single ADR, living beside the
code it constrains. It is not a new framework; it generalises a pattern this
repository already invented once and never repeated.

### 3. The backlog is a ratchet

`docs/architecture-decisions/conformance-backlog.json` lists the 50 decisions
that predate this rule. Listed ids are exempt. The rule **fails on any
addition**, and also fails on any listed id that has *since* gained a
`verified-by` — a stale entry is a hole a future regression could slip through
unnoticed. The list may only shrink.

It is deliberately not regenerated. A self-regenerating backlog would silently
absorb every new gap, which is the exact defect this decision exists to close.

## Boundaries

**This checks that a checker is named, not that it is meaningful.** A
`verified-by` entry may point at a test that merely mentions an ADR without
constraining it. That is a real limit and worth stating plainly rather than
implying the gate is stronger than it is: while writing this, grepping for tests
citing ADR-001 and ADR-003 returned hits that turned out to be **fixture strings
inside the ADR linter's own test suite**. `verified-by` cannot be auto-derived
for the same reason, so the backlog shrinks only by authored work, never by a
script.

The companion limit is a pack that cannot fail — a conformance test asserting
something trivially true reads as coverage while checking nothing. A pack should
be demonstrated by breaking what it guards and watching it go red. Neither limit
is machine-checkable; both are review's job.

This decision governs ADRs, not code style. It says nothing about what a
decision may contain, only that a decision claiming a machine enforces it must
say which machine.

## Consequences

`enforcement` stops being decoration. A reader can go from any ADR claiming
automation to the thing that proves it, and CI fails when a new decision makes
the claim without the proof. The 50 pre-existing gaps become a counted, visible
number that can only go down, instead of an unknown discovered by grepping.

The costs, plainly: authoring a checker is now part of the cost of ratifying a
decision, which makes ADRs more expensive to write — the intended trade, since
an unenforced decision was cheap precisely because it was not real. The backlog
could become furniture; the printed count and the ratchet make that visible but
do not force progress. And a rule requiring evidence can be satisfied with weak
evidence, which review must catch.

This ADR is subject to its own rule: it declares `enforcement: code` and names
the tests for the rule that implements it. A root decision that mandated
`verified-by` while leaving its own empty would be self-refuting, and the
funniest possible instance of the defect it closes.

## References

- ADR-075 — the ADR library under drift control; this extends that from the
  library's own metadata to the decisions recorded in it.
- ADR-082 — the platform migration registry, which solved the same shape of
  problem for developer-owned files that regeneration cannot reach.
- `packages/runtime/src/__tests__/boundary.test.ts` — the conformance pattern
  that already existed and is generalised here.

# Architecture Decision Records

The **canonical ADR index** for this repo is [`docs/spec.md#adr-index`](../spec.md#adr-index).
It lists every ADR with title, area, and status, and `CLAUDE.md` points contributors there
before making any architectural decision.

This file exists only to add what the spec doesn't: the **PDR ↔ ADR mapping**, so a
product decision can be traced to the architecture decisions that implement it.

## PDR ↔ ADR mapping

| PDR | ADRs that implement it |
| --- | ---------------------- |
| [PDR-001](../product-decisions/PDR-001-generate-dont-handwrite.md) — Generate, don't hand-write | ADR-001 lifecycle re-entrancy guard; ADR-002 lifecycle hook execution; ADR-003 no custom phases; ADR-004 handler array support; ADR-005 handler discovery; ADR-009 language → template selection; ADR-013 generated MFE test templates; ADR-026 load capability (atomic); ADR-040 manifest-declared handler sources; ADR-043 manifest-driven codegen pipeline; ADR-044 production container hardening for generated MFEs; ADR-050 dependency governance (pinning, hasBff gate, DEPENDENCY_VERSIONS); ADR-051 Angular 19 upgrade (resolve XSS CVEs); ADR-052 BFF demo mode (per-request mock switch via resolversComposition) |
| [PDR-002](../product-decisions/PDR-002-language-neutral-platform-contract.md) — Language-/framework-neutral contract | ADR-034 pluggable bundler + framework via codegen variants; ADR-036 framework plugins (`BaseFrameworkPlugin`); ADR-021 package namespace strategy; ADR-041 BaseMFE capability contract; ADR-042 MFE lifecycle state machine |
| [PDR-003](../product-decisions/PDR-003-ai-native-tooling.md) — AI-native tooling | ADR-033 two-headed giant; ADR-016 BaseCommand pattern; ADR-017 typed error hierarchy; ADR-018 CommandResult\<T\> envelope; ADR-019 MCP child-process isolation; ADR-030 error classification |
| [PDR-004](../product-decisions/PDR-004-plugin-first-ecosystem.md) — Plugin-first ecosystem | ADR-022 plugin-first architecture; ADR-021 package namespace strategy; ADR-015 oclif migration |
| [PDR-005](../product-decisions/PDR-005-runtime-composition.md) — Runtime composition | ADR-054 control-plane message protocol; ADR-055 LayoutManager (daemon-driven slot composition); ADR-056 MFE presentation boundary (polyglot VM / host-side providers); ADR-057 virtualized daemon socket (per-slot `DaemonChannel`); ADR-058 slot-provider MFEs; ADR-059 `BaseControlPlane` abstract base; ADR-060 contextualized VM composition (value-injection + slot-scoped self-healing + control-plane re-resolution; supersedes ADR-056's deferred in-tree provider). (054/055/057/058 Implemented; 056/059/060 Accepted — see `spec.md#adr-index` for canonical status.) |
| [PDR-006](../product-decisions/PDR-006-ecosystem-scaling-thesis.md) — Ecosystem scaling thesis | Composes PDR-001–005. See `CLAUDE.md` ("What this project is") for the canonical product framing. |

## Numbering hygiene

ADR numbers come from the next free slot in [`docs/spec.md#adr-index`](../spec.md#adr-index). 
Check there before claiming a number — the 068/069 collision from PRs #161 and #153 was
resolved by the library remediation (PR #194) when the whole set was reflowed sequentially
into 001–040, and the index is now the single source of truth.

## Status reconciliation (erratum)

The **single source of truth for ADR status** is the status column of
[`docs/spec.md#adr-index`](../spec.md#adr-index). Where an individual ADR file's frontmatter
or a generated code comment disagrees with the index, **the index wins**; do not edit ADR
bodies to reconcile (per `CLAUDE.md`, ADRs are not edited mid-implementation — add a new ADR
or record the correction here).

Known reconciliations from the platform design review (see the
[Contract Alignment Pass](../platform-design-review/contract-alignment-pass.md)):

| Item | What the index says | Note |
| --- | --- | --- |
| Status vocabulary | `Accepted` vs `Implemented` | `Accepted` = decision ratified; `Implemented` = code in place. The CLI contract ADRs (016–019) are `Accepted` and also shipped — read them as implemented. |
| ADR-007 Authorization grammar | `Deferred` | Correct — `authorization` is an `unknown` optional field in the manifest (`src/dsl/schema.ts:415`); the grammar is not yet designed. |
| ADR-018 envelope shape | `Accepted` | The **implemented** envelope (`{ok, error.code: number, warnings[], telemetry}`) is documented in the canonical [CLI Contract](../cli-contract.md), which supersedes ADR-018's older prose (finding CA-1). |
| BFF template ADR numbers | n/a | **Resolved (2026-07-01).** Generated BFF/MFE templates now cite the canonical numbers `ADR-012` (Mesh BFF) / `ADR-027` (Mesh v0.100.x plugins); the Angular MFE template's framework ref was also corrected `ADR-069`→`ADR-034`. No template retains the pre-reflow `ADR-046`/`ADR-062`/`ADR-069` numbers. |

## Historical narrative

The long-form historical narrative remains in
[`architecture-decisions.md`](./architecture-decisions.md). It predates the per-ADR file
split. Use it for context; use [`spec.md`](../spec.md#adr-index) for current state.
</content>

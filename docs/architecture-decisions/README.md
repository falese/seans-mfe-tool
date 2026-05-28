# Architecture Decision Records

The **canonical ADR index** for this repo is [`docs/spec.md#adr-index`](../spec.md#adr-index).
It lists every ADR with title, area, and status, and `CLAUDE.md` points contributors there
before making any architectural decision.

This file exists only to add what the spec doesn't: the **PDR ↔ ADR mapping**, so a
product decision can be traced to the architecture decisions that implement it.

## PDR ↔ ADR mapping

| PDR | ADRs that implement it |
| --- | ---------------------- |
| [PDR-001](../product-decisions/PDR-001-generate-dont-handwrite.md) — Generate, don't hand-write | ADR-001 lifecycle re-entrancy guard; ADR-002 lifecycle hook execution; ADR-003 no custom phases; ADR-004 handler array support; ADR-005 handler discovery; ADR-009 language → template selection; ADR-013 generated MFE test templates; ADR-026 load capability (atomic); ADR-040 manifest-declared handler sources; ADR-043 manifest-driven codegen pipeline |
| [PDR-002](../product-decisions/PDR-002-language-neutral-platform-contract.md) — Language-/framework-neutral contract | ADR-034 pluggable bundler + framework via codegen variants; ADR-036 framework plugins (`BaseFrameworkPlugin`); ADR-021 package namespace strategy; ADR-041 BaseMFE capability contract; ADR-042 MFE lifecycle state machine |
| [PDR-003](../product-decisions/PDR-003-ai-native-tooling.md) — AI-native tooling | ADR-033 two-headed giant; ADR-016 BaseCommand pattern; ADR-017 typed error hierarchy; ADR-018 CommandResult\<T\> envelope; ADR-019 MCP child-process isolation; ADR-030 error classification |
| [PDR-004](../product-decisions/PDR-004-plugin-first-ecosystem.md) — Plugin-first ecosystem | ADR-022 plugin-first architecture; ADR-021 package namespace strategy; ADR-015 oclif migration |
| [PDR-005](../product-decisions/PDR-005-runtime-composition.md) — Runtime composition | **Pending** — landing through PR #153 (still draft); will add ADRs for `shell:init`, daemon control plane, daemon transport protocol, and MFE remote naming when merged. Numbers will be assigned from the next free ADR slot at merge time. |
| [PDR-006](../product-decisions/PDR-006-ecosystem-scaling-thesis.md) — Ecosystem scaling thesis | Composes PDR-001–005. See `CLAUDE.md` ("What this project is") for the canonical product framing. |

## Numbering hygiene

ADR numbers come from the next free slot in [`docs/spec.md#adr-index`](../spec.md#adr-index). 
Check there before claiming a number — the 068/069 collision from PRs #161 and #153 was
resolved by the library remediation (PR #194) when the whole set was reflowed sequentially
into 001–040, and the index is now the single source of truth.

## Historical narrative

The long-form historical narrative remains in
[`architecture-decisions.md`](./architecture-decisions.md). It predates the per-ADR file
split. Use it for context; use [`spec.md`](../spec.md#adr-index) for current state.
</content>

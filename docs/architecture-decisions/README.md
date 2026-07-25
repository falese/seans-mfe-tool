# Architecture Decision Records

The **canonical ADR index** for this repo is [`docs/spec.md#adr-index`](../spec.md#adr-index).
It lists every ADR with title, area, and status, and `CLAUDE.md` points contributors there
before making any architectural decision.

This file exists only to add what the spec doesn't: the **PDR ↔ ADR mapping**, so a
product decision can be traced to the architecture decisions that implement it.

## PDR ↔ ADR mapping

| PDR | ADRs that implement it |
| --- | ---------------------- |
| [PDR-001](../product-decisions/PDR-001-generate-dont-handwrite.md) — Generate, don't hand-write | ADR-001 lifecycle re-entrancy guard; ADR-002 lifecycle hook execution; ADR-003 no custom phases; ADR-004 handler array support; ADR-005 handler discovery; ADR-009 language → template selection; ADR-013 generated MFE test templates; ADR-026 load capability (atomic); ADR-040 manifest-declared handler sources; ADR-043 manifest-driven codegen pipeline; ADR-044 production container hardening for generated MFEs; ADR-050 dependency governance (pinning, hasBff gate, DEPENDENCY_VERSIONS); ADR-051 Angular 19 upgrade (resolve XSS CVEs); ADR-052 BFF demo mode (per-request mock switch via resolversComposition); ADR-061 `@seans-mfe/dsl` + `@seans-mfe/codegen` as packages (framework variant injected, not resolved); ADR-071 manifest-driven client dependencies + federation shared |
| [PDR-002](../product-decisions/PDR-002-language-neutral-platform-contract.md) — Language-/framework-neutral contract | ADR-034 pluggable bundler + framework via codegen variants; ADR-036 framework plugins (`BaseFrameworkPlugin`); ADR-021 package namespace strategy; ADR-041 BaseMFE capability contract; ADR-042 MFE lifecycle state machine; ADR-064 runtime as a semver-published package (retire `dist/runtime` staging; tracked in #252) |
| [PDR-003](../product-decisions/PDR-003-ai-native-tooling.md) — AI-native tooling | ADR-033 two-headed giant; ADR-016 BaseCommand pattern; ADR-017 typed error hierarchy; ADR-018 CommandResult\<T\> envelope; ADR-019 MCP child-process isolation; ADR-030 error classification |
| [PDR-004](../product-decisions/PDR-004-plugin-first-ecosystem.md) — Plugin-first ecosystem | ADR-022 plugin-first architecture; ADR-021 package namespace strategy; ADR-015 oclif migration; ADR-062 deploy is dev-convenience only (production returns as plugin-resolved deploy-target axis; tracked in #250); ADR-063 API-backend generation as a plugin axis (default `@seans-mfe/api-express`, OSS wrappers as alt plugins; tracked in #251) |
| [PDR-005](../product-decisions/PDR-005-runtime-composition.md) — Runtime composition | ADR-054 control-plane message protocol; ADR-055 LayoutManager (daemon-driven slot composition); ADR-056 MFE presentation boundary (polyglot VM / host-side providers); ADR-057 virtualized daemon socket (per-slot `DaemonChannel`); ADR-058 slot-provider MFEs; ADR-059 `BaseControlPlane` abstract base; ADR-060 contextualized VM composition (value-injection + slot-scoped self-healing + control-plane re-resolution; supersedes ADR-056's deferred in-tree provider); ADR-066 stable slot addressing + desired-state placement (assigned ids, deferred binding; tracked in #265); ADR-067 manifest-declared slot contract (`providesSlots` → generated `slots.tsx` for React or `slots.ts` for Angular; #265); ADR-068 provider-scoped slot addresses (`mfe/id` + lifecycle owner token; #265); ADR-069 slot grammar single-sourced in contracts (#265); ADR-072 sanctioned slot registration API (`DeclaredSlot` is the app-code API; generated `DeclaredSlotId` makes a manifest rename a compile error); ADR-073 slot contract logic relocated to `@seans-mfe/contracts` + design-time placement-target validation (`mfe:validate`, `slots:validate`, registry rule-save checks); ADR-074 the MFE registration is a build artifact (generated from the manifest; `routes` stay hand-authored; records the #272 `./App` expose convention) — **Proposed**; ADR-070 experience-scoped federated supergraph (daemon-hosted Mesh gateway composes participant MFE BFF schemas per experience; control plane owns the data-fetch lifecycle; **Accepted, impl phased**). (054/055/057/058 Implemented; 056/059/060/066/067/068/069 Accepted; 070 Accepted (impl phased) — see `spec.md#adr-index` for canonical status.) |
| [PDR-006](../product-decisions/PDR-006-ecosystem-scaling-thesis.md) — Ecosystem scaling thesis | Composes PDR-001–005. See `CLAUDE.md` ("What this project is") for the canonical product framing. |
| [PDR-007](../product-decisions/PDR-007-model-messy-reality.md) — Reference apps model messy reality | ADR-066 stable slot addressing (an experience composes MFEs that disagree about conventions); ADR-067 manifest-declared slot contract; ADR-070 experience-scoped federated supergraph (participant BFFs with overlapping domains); ADR-075 the ADR library under drift control (the register admits its own gaps rather than presenting a tidy fiction). Added in the ADR-075 pass — PDR-007 had been missing from this map since it landed. |

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
| ADR-007 Authorization grammar | `Deferred` | Correct — the grammar is not yet designed. **Path corrected (ADR-075 pass):** the erratum previously cited `src/dsl/schema.ts:415`, a file ADR-061 moved. The field is now `packages/dsl/src/schema.ts:474` (`authorization: z.unknown().optional()`), and a second, narrower `authorization: z.string().optional()` sits at `:151`. |
| ADR-018 envelope shape | `Accepted` | The **implemented** envelope (`{ok, error.code: number, warnings[], telemetry}`) is documented in the canonical [CLI Contract](../cli-contract.md), which supersedes ADR-018's older prose (finding CA-1). |
| BFF template ADR numbers | n/a | **Partly resolved.** The *templates* were fixed 2026-07-01 (`ADR-012` Mesh BFF / `ADR-027` Mesh plugins; the Angular framework ref `ADR-069`→`ADR-034`). **Corrected (ADR-075 pass):** the previous wording claimed the problem was gone. It is not — committed *generated output* under `examples/` still carries the pre-reflow numbers (44 files with `ADR-046`, 25 with `ADR-062`, 9 with `ADR-069`). Those files fell out of the generation graph and no gate walks them; `npm run check:adr -- --include-examples` reports them. Tracked separately. |

### Cross-references corrected in the ADR-075 normalization pass

PR #194 renumbered the ADR files into 001–040 and never rewrote the references
*inside* ADR bodies. Twelve pointed at a number whose meaning had changed —
each resolving to a real file about something else. Repointed where a modern
decision carries the idea; **removed** where none does, since a guess would be
worse than a gap:

| Was | In | Now |
| --- | --- | --- |
| `ADR-013: Language-Agnostic DSL Contract` | ADR-005, ADR-006, ADR-009 | `PDR-002` — language-/framework-neutral platform contract |
| `ADR-013: BaseMFE abstract base` | ADR-025, ADR-026 | `ADR-041` — the repoint ADR-041 §Context identified and applied only to the code comment |
| `ADR-001: GraphQL Data Standardization` | ADR-006 | `ADR-012` — GraphQL Mesh BFF layer |
| `ADR-001: GraphQL Data Standardization` | ADR-012 | **removed** — a self-reference once repointed |
| `ADR-008: TypeScript Strict Mode` | ADR-014 | `ADR-023` — no-any TypeScript discipline |
| `ADR-031: Standardized Extensible Lifecycle Hooks` | ADR-002, ADR-003 | **removed** — pre-reflow; the four-phase model is ADR-003 itself and the execution semantics are ADR-002 |
| `ADR-019: JWT-Based Authorization` | ADR-007 | **removed** — pre-reflow; no ADR designs authorization, which is precisely what ADR-007 defers |

Three stale numbers in *code* were repointed in the same pass: `ADR-048`→`ADR-014`
(`src/utils/manifestValidator.js`), `ADR-045`→`ADR-011`
(`packages/bff-plugin/templates/mfe-manifest.yaml.ejs` — a template, so every
generated MFE had inherited it), and `packages/runtime/src/base-mfe.ts` no longer
calls the shipped retry/timeout stages "proposed".

## Historical narrative

The long-form historical narrative remains in
[`architecture-decisions.md`](./architecture-decisions.md). It predates the per-ADR file
split. Use it for context; use [`spec.md`](../spec.md#adr-index) for current state.
</content>

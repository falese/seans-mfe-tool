# Architecture Decision Records

The **canonical ADR index** for this repo is [`docs/spec.md#adr-index`](../spec.md#adr-index).
It lists every ADR with title, area, and status, and `CLAUDE.md` points contributors there
before making any architectural decision.

This file exists only to add what the spec doesn't: the **PDR ↔ ADR mapping**, so a
product decision can be traced to the architecture decisions that implement it.

## PDR ↔ ADR mapping

**Generated** from each ADR's `implements-pdr` frontmatter (ADR-075 §1) — do not
hand-edit. Run `npm run build:adr-index` after changing that field; CI gates it with
`npm run build:adr-index:check`.

The per-ADR glosses this table used to carry ("ADR-001 lifecycle re-entrancy guard")
were hand-written restatements of each ADR's own title, and they drifted like every
other restated fact: the PDR-005 row ended with a status recap that the ADR-075 §6
reconciliation falsified the moment it landed. The generated table uses the titles.

<!-- BEGIN GENERATED: pdr-adr-map -->

| PDR | ADRs that implement it |
| --- | ---------------------- |
| [PDR-001](../product-decisions/PDR-001-generate-dont-handwrite.md) — Generate MFEs from a manifest; don't hand-write them | [ADR-001](./ADR-001-lifecycle-reentrancy-guard.md) Lifecycle Re-Entrancy Guard in BaseMFE; [ADR-002](./ADR-002-lifecycle-hook-execution-model.md) Lifecycle Hook Execution Model; [ADR-003](./ADR-003-no-custom-lifecycle-phases.md) No Custom Lifecycle Phases; [ADR-004](./ADR-004-handler-array-support.md) Handler Array Support; [ADR-005](./ADR-005-handler-discovery-convention.md) Handler Discovery Convention; [ADR-009](./ADR-009-language-field-template-selection.md) Language Field and Template Selection; [ADR-013](./ADR-013-generated-mfe-test-templates.md) Generated MFE Test Templates; [ADR-026](./ADR-026-load-capability-atomic.md) Load Capability — Atomic Operation Design; [ADR-040](./ADR-040-manifest-declared-handler-sources.md) Manifest-Declared Handler Sources; [ADR-043](./ADR-043-manifest-driven-codegen.md) Manifest-Driven Code Generation Pipeline; [ADR-044](./ADR-044-production-container-hardening.md) Production Container Hardening for Generated MFEs; [ADR-050](./ADR-050-dependency-governance.md) Dependency Governance — Pinning Strategy, hasBff Gate, and DEPENDENCY_VERSIONS; [ADR-051](./ADR-051-angular-19-upgrade.md) Angular 19 Upgrade — Resolve XSS CVEs in Generated MFEs; [ADR-052](./ADR-052-bff-demo-mode-mock-switch.md) BFF Demo Mode — Per-Request Mock Switch via resolversComposition; [ADR-061](./ADR-061-dsl-and-codegen-as-packages.md) `@seans-mfe/dsl` and `@seans-mfe/codegen` as first-class packages; framework variant is injected, not resolved; [ADR-071](./ADR-071-manifest-driven-client-dependencies.md) Manifest-Driven Client Dependencies and Federation Shared; [ADR-082](./ADR-082-platform-migrations-warn-never-rewrite.md) The platform reports its own breaking changes in code it does not own, and never rewrites that code |
| [PDR-002](../product-decisions/PDR-002-language-neutral-platform-contract.md) — One language- and framework-neutral platform contract | [ADR-021](./ADR-021-package-namespace-strategy.md) Package namespace strategy — @seans-mfe/* vs @falese/*; [ADR-034](./ADR-034-pluggable-bundler-framework.md) Pluggable bundler + framework via codegen variants; [ADR-036](./ADR-036-framework-plugins.md) Framework plugins — abstract BaseFrameworkPlugin with concrete implementations; [ADR-041](./ADR-041-base-mfe-abstract-base.md) BaseMFE Abstract Base Class & Platform Capability Contract; [ADR-042](./ADR-042-mfe-lifecycle-state-machine.md) MFE Lifecycle State Machine; [ADR-064](./ADR-064-runtime-as-a-published-package.md) The runtime's future is a semver-published package, not a staged `dist/runtime` folder; [ADR-076](./ADR-076-platform-handler-dispatch.md) Platform handlers dispatch by exported function name from a static library, not a registry class; [ADR-079](./ADR-079-single-execution-substitution-seam.md) There is one seam for substituting handler execution, and it sits inside the lifecycle contract; [ADR-080](./ADR-080-platform-contract-single-source.md) The ten platform capabilities and the MFE lifecycle machine are defined once, in `@seans-mfe/contracts` |
| [PDR-003](../product-decisions/PDR-003-ai-native-tooling.md) — AI-native, agent-operable tooling | [ADR-016](./ADR-016-base-command-pattern.md) BaseCommand pattern — every oclif command extends BaseCommand; [ADR-017](./ADR-017-typed-error-hierarchy.md) Typed error hierarchy — never throw raw Error; [ADR-018](./ADR-018-command-result-envelope.md) CommandResult\<T\> JSON envelope — single stdout line under --json; [ADR-019](./ADR-019-mcp-child-process-isolation.md) MCP child-process isolation — spawn seans-mfe-tool per tool call; [ADR-030](./ADR-030-error-classification.md) Error Classification with Hybrid Detection; [ADR-033](./ADR-033-two-headed-giant-developer-model.md) Two-headed giant — AI-native + human-legible developer experience; [ADR-077](./ADR-077-two-headed-giant-re-derived.md) The two-headed giant's implementation plan is re-derived from measured friction, not from the April spec |
| [PDR-004](../product-decisions/PDR-004-plugin-first-ecosystem.md) — Plugin-first federated ecosystem (not monorepo-first) | [ADR-015](./ADR-015-oclif-migration.md) oclif as CLI framework — replace Commander; [ADR-021](./ADR-021-package-namespace-strategy.md) Package namespace strategy — @seans-mfe/* vs @falese/*; [ADR-022](./ADR-022-plugin-first-architecture.md) Plugin-first architecture — falese/daemon and falese/coder as oclif plugins; [ADR-062](./ADR-062-deploy-is-dev-convenience-production-is-a-plugin-axis.md) `deploy` is a dev-convenience wrapper; production deployment returns as a plugin-resolved target axis; [ADR-063](./ADR-063-api-generation-as-a-plugin-axis.md) API-backend generation is a plugin axis, not a wrapper around one OSS codegen; [ADR-088](./ADR-088-coder-plugin-first-party-seam.md) The coder-facing seam is a first-party in-repo plugin; coder's model engine stays external |
| [PDR-005](../product-decisions/PDR-005-runtime-composition.md) — Runtime composition via shell + daemon control plane + registry | [ADR-054](./ADR-054-control-plane-message-protocol.md) Control-Plane Message Protocol as a Shared Contract in @seans-mfe/contracts; [ADR-055](./ADR-055-layout-manager-daemon-driven-shells.md) LayoutManager — Daemon-Driven Slot Composition for Generic Shells; [ADR-056](./ADR-056-mfe-presentation-boundary.md) MFE Presentation Boundary and Host-Side Composition Providers (Polyglot VM Model); [ADR-057](./ADR-057-virtualized-daemon-socket.md) Virtualized daemon socket: per-slot control-plane channels over one host connection; [ADR-058](./ADR-058-slot-provider-mfes.md) Slot-provider MFEs: MFEs contribute named slots to the host layout; [ADR-059](./ADR-059-base-control-plane.md) BaseControlPlane: abstract base for all control-plane implementations; [ADR-060](./ADR-060-contextualized-vm-composition.md) Contextualized VM composition: value-injection, slot-scoped self-healing, and control-plane re-resolution; [ADR-066](./ADR-066-stable-slot-addressing-desired-state-placement.md) Stable slot addressing and desired-state placement; [ADR-067](./ADR-067-manifest-declared-slot-contract.md) Manifest-declared slot contract: slots are declared in the DSL, code is generated from the declaration; [ADR-068](./ADR-068-provider-scoped-slot-addresses.md) Provider-scoped slot addresses; [ADR-069](./ADR-069-slot-grammar-single-source.md) Slot grammar single-sourced in contracts; [ADR-070](./ADR-070-control-plane-owned-data-fetch-lifecycle.md) Experience-scoped federated supergraph (control-plane-composed data over participant MFE BFFs); [ADR-072](./ADR-072-slot-registration-api.md) The sanctioned slot registration API: `DeclaredSlot`, typed by the manifest; [ADR-073](./ADR-073-slot-contract-in-contracts-design-time-validation.md) Slot contract logic moves to `@seans-mfe/contracts`; placement targets become validatable; [ADR-074](./ADR-074-registration-is-a-build-artifact.md) The MFE Registration Is a Build Artifact — Register on Build, Not by Hand; [ADR-078](./ADR-078-control-plane-in-platform.md) The control plane ships in the platform, and a composition environment is generated from a manifest; [ADR-083](./ADR-083-control-plane-composition-dsl.md) Composition is authored in a project-scoped DSL, not hand-written registry JSON |
| [PDR-006](../product-decisions/PDR-006-ecosystem-scaling-thesis.md) — Ecosystem scaling thesis | _none recorded_ |
| [PDR-007](../product-decisions/PDR-007-model-messy-reality.md) — Reference apps model messy reality — overlapping APIs, clashing conventions, honest gaps | [ADR-066](./ADR-066-stable-slot-addressing-desired-state-placement.md) Stable slot addressing and desired-state placement; [ADR-067](./ADR-067-manifest-declared-slot-contract.md) Manifest-declared slot contract: slots are declared in the DSL, code is generated from the declaration; [ADR-070](./ADR-070-control-plane-owned-data-fetch-lifecycle.md) Experience-scoped federated supergraph (control-plane-composed data over participant MFE BFFs); [ADR-075](./ADR-075-adr-library-under-drift-control.md) The ADR Library Is Itself Under Drift Control |
| [PDR-008](../product-decisions/PDR-008-control-plane-is-platform.md) — The control plane is part of the platform, not a plugin | [ADR-083](./ADR-083-control-plane-composition-dsl.md) Composition is authored in a project-scoped DSL, not hand-written registry JSON |
| [PDR-009](../product-decisions/PDR-009-generative-software-system.md) — A generative software system — business intents compile to the platform contract, continuously | [ADR-084](./ADR-084-intent-manifest-boundary.md) Generation targets the manifest, not source — the intent→manifest step is the one stochastic seam; [ADR-085](./ADR-085-coder-intent-compiler-seam.md) Intent-compilation invokes coder as an external local model service; coder is the tunable open-weight implementation; [ADR-086](./ADR-086-continuous-generation-loop.md) The generation loop closes on the existing CI gates; continuous deployment waits on registry persistence; [ADR-087](./ADR-087-hybrid-authoring-developer-owned-lane.md) Coder's source adaptor fills developer-owned feature files; the generator-owned lane stays deterministic; [ADR-088](./ADR-088-coder-plugin-first-party-seam.md) The coder-facing seam is a first-party in-repo plugin; coder's model engine stays external |

<!-- END GENERATED: pdr-adr-map -->

## Numbering hygiene

ADR numbers come from the next free slot in [`docs/spec.md#adr-index`](../spec.md#adr-index). 
Check there before claiming a number — the 068/069 collision from PRs #161 and #153 was
resolved by the library remediation (PR #194) when the whole set was reflowed sequentially
into 001–040, and the index is now the single source of truth.

## Where ADR metadata lives

The **single source of truth is each ADR's own frontmatter** (ADR-075 §1). The
`docs/spec.md#adr-index` table and the PDR↔ADR map above are *generated views* of it,
under a `--check` diff gate.

This inverts the rule that stood here before: "where a file disagrees with the index,
the index wins". That was a reasonable response to having two hand-maintained copies.
The better response was to stop having two — and the reconciliation rows this section
used to carry are gone because the disagreements they recorded are no longer
representable.

To change an ADR's status, area, or PDR mapping: edit the frontmatter, run
`npm run build:adr-index`, and commit both. `npm run check:adr` validates the
frontmatter itself; `npm run build:adr-index:check` proves the views match it.

### Errata that outlived the reconciliation

| Item | Note |
| --- | --- |
| Status vocabulary | `Accepted` = decision ratified; `Implemented` = code in place. Both are in the closed enum (ADR-075 §2), and §6 defines when a decision may claim each. |
| ADR-007 Authorization grammar | `Deferred` is correct — the grammar is not yet designed. **Path corrected (ADR-075 pass):** this previously cited `src/dsl/schema.ts:415`, a file ADR-061 moved. The field is now `packages/dsl/src/schema.ts:474` (`authorization: z.unknown().optional()`), with a narrower `authorization: z.string().optional()` at `:151`. |
| ADR-018 envelope shape | The **implemented** envelope (`{ok, error.code: number, warnings[], telemetry}`) is documented in the canonical [CLI Contract](../cli-contract.md), which supersedes ADR-018's older prose (finding CA-1). |
| BFF template ADR numbers | **Partly resolved.** The *templates* were fixed 2026-07-01 (`ADR-012` Mesh BFF / `ADR-027` Mesh plugins; the Angular framework ref `ADR-069`→`ADR-034`). **Corrected (ADR-075 pass):** the previous wording claimed the problem was gone. It is not — committed *generated output* under `examples/` still carries the pre-reflow numbers (44 files with `ADR-046`, 25 with `ADR-062`, 9 with `ADR-069`). Those files fell out of the generation graph and no gate walks them; `npm run check:adr -- --include-examples` reports them. Tracked separately. |

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

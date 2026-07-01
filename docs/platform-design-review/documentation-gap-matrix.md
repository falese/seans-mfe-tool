# Documentation Gap Matrix

**Part of:** [Platform Design Review](./README.md) · DOCS-P2 (#217)
**Depends on:** #212, #213, #214, #216 (P1 deliverables)

A comprehensive inventory of documentation gaps in SMT. Each gap carries: **severity**, **audience impact**, **effort**, a **fix recommendation**, a **suggested owner**, and **acceptance criteria**. Pillars refer to the [Architecture Pillar Model](./architecture-pillar-model.md).

## Legend

- **Severity** — `S1` critical (blocks correct use / misleads adopters), `S2` high (significant friction), `S3` medium (quality/clarity), `S4` low (polish).
- **Effort** — `XS` (<½ day), `S` (½–1 day), `M` (2–4 days), `L` (1–2 weeks).
- **Audience** — Adopter (shell operator / integrator), Contributor (platform dev), Agent (AI operating the CLI), Exec (stakeholder).
- **Owner** — suggested role, not a person assignment.

## Summary by severity

| Severity | Count |
|---|---|
| S1 | 6 |
| S2 | 13 |
| S3 | 12 |
| S4 | 4 |
| **Total** | **35** |

---

## Matrix

| ID | Gap | Pillar | Audience | Sev | Effort | Suggested owner | Fix recommendation | Acceptance criteria | Tracking |
|----|-----|--------|----------|:--:|:--:|-----------------|--------------------|---------------------|----------|
| G01 | `architecture-codegen.md` is "Coming Soon" — no consolidated codegen reference | 3 | Contributor, Agent | S1 | M | Codegen owner | Author the doc: UnifiedGenerator flow, template catalog, variant resolution, ownership markers, regeneration safety | File exists; pipeline diagram + template catalog + ownership-marker contract present; linked from `architecture-current-state.md` | ✅ #228 (`architecture-codegen.md`) |
| G02 | `architecture-dsl.md` is "Coming Soon" | 2 | Contributor, Agent | S2 | M | DSL owner | Author DSL/type-system reference; generate manifest field table from Zod schema | File exists; every manifest field documented with validation rule + example | ✅ #228 (`architecture-dsl.md`) |
| G03 | `architecture-bff.md` is "Coming Soon" | 6 | Adopter, Contributor | S2 | M | BFF owner | Author BFF reference: Mesh composition, context/JWT injection, demo-mode, version pinning | File exists; composition flow + demo-mode + pinning rationale documented | ✅ #228 (`architecture-bff.md`) |
| G04 | `architecture-api-generator.md` is "Coming Soon" | 3 | Adopter | S3 | M | Codegen owner | Author API-generator reference (OpenAPI → controllers/routes/db) | File exists; SQLite + MongoDB paths documented | ✅ #228 (`architecture-api-generator.md`) |
| G05 | No single CLI contract reference (envelope shape, stdout/stderr rules, exit-code table) | 1 | Agent, Adopter | S1 | S | CLI owner | Consolidate `CommandResult<T>`, stdout/stderr rules, full exit-code table into one doc | One doc enumerates envelope + all exit codes; matches `BaseCommand` | ✅ #228 (`cli-contract.md`) |
| G06 | JSON-mode side-effects (what writes to stdout vs stderr) not documented per command | 1 | Agent | S1 | S | CLI owner | Document JSON-mode behavior + verify with conformance test | "exactly one JSON line on stdout" documented and tested | ✅ #228 docs (`cli-contract.md` §2); conformance test in [#243](https://github.com/falese/seans-mfe-tool/pull/243) (CA-2) |
| G07 | Query URL resolution / fallback order undocumented | 5,6 | Adopter, Agent | S1 | S | Runtime owner | Document `query()` URL resolution + fallback order, cite impl files | Fallback order documented with file citations | ✅ #228 (`architecture-bff.md` §5 + runbook) |
| G08 | `emit()` / `describe()` state-machine constraints not clarified | 5 | Adopter, Agent | S2 | S | Runtime owner | Document valid states for `emit`/`describe`; cite state machine (ADR-042) | Constraints documented + cross-referenced to ADR-042 | ✅ #228 (CA-5/CA-6; `runtime-class-hierarchy.md` diagram fixed) |
| G09 | No MCP operating playbook (`mcp.json`, federation, collisions, perf) | 7 | Agent, Adopter | S1 | M | MCP owner | Author MCP playbook: config schema, 3-source federation, collision rules, ~200–400ms per-call cost | Playbook exists; `mcp.json` schema + collision behavior + perf profile documented | #221 |
| G10 | Framework-plugin authoring lacks a worked 3rd-framework example | 4 | Contributor | S2 | M | Framework owner | Add end-to-end "author a minimal framework plugin" walkthrough | Walkthrough produces a working stub plugin; `loadFrameworkPlugin()` resolves it | #221 |
| G11 | No per-capability runtime status matrix (shipped/in-progress/planned) | 5 | Adopter | S1 | S | Runtime owner | Add capability×status matrix in runtime doc, synced to issues #47–59 | Each of 10 capabilities has an explicit status | #216 follow-up |
| G12 | Control-plane / daemon (ADR-054–058) under-documented relative to shipped protocol | 5 | Adopter, Contributor | S2 | M | Runtime owner | Decide pillar split; author control-plane doc (message protocol, socket, slot providers) | Control-plane doc exists; protocol + socket + slot-provider model covered | #218 |
| G13 | Manifest field reference not generated from schema (drift risk) | 2 | Contributor, Agent | S2 | M | DSL owner | Generate field reference from `src/dsl/schema.ts` | Generated reference in CI; drift fails build | G02 |
| G14 | ADR-007 (auth expression grammar) deferred but not flagged in schema docs | 2 | Adopter | S3 | XS | DSL owner | Add "deferred / not enforced" callout in schema reference | Callout present where auth fields are described | ✅ #228 (`architecture-dsl.md` §1 + ADR register erratum) |
| G15 | Stale/broken cross-references (e.g. `runtime-requirements.md` path, `.github/agents/...`) | all | Contributor | S2 | S | Docs owner | Run link audit; fix or redirect dead links; adopt relative-link standard | Link check passes; no dead internal links | #222; report-only CI check in [#244](https://github.com/falese/seans-mfe-tool/pull/244) (21 preexisting broken links remain to clear before gating) |
| G16 | `docs/README.md` documents an "Agent System", not a docs index — misleading entry point | IA | All | S2 | S | Docs owner | Repurpose/rename to a canonical docs index, or relocate agent-system content | `docs/README.md` is a navigable TOC of current docs | #218 |
| G17 | No canonical top-level docs TOC / navigation | IA | All | S1 | S | Docs owner | Publish canonical TOC (see Information Architecture) | TOC published and linked from root README | #218 |
| G18 | No source-of-truth ownership map (which doc owns which fact) | IA | Contributor | S2 | S | Docs owner | Publish ownership map (status → PROJECT-STATUS, decisions → ADRs, etc.) | Ownership map published | #218 |
| G19 | No naming standards for ADR / REQ / architecture docs | IA | Contributor | S3 | XS | Docs owner | Document naming + numbering conventions | Naming standard published | #218 |
| G20 | PROJECT-STATUS says lifecycle-enhancement issues "not yet created" — verify vs reality | — | Contributor | S3 | XS | Docs owner | Reconcile against GitHub; update status | Statement matches actual issue state | #216 follow-up |
| G21 | Generated-project layout (GENERATED vs DEVELOPER-OWNED) not documented | 3 | Adopter, Agent | S2 | S | Codegen owner | Document generated file tree + ownership markers | Layout + marker semantics documented | G01 |
| G22 | `bff:init` standalone demo-mode emission gap undocumented | 6 | Adopter | S3 | S | BFF owner | Document known gap + workaround; link the issue | Known-issue entry references #199 | #199 |
| G23 | Generated `.tsx` import-extension `tsc` issue not listed as known issue | 3 | Adopter | S3 | XS | Codegen owner | Add known-issue note; link the fix issue | Known-issue entry references #209 | #209 |
| G24 | ESLint warning backlog (276 warnings) not surfaced for contributors | — | Contributor | S4 | XS | Docs owner | Note the backlog + cleanup plan in contributor docs | Note present; links #208 | #208 |
| G25 | No security / threat-model doc (auth handler, JWT forwarding, secret validation) | 5,6 | Adopter, Exec | S2 | M | Security owner | Author security overview citing ADR-046, auth handler, JWT forwarding | Security doc covers authN/Z, secrets, container hardening (ADR-044) | new |
| G26 | ADR status drift (Proposed/Accepted/Implemented) — no status dashboard | all | Contributor | S3 | S | Docs owner | Add ADR status dashboard or generate from front-matter | Dashboard reflects each ADR's status field | #225 |
| G27 | No adopter "getting started for shell operators" guide | 1,5 | Adopter | S2 | M | Docs owner | Author shell-operator quickstart (install → compose an MFE) | Quickstart walks install → compose → run | ✅ #228 (`getting-started.md`) |
| G28 | No versioning/upgrade guide for `@seans-mfe/contracts` consumers | 1 | Adopter | S3 | S | Packages owner | Document semver policy + upgrade notes (ties to MERGE-PLAN Phase 1) | Versioning policy + upgrade guide published | MERGE-PLAN |
| G29 | No end-to-end "generate an MFE from a manifest" tutorial | 2,3 | Adopter, Agent | S2 | M | Docs owner | Author tutorial using `examples/abc-kids` | Tutorial reproduces a generated MFE start to finish | ~ #228 (`getting-started.md` covers the generic init→generate→run flow; an `examples/abc-kids`-specific walkthrough remains) |
| G30 | No consolidated testing-strategy doc (Jest + Playwright + coverage gates) | — | Contributor | S3 | S | QA owner | Document test layers, ignore patterns, coverage gate (ADR-037) | Testing doc covers unit/e2e/perf + CI gates | new |
| G31 | No glossary of platform terms | all | All | S3 | XS | Docs owner | Add glossary (capability, BFF, daemon, two-headed giant, control plane) | Glossary published; linked from docs index | #218 |
| G32 | Recurring date/status currency drift; no governance cadence | all | All | S2 | S | Docs owner | Adopt governance checklist + review cadence | Cadence + checklist adopted | #225, #226 |
| G33 | No documented exit-code → meaning table for agents | 1,7 | Agent | S2 | XS | CLI owner | Publish exit-code table (0,2,64,65,66,69,70,77,124) with meanings | Table published; matches ADR-033 set | ✅ #228 (`cli-contract.md` §3) |
| G34 | MERGE-PLAN status not reconciled with current shipped state | — | Contributor | S4 | XS | Docs owner | Reconcile MERGE-PLAN phases vs shipped work | MERGE-PLAN reflects current phase status | #216 follow-up |
| G35 | `archive/` vs active docs boundary unclear; archived planning docs still linked | IA | Contributor | S4 | XS | Docs owner | Mark archive clearly; remove/redirect active links into archive | Archive labeled; no active doc depends on archive | #218 |

---

## How to use this matrix

- **Sequencing** lives in the [90-Day Execution Roadmap](./execution-roadmap-90-day.md). S1 gaps are roadmap Phase-1 candidates.
- **IA-tagged gaps** (G16–G19, G31, G35) are resolved by the [Information Architecture Redesign](./information-architecture.md).
- **Contract-tagged gaps** (G05–G08, G33) are resolved by the [Contract Alignment Pass](./contract-alignment-pass.md).
- **Governance/currency gaps** (G26, G32) are owned by the [Governance Checklist & Rubric](./governance-checklist-and-rubric.md).
- Each gap's **acceptance criteria** is the merge bar for the PR that closes it.

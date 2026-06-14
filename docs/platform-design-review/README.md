# Platform Design Review

A structured architecture + documentation review of **seans-mfe-tool**, delivered against epic **#211 (Enterprise Documentation Refinement Program)**. It produces an enterprise-grade view of the platform, an honest readiness assessment, a complete gap inventory, and the plan + governance to close those gaps.

> **Naming.** The work is organized as a *platform design review*. The underlying GitHub epic/issues retain their "Enterprise…" titles; the deliverables and this folder use the design-review framing.

## Deliverables

### Phase 1 — Foundation (what the platform *is*)

| Doc | Issue | What it gives you |
|---|---|---|
| [Executive Architecture Narrative](./executive-architecture-narrative.md) | #212 | 2-page stakeholder framing: constant contract vs. swappable implementation; honest maturity/risk |
| [Architecture Pillar Model](./architecture-pillar-model.md) | #213 | The 7 pillars, each with boundary, decisions, risks, doc score, and upgrades |
| [AI-Native Readiness Scorecard](./ai-native-readiness-scorecard.md) | #214 | Evidence-based AI-native analysis; weighted 81/100 scorecard; maturity model |
| Project status + architecture currency refresh | #216 | Reconciled [`PROJECT-STATUS.md`](../PROJECT-STATUS.md) + [`architecture-current-state.md`](../architecture-current-state.md) |

### Phase 2 — Analysis (what's *missing* / *misaligned*)

| Doc | Issue | What it gives you |
|---|---|---|
| [Documentation Gap Matrix](./documentation-gap-matrix.md) | #217 | 35 gaps with severity, audience, effort, owner, fix, acceptance criteria |
| [Information Architecture Redesign](./information-architecture.md) | #218 | Canonical TOC, merge/split/deprecate plan, ownership map, naming standards |
| [Contract Alignment Pass](./contract-alignment-pass.md) | #219 | 7 docs-vs-code drift findings (envelope, `--json`, exit codes, query, states) with `file:line` |
| [Runtime Operational Runbook](./runtime-operational-runbook.md) | #220 | Operator-grade lifecycle troubleshooting, hook failure modes, capability diagnostics |
| [Framework Plugin Cookbook](./framework-plugin-cookbook.md) | #221 | Recipes for adding framework plugins; compatibility matrix; failure modes |
| [MCP Integration Playbook](./mcp-integration-playbook.md) | #221 | Tool federation, collision behavior, argv mapping, agent contract |
| [Cross-Reference Standards](./cross-reference-standards.md) | #222 | Link hygiene, normative/informative tagging, verification approach |

### Phase 3 — Execution (how it gets *fixed* and *stays fixed*)

| Doc | Issue | What it gives you |
|---|---|---|
| [90-Day Execution Roadmap](./execution-roadmap-90-day.md) | #223 | 3 phases, milestones, dependencies, owners, effort, success metrics |
| [Communication Pack](./communication-pack.md) | #224, #215 | One-pager, talk track, slides, exec memo, FAQ, objection handling, proves/remains |
| [Governance Checklist & Rubric](./governance-checklist-and-rubric.md) | #225 | Per-PR checklist, scoring rubric, ownership/cadence, documentation KPIs |
| [Documentation KPI Framework](./documentation-kpi-framework.md) | #226 | 5 KPI families, baseline, collection method, reporting cadence |
| [Enterprise Readiness Review](./enterprise-readiness-review.md) | #227 | Deliverable review, remediation actions (R1–R8), epic-closure recommendation |

### Execution — remediation deliverables (R1, R3, R4, R6, R8)

These are the net-new reference docs authored to close the gaps the review identified. They
live under `docs/` (next to the architecture docs they extend), not in this folder:

| Doc | Remediation | What it gives you |
|---|---|---|
| [CLI Contract](../cli-contract.md) | R1 | Canonical envelope, `--json` stdout/stderr rules, exit-code table |
| [Code Generation Architecture](../architecture-codegen.md) | R4 (G01) | UnifiedGenerator pipeline, template variants, ownership-marker contract |
| [DSL & Type System](../architecture-dsl.md) | R4 (G02) | Manifest field reference, open vs closed fields, capabilities/hooks |
| [BFF Layer Architecture](../architecture-bff.md) | R4 (G03) | Mesh composition, demo mode, `query()` URL resolution |
| [API Generator Architecture](../architecture-api-generator.md) | R4 (G04) | OpenAPI → routes/controllers/db, SQLite + MongoDB paths |
| [Getting Started](../getting-started.md) | R8 | Zero-to-running-MFE path + onboarding baseline |

R3 (lifecycle diagram fix) lands in [`runtime-class-hierarchy.md`](../runtime-class-hierarchy.md);
R6 (ADR status reconciliation) lands in the [ADR register erratum](../architecture-decisions/README.md#status-reconciliation-erratum).
The code/CI remediations R2/R5/R7 are tracked as separate issues+PRs ([#229](https://github.com/falese/seans-mfe-tool/issues/229), [#231](https://github.com/falese/seans-mfe-tool/issues/231), [#230](https://github.com/falese/seans-mfe-tool/issues/230)).

## How the pieces fit

```
Phase 1 (foundation) ──> Phase 2 (gaps + IA + contract drift) ──> Phase 3 (roadmap + governance)
   narrative                gap matrix  ─────┐                         roadmap sequences the gaps
   pillar model             IA redesign      ├─> feed ──────────────>  governance keeps them closed
   scorecard                contract pass ───┘                         comms pack tells the story
   status refresh
```

## Reading order

- **Executives / stakeholders:** Executive Narrative → Communication Pack.
- **Architects / reviewers:** Pillar Model → AI-Native Scorecard → Contract Alignment Pass.
- **Maintainers / doc owners:** Gap Matrix → Information Architecture → Execution Roadmap → Governance Rubric.

## Scope & honesty

These documents *summarize and assess*; the canonical sources remain [`PROJECT-STATUS.md`](../PROJECT-STATUS.md), the ADRs in [`docs/architecture-decisions/`](../architecture-decisions/README.md), and the code. Where docs and code disagreed, the [Contract Alignment Pass](./contract-alignment-pass.md) records the code as authoritative and tracks the fix.

## Status

All 16 program issues (10 high-priority + 6 medium-priority) are delivered. The [Enterprise Readiness Review](./enterprise-readiness-review.md) (#227) reviews each against its acceptance criteria and recommends closing epic #211 as delivered, with execution items R1–R8 carried forward on the [roadmap](./execution-roadmap-90-day.md).

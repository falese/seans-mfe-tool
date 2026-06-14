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

### Phase 3 — Execution (how it gets *fixed* and *stays fixed*)

| Doc | Issue | What it gives you |
|---|---|---|
| [90-Day Execution Roadmap](./execution-roadmap-90-day.md) | #223 | 3 phases, milestones, dependencies, owners, effort, success metrics |
| [Communication Pack](./communication-pack.md) | #224 | One-pager, talk track, slides, exec memo, FAQ, objection handling |
| [Governance Checklist & Rubric](./governance-checklist-and-rubric.md) | #225 | Per-PR checklist, scoring rubric, ownership/cadence, documentation KPIs |

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

## Medium-priority follow-ups (not in this set)

Tracked for later phases and referenced throughout: #215 (comms skeleton — folded into #224), #220 (runtime runbook), #221 (MCP + plugin playbooks), #222 (link hygiene), #226 (KPI instrumentation — see the [rubric](./governance-checklist-and-rubric.md#documentation-kpis)), #227 (readiness review).

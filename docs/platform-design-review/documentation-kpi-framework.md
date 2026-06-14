# Documentation KPI Framework & Baseline

**Part of:** [Platform Design Review](./README.md) · DOCS-P3 (#226)
**Depends on:** [Governance Checklist & Rubric](./governance-checklist-and-rubric.md) (#225) — this doc operationalizes the KPIs that the rubric references.

Defines the measurable KPIs for documentation health, how each is baselined, and the reporting cadence. The five KPI families requested by the program are: **findability, correctness, decision traceability, agent parseability, onboarding-time reduction**.

> **Why measure docs.** The [Gap Matrix](./documentation-gap-matrix.md) and [Contract Alignment Pass](./contract-alignment-pass.md) prove that drift and dead links accumulate silently. KPIs convert "docs feel stale" into tracked numbers with targets, so regressions are visible.

---

## 1. KPI definitions

### KPI-1 Findability
*Can a reader reach the right doc quickly, from one entry point?*

| Metric | Definition | Target |
|---|---|---|
| Canonical-TOC coverage | % of active docs reachable from the canonical TOC (#218) | 100% |
| Orphan docs | active docs not linked from any other doc | 0 |
| Click-depth to subsystem doc | max link hops from root README to any subsystem reference | ≤2 |

### KPI-2 Correctness
*Does the doc match reality?*

| Metric | Definition | Target |
|---|---|---|
| Contract drift | documented contracts contradicting code (CA findings open) | 0 |
| Dead internal links | unresolved relative links in active docs | 0 |
| Currency defects | docs with stale/contradictory dates found in the monthly sweep | 0 |
| "Coming Soon" stubs | subsystem docs that are placeholders | 0 |

### KPI-3 Decision traceability
*Can every architectural claim be traced to a decision?*

| Metric | Definition | Target |
|---|---|---|
| ADR/PDR citation rate | % of architectural claims in canonical docs citing an ADR/PDR | ≥90% |
| ADR status currency | % of ADRs with an accurate status field (`Accepted`/`Implemented`/`Deferred`/`Superseded`) | 100% |
| Orphan decisions | ADRs not referenced by any doc/code | trend ↓ |

### KPI-4 Agent parseability
*Can an AI agent consume the platform from docs + output?*

| Metric | Definition | Target |
|---|---|---|
| Envelope conformance | commands emitting exactly one `CommandResult` line under `--json` (CA-2) | 100% |
| Schema currency | `npm run build:schemas` produces no diff (tools match CLI) | clean |
| Agent-doc presence | MCP playbook + agent quick-start published | yes |
| AI-readiness score | overall score from the [Scorecard](./ai-native-readiness-scorecard.md) | ≥90 |

### KPI-5 Onboarding-time reduction
*How fast can a new adopter get productive?*

| Metric | Definition | Target |
|---|---|---|
| Zero-to-running-MFE | documented path exists end-to-end (getting-started → generate → run) | published |
| Time-to-first-MFE | median minutes for a new operator to scaffold+run an example (timed walkthrough) | establish baseline, then ↓ |
| Time-to-doc | median days between a contract change and its doc update | ≤ same PR |

---

## 2. Baseline (Day 0 of epic #211)

Measured/estimated at program start from the Gap Matrix, Contract Alignment Pass, and repo inspection:

| KPI | Metric | Baseline | Source |
|---|---|---|---|
| Findability | Canonical-TOC coverage | none (no canonical TOC) | #218 |
| Findability | Orphan docs | several (archive linked, no index) | G16, G35 |
| Correctness | Contract drift | 7 open (CA-1…CA-7) | [Contract Alignment Pass](./contract-alignment-pass.md) |
| Correctness | Dead internal links | ≥10 found in `architecture-current-state.md` | #222 Tier-1 check |
| Correctness | "Coming Soon" stubs | 4 | G01–G04 |
| Correctness | Currency defects | ≥2 (April-vs-Dec date conflict) | fixed in #216 |
| Decision traceability | ADR status currency | partial (ADR-007 stale) | G14, G26 |
| Agent parseability | AI-readiness score | 81 | [Scorecard](./ai-native-readiness-scorecard.md) |
| Agent parseability | Agent-doc presence | absent | G09, #221 |
| Onboarding | Zero-to-running-MFE | absent | G27, G29 |

Total open documentation gaps at baseline: **35** (G01–G35).

---

## 3. Baseline collection method

| KPI family | How it's collected | Tooling | Frequency |
|---|---|---|---|
| Findability | Reachability graph from root README over relative links | Tier-1 link script + manual TOC review | Weekly |
| Correctness (links) | Path-existence check over Markdown links | [Link-hygiene Tier-1](./cross-reference-standards.md#4-link-hygiene-verification-approach) | Per-PR + monthly |
| Correctness (drift) | Manual contract audit vs. code (`file:line`) | [Contract Alignment Pass](./contract-alignment-pass.md) method | Monthly + on contract change |
| Correctness (currency) | Date/status sweep across dated headers | manual sweep | Monthly |
| Decision traceability | Cross-check claims ↔ ADR/PDR register | manual + register diff | Quarterly |
| Agent parseability | `--json` conformance test + `build:schemas` diff + scorecard | Jest conformance test (target) + scorecard method | Quarterly (score), per-PR (schema) |
| Onboarding | Timed walkthrough using `examples/abc-kids` | manual stopwatch walkthrough | Quarterly |

Measurement principle: **prefer automatable metrics** (links, schema diff, envelope conformance) wired into CI; keep judgment-based metrics (traceability, onboarding) on a human cadence.

---

## 4. Reporting cadence

| Cadence | Report | Owner | Audience |
|---|---|---|---|
| Per-PR | Link + envelope/schema checks pass/fail | PR author | reviewer |
| Weekly | Findability + open-gap delta (from Gap Matrix) | Doc steward | program |
| Monthly | Correctness scorecard (drift, dead links, currency) | Doc steward | eng leadership |
| Quarterly | Full KPI dashboard incl. AI-readiness re-score + onboarding timing | Program lead | stakeholders |

The quarterly dashboard rolls all KPIs into the program success table in the [90-Day Execution Roadmap](./execution-roadmap-90-day.md#success-metrics-program-level) and feeds the readiness review (#227).

---

## 5. Targets summary (Day 90)

| KPI | Baseline | Day-90 target |
|---|---|---|
| Open doc gaps (G01–G35) | 35 | ≤5 |
| Contract drift (CA findings) | 7 | 0 |
| Dead internal links | ≥10 | 0 |
| "Coming Soon" stubs | 4 | 0 |
| Canonical-TOC coverage | none | 100% |
| AI-readiness score | 81 | ≥90 |
| Zero-to-running-MFE path | absent | published |

---

*This document is **Informative**; the binding cadence and per-PR gate live in the [Governance Checklist & Rubric](./governance-checklist-and-rubric.md) (Normative for documentation process).*

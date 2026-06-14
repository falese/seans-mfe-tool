# Documentation Governance Checklist & Review Rubric

**Part of:** [Platform Design Review](./README.md) · DOCS-P3 (#225)
**Purpose:** Keep documentation correct, current, and navigable *after* the 90-day program ends — so the gaps closed in the [roadmap](./execution-roadmap-90-day.md) do not silently reopen.

This is the standing governance instrument: a per-PR checklist, a scoring rubric, an ownership + cadence model, and the documentation KPIs that the program reports against.

---

## 1. Per-PR documentation checklist

Apply to **every** PR that adds or changes docs (and to code PRs that change a documented contract). Lives alongside `CLAUDE.md`'s session-end checklist.

- [ ] **Single source of truth respected.** The fact is stated in its canonical doc (per the [ownership map](./information-architecture.md#4-source-of-truth-ownership-map)); other docs link, not restate.
- [ ] **Currency.** Any dated header / status line updated; no contradictory dates (cf. the April-vs-December issue fixed in #216).
- [ ] **Contract accuracy.** If the PR touches a documented contract (envelope, exit codes, lifecycle states, query resolution), the doc matches code with a `file:line` citation (cf. [Contract Alignment Pass](./contract-alignment-pass.md)).
- [ ] **Decisions cited.** Architectural claims reference an `ADR-NNN`; product claims a `PDR-NNN`. New architecture includes a new ADR (never edit an accepted ADR — `CLAUDE.md`).
- [ ] **Naming + links.** File name and headings follow the [naming standard](./information-architecture.md#5-naming--cross-reference-standards); internal links are **relative**; no links into `docs/archive/`.
- [ ] **Reachable.** New docs are linked from the canonical TOC / docs index.
- [ ] **No dead links.** Link audit passes (`#222`).
- [ ] **Audience clear.** Doc states its audience and "part of" context where applicable.
- [ ] **Honest maturity.** Status language matches `PROJECT-STATUS.md`; nothing in-progress is described as complete.

---

## 2. Scoring rubric

Two complementary rubrics: a **maturity score** (1–5, per the [Pillar Model](./architecture-pillar-model.md)) for "how good is this doc," and a **per-review pass/fail gate** for "can this PR merge."

### 2.1 Doc maturity (1–5)

| Score | Definition |
|---|---|
| 5 | Canonical doc + decisions + examples; matches implementation; no known gaps |
| 4 | Solid doc + decisions; minor gaps or staleness |
| 3 | Partial; decisions exist but no consolidated reference; some drift |
| 2 | Scattered / placeholder ("coming soon"); decisions only |
| 1 | Essentially undocumented outside code |

Review target: **no canonical doc below 3**; pillar docs trend to 4–5.

### 2.2 Per-review gate (each dimension Pass / Fix-required)

| Dimension | Pass criterion |
|---|---|
| Accuracy | No statement contradicts code or a canonical doc |
| Currency | Dates/status current and self-consistent |
| Sourcing | Claims cite ADR/PDR/REQ or `file:line` |
| Navigability | Linked from TOC; relative links resolve |
| Ownership | Doesn't duplicate a fact owned elsewhere |
| Clarity | Audience + purpose stated; scannable structure |

**Merge rule:** any "Fix-required" blocks merge until resolved.

---

## 3. Ownership & cadence model

### 3.1 Ownership

- **Doc steward (rotating):** runs the weekly review, owns the TOC and ownership map, triages the gap matrix.
- **Pillar owners:** accountable for their pillar's canonical docs staying ≥3 (CLI, DSL, Codegen, Framework, Runtime, BFF, MCP — see Pillar Model).
- **ADR/PDR authors:** keep decision status fields current (`Proposed`/`Accepted`/`Implemented`/`Deferred`/`Superseded`).
- **Author of a contract change:** responsible for the matching doc update in the same PR.

### 3.2 Cadence

| Cadence | Activity | Output |
|---|---|---|
| Per-PR | Apply §1 checklist + §2 gate | Merge / fix-required |
| Weekly (≤30 min) | Steward reviews changed docs + open gaps; updates gap matrix statuses | Updated matrix; new doc issues |
| Monthly | Currency sweep: dates, `PROJECT-STATUS.md`, ADR statuses, link audit | Currency report |
| Quarterly | Re-score pillars; re-run AI-readiness scorecard; prune `archive/` | Scorecard + pillar scores |

---

## 4. Documentation KPIs

<a id="documentation-kpis"></a>

The metrics the program (and ongoing governance) reports against. Baselines are Day-0 of epic #211; targets align with the [roadmap](./execution-roadmap-90-day.md). Full KPI definitions, baseline-collection method, and reporting cadence are in the dedicated [Documentation KPI Framework](./documentation-kpi-framework.md) (#226).

| KPI | Definition | Baseline | Target | Cadence |
|---|---|---|---|---|
| **Open doc gaps** | Count of unresolved Gap-Matrix items (G01–G35) | 35 | ≤5 | Weekly |
| **S1 gaps** | Critical/misleading gaps open | 6 | 0 | Weekly |
| **Contract drift** | Documented contracts contradicting code (CA findings) | 7 | 0 | Monthly |
| **"Coming Soon" docs** | Subsystem docs that are stubs | 4 | 0 | Monthly |
| **Dead internal links** | Broken relative links in active docs | TBD (audit) | 0 | Monthly |
| **Canonical coverage** | Topics with a single owning doc (per ownership map) | partial | 100% | Quarterly |
| **Doc maturity floor** | Lowest canonical-doc maturity score | 2 | ≥3 | Quarterly |
| **AI-readiness score** | Overall score from the scorecard | 81 | ≥90 | Quarterly |
| **Currency defects** | Docs with stale/contradictory dates found in sweep | ≥2 | 0 | Monthly |
| **Time-to-doc** | Median days between a contract change and its doc update | TBD | ≤ same PR | Per-PR |

### Instrumentation notes

- **Gaps / S1 / drift / Coming-Soon** are counted directly from the [Gap Matrix](./documentation-gap-matrix.md) and [Contract Alignment Pass](./contract-alignment-pass.md) (both are living documents — update statuses as items close).
- **Dead links** come from the link audit (#222); wire it into CI as a non-blocking report first, then a gate.
- **AI-readiness** is re-scored using the [scorecard](./ai-native-readiness-scorecard.md) methodology, quarterly.
- **Time-to-doc** is satisfied structurally by the per-PR checklist rule "contract change updates its doc in the same PR."

---

## 5. Relationship to existing process

This rubric **extends** `CLAUDE.md`'s verification gates and session-end checklist; it does not replace them. The code gates (lint/typecheck/test/build/schema-drift) remain authoritative for code; this instrument adds the documentation gate. Together they close the loop the [Documentation Gap Matrix](./documentation-gap-matrix.md) identified as G26 (ADR status drift) and G32 (recurring currency drift).

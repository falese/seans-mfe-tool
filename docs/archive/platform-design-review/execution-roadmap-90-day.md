# 90-Day Documentation Execution Roadmap

**Part of:** [Platform Design Review](./README.md) · DOCS-P3 (#223)
**Inputs:** [Documentation Gap Matrix](./documentation-gap-matrix.md) (G01–G35), [Contract Alignment Pass](./contract-alignment-pass.md) (CA-1…CA-7), [Information Architecture](./information-architecture.md)
**Window:** 90 days from program start (epic #211)

This roadmap sequences the closure of every documented gap into three 30-day phases, with milestones, dependency ordering, suggested owners, effort, and success metrics. Owners are **roles**, not individuals.

## Operating model

- **Cadence:** weekly doc review (≤30 min) using the [Governance Rubric](./governance-checklist-and-rubric.md); phase demo every 30 days.
- **Definition of done per item:** the gap's *acceptance criteria* (Gap Matrix) is met, the doc is linked from the canonical TOC (#218), and links pass the audit (#222).
- **Capacity assumption:** ~1 FTE-equivalent of documentation effort across the window (sizing in effort columns; XS<½d, S≈1d, M≈2–4d, L≈1–2w).

---

## Phase 1 — Days 0–30: "Stop the bleeding" (correctness & entry points)

**Theme:** Fix what actively misleads adopters and agents, and make docs navigable. Prioritizes all **S1** gaps and the contract S1 findings.

| Item | Source | Owner | Effort | Depends on |
|---|---|---|---|---|
| Canonical docs TOC + repurpose `docs/README.md` | G16, G17, #218 | Docs owner | S | #218 (done) |
| Source-of-truth ownership map adopted | G18, #218 | Docs owner | S | #218 (done) |
| `cli-contract.md` — envelope (CA-1), `--json` behavior (CA-2), exit codes (CA-3, CA-33) | G05, G06, G33 | CLI owner | M | CA findings (done) |
| Fix `query()` URL summary comment + document order | CA-4, G07 | Runtime owner | S | CA-4 (done) |
| Per-capability state table in `PLATFORM-CONTRACT.md` | CA-5, G08, G11 | Runtime owner | S | CA-5 (done) |
| Update lifecycle diagram (`ready→loading`, `error→loading`) | CA-6 | Runtime owner | XS | CA-6 (done) |
| Runtime per-capability status matrix (shipped/in-progress/planned) | G11 | Runtime owner | S | issues #47–59 |
| Link audit pass #1 (fix dead internal links) | G15, #222 | Docs owner | S | #218 TOC |

**Milestone M1 (Day 30):** No documented integration contract contradicts the code; every doc reachable from one TOC; all S1 gaps closed.

**Exit metrics:**
- S1 open gaps: **6 → 0**.
- Dead internal links: **0** (link audit green).
- Contract drift findings CA-1/CA-2/CA-4 reflected in published docs: **3/3**.

---

## Phase 2 — Days 31–60: "Fill the holes" (subsystem references & playbooks)

**Theme:** Replace every "Coming Soon" stub and ship the operational playbooks. Prioritizes **S2** gaps and the medium-priority program issues (#220, #221, #222).

| Item | Source | Owner | Effort | Depends on |
|---|---|---|---|---|
| `architecture-codegen.md` (UnifiedGenerator, templates, ownership markers) | G01, G21 | Codegen owner | M | TOC, ownership map |
| `architecture-dsl.md` + schema-generated field reference | G02, G13 | DSL owner | M | `src/dsl/schema.ts` |
| `architecture-bff.md` (composition, demo-mode, pinning) | G03 | BFF owner | M | CA-4 |
| Runtime operational runbook | #220 | Runtime owner | M | Phase 1 runtime docs |
| MCP integration playbook (`mcp.json`, federation, collisions, perf) | G09, #221 | MCP owner | M | `cli-contract.md` |
| Framework-plugin worked example (3rd framework) | G10, #221 | Framework owner | M | authoring guide |
| Link hygiene + relative-link standard enforced | G15, #222 | Docs owner | S | Phase 1 audit |
| ADR-007 deferred callout; ADR status dashboard | G14, G26 | Docs owner | S | — |
| `architecture-api-generator.md` | G04 | Codegen owner | M | codegen doc |

**Milestone M2 (Day 60):** Zero "Coming Soon" subsystem docs; agent + operator playbooks published; ADR statuses visible at a glance.

**Exit metrics:**
- "Coming Soon" subsystem docs: **4 → 0**.
- S2 open gaps: **13 → ≤3**.
- Playbooks published (MCP, runtime runbook): **2/2**.
- AI-readiness D8 (agent docs) score: **2 → 4** (see [Scorecard](./ai-native-readiness-scorecard.md)).

---

## Phase 3 — Days 61–90: "Make it durable" (adoption, governance, currency)

**Theme:** Onboarding surface for new adopters, and the governance machinery that prevents regression. Prioritizes **S3/S4** gaps and the governance/KPI issues (#225, #226, #227).

| Item | Source | Owner | Effort | Depends on |
|---|---|---|---|---|
| Shell-operator getting-started guide | G27 | Docs owner | M | subsystem docs |
| End-to-end "generate an MFE" tutorial (uses `examples/abc-kids`) | G29 | Docs owner | M | codegen/DSL docs |
| Security / threat-model overview (ADR-044/046, auth, JWT) | G25 | Security owner | M | BFF doc |
| Testing-strategy doc (Jest + Playwright + coverage gates) | G30 | QA owner | S | — |
| Glossary | G31 | Docs owner | XS | TOC |
| Versioning/upgrade guide for `@seans-mfe/contracts` | G28 | Packages owner | S | MERGE-PLAN |
| Governance checklist + review rubric operationalized | #225, G32 | Docs owner | S | #225 (done) |
| Documentation KPI framework instrumented | #226 | Docs owner | S | gap matrix |
| Reconcile MERGE-PLAN + lifecycle-issue status; known-issues page (#199, #208, #209) | G20, G22, G23, G24, G34 | Docs owner | S | — |
| Readiness review + sign-off | #227 | Program lead | S | all above |

**Milestone M3 (Day 90):** New adopters can self-serve from zero to a running MFE; governance cadence is live; the program's own KPIs are tracked.

**Exit metrics:**
- Total open doc gaps (G01–G35): **35 → ≤5** (remaining are L-effort or externally blocked).
- Adopter onboarding path exists end-to-end: **yes/no → yes**.
- Governance cadence runs weekly with the rubric: **established**.
- Documentation KPI dashboard live (see #226 metrics below).

---

## Dependency map (critical path)

```
P1 ownership map + TOC ─┬─> P2 subsystem docs ──┬─> P3 getting-started + tutorial
                        │                       │
cli-contract (CA-1/2/3)─┘                       └─> P3 security/testing/versioning
                                                │
runtime state/diagram (CA-5/6) ─> runtime runbook (#220) ─> P3 readiness review (#227)
                                                │
P2 link standard (#222) ─────────────────────────> P3 governance cadence (#225/#226)
```

The single most-depended-on Phase-1 output is the **ownership map + TOC** (everything links through it) and the **`cli-contract.md`** (every agent/operator doc references it).

---

## Success metrics (program-level)

| Metric | Baseline (Day 0) | Target (Day 90) |
|---|---|---|
| Open documentation gaps (G01–G35) | 35 | ≤5 |
| S1 gaps | 6 | 0 |
| "Coming Soon" subsystem docs | 4 | 0 |
| Contract drift findings unreflected in docs | 7 | 0 |
| Dead internal links | unknown (audit pending) | 0 |
| Docs reachable from a single canonical TOC | no | yes |
| AI-readiness score (overall) | 81 | ≥90 |
| Adopter zero-to-running-MFE path | absent | published |
| Governance review cadence | none | weekly |

These roll up into the [Documentation KPI framework (#226)](./governance-checklist-and-rubric.md#documentation-kpis) and are the basis for the Day-90 readiness review (#227).

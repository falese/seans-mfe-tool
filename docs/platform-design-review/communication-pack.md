# Enterprise Communication Pack

**Part of:** [Platform Design Review](./README.md) · DOCS-P3 (#224, incorporating the #215 skeleton)
**Audience:** Executives, prospective adopting teams, partner/stakeholder reviewers
**Source of truth:** This pack *summarizes* — it never overrides [`PROJECT-STATUS.md`](../PROJECT-STATUS.md), the [Executive Narrative](./executive-architecture-narrative.md), or the [AI-Native Scorecard](./ai-native-readiness-scorecard.md).

Contents:
1. One-pager (stakeholder leave-behind)
2. Talk track (5–7 minute briefing)
3. Slide outline (10 slides)
4. Executive memo
5. FAQ
6. Objection handling
7. Messaging do's and don'ts
8. What this proves / what remains to prove

---

## 1. One-pager

> **seans-mfe-tool (SMT) — deliver domain features as independently deployable units, in any framework, composed through one contract.**

**The problem.** Multi-team frontends fragment: teams pick different frameworks, pipelines drift, and "micro-frontend" efforts collapse into bespoke integration glue.

**The approach.** Teams declare *capabilities* in a manifest. The CLI generates a complete, framework-specific project. Every unit conforms to one runtime lifecycle contract, so a shell composes it regardless of how it was built. **The contract is constant; the implementation is swappable.**

**Why it's different.**
- **AI-native by construction** — one CLI serves both an AI agent and a human; structured output and typed errors make the platform safe to automate (81/100 AI-readiness today).
- **Generation over glue** — integration correctness lives in one tested pipeline, not in every team.
- **Auditable decisions** — every architectural choice is an ADR (58+); every product choice a PDR.

**Maturity (honest).** Foundations shipped (CLI, codegen/DSL, BFF, framework plugins). Runtime platform is actively maturing. Adopt the contract now; track the specific runtime capabilities you depend on.

**Ask / next step.** Identify one domain team for a pilot capability; integrate against the platform contract; report back at the 90-day mark.

---

## 2. Talk track (5–7 minutes)

1. **Hook (30s).** "Every large org ends up with five frontend frameworks and zero ways to compose them. SMT makes the *composition contract* the constant and lets the framework be a detail."
2. **The core idea (1m).** Capabilities declared in a manifest → CLI generates the project → every unit speaks the same 10-capability lifecycle. Federation is just a delivery mechanism.
3. **Why it matters (1m).** One integration surface, many teams shipping independently; framework freedom without contract drift.
4. **The differentiator (1.5m).** AI-native: the same CLI an engineer uses is the interface an AI agent drives — structured JSON output, typed errors, an MCP server. This is the organizing principle, not a feature.
5. **Proof (1m).** 58+ ADRs; shipped CLI/codegen/BFF/framework-plugins; an AI-readiness scorecard at 81/100 with a concrete path to 90+.
6. **Honesty (1m).** Runtime platform is in progress; we publish a dated `PROJECT-STATUS.md` and a contract-alignment audit so adopters know exactly what's real.
7. **Close (30s).** "Pilot one capability against the contract. The contract is stable today."

---

## 3. Slide outline (10 slides)

1. **Title** — SMT: one contract, any framework.
2. **The fragmentation problem** — five frameworks, zero composition.
3. **The big idea** — manifest → generate → one lifecycle contract.
4. **Constant vs. swappable** — the immutable contract table vs. replaceable choices.
5. **The 7 pillars** — one-line each (from the [Pillar Model](./architecture-pillar-model.md)).
6. **AI-native** — two-headed giant; envelope + typed errors + MCP.
7. **AI-readiness scorecard** — 81/100, weighted dimensions, path to 90+.
8. **Maturity & risk** — shipped vs. in-progress; link to `PROJECT-STATUS.md`.
9. **Governance** — ADRs/PDRs; the 90-day documentation program.
10. **Call to action** — pilot one capability; 90-day checkpoint.

---

## 4. Executive memo

**To:** Engineering leadership
**Re:** SMT platform — what it is, why it matters, what we're asking

SMT is our approach to letting many teams ship frontend features independently while the platform team owns exactly one integration contract. Teams declare capabilities in a manifest; the CLI generates a complete, framework-specific project; every generated unit conforms to a single runtime lifecycle so a shell can compose it without caring how it was built. Framework, bundler, and delivery mechanism are deliberately *replaceable*; the platform contract is deliberately *constant* and enforced by code and ADRs.

The strategic differentiator is that SMT is **AI-native by construction**: the CLI is a first-class interface for both engineers and AI agents, with machine-readable output, typed errors, and an MCP server. Our internal scorecard puts AI-readiness at 81/100 today, with a defined path to 90+.

We are deliberately honest about maturity. The CLI, code generation, DSL, BFF, and framework-plugin systems are shipped; the runtime platform is actively maturing. We maintain a dated `PROJECT-STATUS.md` and a contract-alignment audit so adopters can see exactly which capabilities are production-ready.

**Ask:** sponsor a pilot — one domain team builds one capability against the platform contract over the next quarter, with a 90-day checkpoint against the program metrics.

---

## 5. FAQ

**Q: Is this "just micro-frontends"?**
No. Federation is one delivery mechanism. The product is the *capability contract* that makes units composable regardless of delivery mechanism.

**Q: Does every team have to use React (or Angular)?**
No. Framework and bundler are manifest fields resolved by a plugin (ADR-036). React and Angular ship today; a new framework is a new plugin, not a contract change.

**Q: What does "AI-native" actually mean here?**
The CLI is designed so an autonomous agent can operate it as a first-class user: one JSON envelope per command, typed errors mapped to exit codes, non-interactive mode, and an MCP server. See the [Scorecard](./ai-native-readiness-scorecard.md).

**Q: Is it production-ready?**
The foundations are; the runtime platform is maturing. Adopt the contract now and check the specific runtime capabilities you depend on in [`PROJECT-STATUS.md`](../PROJECT-STATUS.md). We do not overstate readiness.

**Q: How do we trust the architecture?**
Every architectural decision is an ADR and every product decision a PDR — the "why" is auditable, not tribal.

**Q: What's the adoption cost?**
A team integrates once against the platform contract. Scaffolding, lifecycle wiring, and the BFF layer are generated, so the integration-correctness burden is on one tested pipeline, not each team.

**Q: What if we pick a framework you don't support?**
Author a framework plugin (`@seans-mfe/framework-<name>`) extending `BaseFrameworkPlugin`. The path is designed and proven for React and Angular; a worked third-framework example is on the 90-day roadmap.

---

## 6. Objection handling

| Objection | Response |
|---|---|
| "Docs are inconsistent / stale." | Acknowledged — that's exactly what this design-review program fixes. We publish a dated status, a 35-item gap matrix, and a contract-alignment audit. |
| "Runtime isn't finished." | Correct, and we say so. The *contract* is stable; specific capabilities are tracked openly in `PROJECT-STATUS.md`. Adopt the contract; track your dependencies. |
| "Only two frameworks." | The extension mechanism is shipped (ADR-036); adding a framework is a plugin, not a fork. |
| "AI-native sounds like hype." | It's a measurable contract: single-line JSON envelope, typed exit codes, MCP isolation — all in code today (see Contract Alignment Pass). |
| "Yet another platform to learn." | One contract to integrate against; generation does the rest. The learning curve is the manifest + lifecycle, both documented. |

---

## 7. Messaging do's and don'ts

**Do:**
- Lead with "one contract, any framework."
- Pair every claim with the source (`PROJECT-STATUS.md`, an ADR, the scorecard).
- State maturity honestly — it builds more trust than overclaiming.

**Don't:**
- Call the runtime platform "complete."
- Describe SMT primarily as a "micro-frontend / Module Federation tool."
- Quote an AI-readiness number without linking the scorecard and its date.
- Reference internal issue numbers in external-facing material without context.

---

## 8. What this proves / what remains to prove

The honest evidence ledger behind the messaging. "Proves" = shipped and demonstrable today; "Remains to prove" = designed/in-progress with a tracked path. Pair any external claim with the matching row.

### Proves (shipped, demonstrable)

| Claim | Evidence |
|---|---|
| One contract, any framework | `BaseFrameworkPlugin` (`packages/contracts/src/framework-plugin.ts`); React + Angular plugins shipped (ADR-036, PRs #187–188) |
| Generation over glue | UnifiedGenerator + DSL pipeline; `seans-mfe-tool remote:generate` produces complete projects |
| AI-native CLI | One-line JSON envelope + typed exit codes (`packages/contracts/src/envelope.ts:158–190`); `--json` behavior (`BaseCommand.ts:43–73`) |
| MCP federation | 3-source registry with collision-fails-loud (`src/mcp/tool-registry.ts:32–61`) |
| Auditable decisions | 58+ ADRs + PDRs in `docs/architecture-decisions/` and `docs/product-decisions/` |
| GraphQL BFF | BFF layer shipped (✅ in `PROJECT-STATUS.md`) |

### Remains to prove (in-progress / designed)

| Claim | Status & tracking |
|---|---|
| Runtime platform production-hardening | 🟡 In progress, issues #47–59 (`PROJECT-STATUS.md`) |
| Third-framework plugin (beyond React/Angular) | Path designed; worked example on the [roadmap](./execution-roadmap-90-day.md) (G10) |
| BaseMFE boilerplate codegen from DSL | 🟡 REQ-057 (#39) |
| Agent operability at the high end (audit log, `explain`, `system:map`) | Open #145–147 (Scorecard D6) |
| Subsystem reference docs (codegen/DSL/BFF) | "Coming Soon" → authored in [roadmap](./execution-roadmap-90-day.md) Phase 2 (G01–G04) |
| Marketplace of domain-capability packages | North-star, not yet built (CLAUDE.md) |

**Rule of thumb for spokespeople:** if a capability is in the right-hand table, say "designed / in progress" — never "done." The [`PROJECT-STATUS.md`](../PROJECT-STATUS.md) date is the arbiter.

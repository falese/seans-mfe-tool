# Executive Architecture Narrative

**Audience:** Enterprise stakeholders (engineering leadership, platform architects, technical decision-makers)
**Length:** ~2 pages
**Part of:** [Platform Design Review](./README.md) · DOCS-P1 (#212)
**Grounded in:** ADR-033, ADR-041, ADR-043 · [`README.md`](../../README.md) · [`docs/spec.md`](../spec.md)

---

## In one sentence

**seans-mfe-tool (SMT) delivers domain features as independently deployable units — in any framework, language, or federation pattern — by separating an immutable platform contract from replaceable implementation choices.**

A domain team declares *capabilities* (e.g. `PlayGame`, `ShowCover`) in a YAML manifest. The CLI generates a complete, framework-specific project — bundler config, runtime lifecycle wiring, BFF layer, Docker setup. Every generated unit conforms to one lifecycle contract, so a shell can compose it regardless of how it was built. Federation (Module Federation, ESM, iframe, web components) is a *delivery mechanism*, not the point.

---

## Why this matters to the enterprise

Large organizations accumulate frontend fragmentation: teams pick different frameworks, build pipelines drift, and "micro-frontend" efforts collapse into bespoke integration glue that only their authors understand. SMT addresses this with a deliberate architectural stance:

- **The contract is constant; the implementation is swappable.** A shell operator integrates against ten platform capabilities and a lifecycle state machine — never against React, Angular, rspack, or webpack directly. Teams can adopt new frameworks without renegotiating the integration surface.
- **Generation, not hand-rolling.** The manifest is the single source of truth (ADR-043). Project scaffolding, lifecycle wiring, and BFF layers are generated, so the integration-correctness burden moves from every team to one tested pipeline.
- **Built for an AI-assisted workflow.** The CLI is the universal interface for both an AI agent and a human (ADR-033). This is not a bolt-on; it is the organizing principle of the developer experience (see the [AI-Native Readiness Scorecard](./ai-native-readiness-scorecard.md)).

The result is an enterprise *reference model*: a way to let many teams ship independently while a platform team owns exactly one contract.

---

## Immutable platform contracts (what does **not** change)

These are the load-bearing guarantees. They are enforced in code and governed by ADRs; changing them is an explicit, reviewed architectural event — never an implementation detail.

| Contract | What it guarantees | Enforced by |
|---|---|---|
| **10-capability platform contract** | Every MFE exposes exactly the same ten capabilities (`load`, `render`, `refresh`, `authorizeAccess`, `health`, `describe`, `schema`, `query`, `emit`, `updateControlPlaneState`). | `BaseMFE` abstract base — ADR-041 |
| **Lifecycle state machine** | Capabilities are valid only in the correct order; illegal transitions throw at the boundary. | ADR-042 |
| **Lifecycle hook model** | `before → main → after → error` runs around every capability body; no custom phases. | ADR-002, ADR-003 |
| **`CommandResult<T>` JSON envelope** | Under `--json`, every command emits exactly one machine-parseable line on stdout; everything else goes to stderr. | `BaseCommand` — ADR-016, ADR-018 |
| **Typed error taxonomy + exit codes** | Failures are structured (`ValidationError`, `BusinessError`, …) with sysexits-style exit codes an agent can branch on. | ADR-017, ADR-033 |
| **Manifest as source of truth** | The DSL manifest declares intent; generated code is reproducible from it. | ADR-043, ADR-011 |

A consumer who depends only on these will not be broken by a framework upgrade, a bundler swap, or a new delivery mechanism.

---

## Replaceable implementation choices (what **can** change)

These are deliberate variation points. Changing one is a template-variant or plugin change — not a contract change.

| Choice | Current implementation | How it varies |
|---|---|---|
| **UI framework** | React, Angular | New framework = publish `@seans-mfe/framework-<name>` extending `BaseFrameworkPlugin` (ADR-036) |
| **Bundler** | rspack (React), webpack/`@angular-builders` (Angular) | `bundler` is an open manifest field, resolved by the framework plugin |
| **Delivery mechanism** | Module Federation | ESM / iframe / web components are template variants, not new capabilities |
| **BFF data sources** | GraphQL Mesh over OpenAPI/REST | Per-MFE; demo-mode mock switch (ADR-052) |
| **Persistence (generated APIs)** | SQLite / MongoDB | OpenAPI-driven generator choice |
| **Runtime entry** | Bun (dev, no transpile) / Node (publish) | ADR-020 — both supported, contract identical |

The discipline that keeps these replaceable is the same abstract-base → concrete-implementation pattern used in both the runtime (`BaseMFE` → `RemoteMFE` / `AngularRemoteMFE`) and the build system (`BaseFrameworkPlugin` → `ReactRspackPlugin` / `AngularWebpackPlugin`). Adding capability never means changing the dispatcher; it means adding an implementation behind a fixed shape (ADR-036, ADR-041).

---

## Why SMT is an enterprise reference model

1. **Single integration surface, many teams.** The shell integrates once against the platform contract; N domain teams ship against it independently.
2. **Framework freedom without contract drift.** Teams choose their stack; the platform team owns one contract and one generation pipeline.
3. **Machine-operable by construction.** Structured output, typed errors, and an MCP server (ADR-019) make the platform safe to drive from automation and AI agents — increasingly a procurement requirement, not a nice-to-have.
4. **Decisions are traceable.** Every architectural choice is an ADR; product rationale is a PDR. The "why" is auditable, which is what enterprise governance actually asks for.

---

## Risk and maturity statement (grounded in project status)

SMT is **production-shaped in its foundations and actively maturing in its runtime**. This narrative does not overstate readiness; see [`docs/PROJECT-STATUS.md`](../PROJECT-STATUS.md) for the authoritative status.

**Mature / shipped:**
- CLI platform (oclif migration, JSON envelope, typed errors, MCP server) — shipped.
- Codegen + DSL pipeline, GraphQL BFF layer — shipped.
- Framework plugin system (ADR-036) — shipped.

**Actively maturing (do not assume complete):**
- **Runtime platform** (`BaseMFE` capabilities, platform handlers, atomic load) — in progress (REQ-RUNTIME-001–012, issues #47–59). The *contract* is fixed; several handler implementations are still landing.
- **BaseMFE boilerplate codegen from DSL** (REQ-057) — in progress, gated on runtime context.

**Planned / not yet started:**
- Lifecycle-engine enhancements (parallel execution, timeout protection, error classification, conditional execution, inter-hook communication — ADR-028–032) — ADRs written, issues not yet created.
- npm publication of `@seans-mfe/contracts` and `@seans-mfe/oclif-base`; monorepo consolidation (MERGE-PLAN.md).

**Key risks for an adopter to weigh:**
- *Runtime handler coverage* is incomplete — validate the specific capabilities your shell relies on against current status before committing.
- *Two shipped frameworks* (React, Angular) — additional frameworks require authoring a plugin, which is supported but not yet demonstrated for Vue/Svelte/etc.
- *Documentation currency* — addressed by this very program; treat `PROJECT-STATUS.md` and `architecture-current-state.md` as the dated sources of truth.

**Bottom line:** the contract is stable enough to integrate against today; the implementation behind some runtime capabilities is still being completed. Adopt the contract now; track the runtime issues for the capabilities you depend on.

---

## Where to go next

- The seven architecture pillars, scored: [Architecture Pillar Model](./architecture-pillar-model.md)
- AI-native design analysis: [AI-Native Readiness Scorecard](./ai-native-readiness-scorecard.md)
- Authoritative status: [`docs/PROJECT-STATUS.md`](../PROJECT-STATUS.md)
- Stakeholder talk track, memo, and FAQ: [Communication Pack](./communication-pack.md)

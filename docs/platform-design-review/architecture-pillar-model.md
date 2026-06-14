# Architecture Pillar Model — 7 Pillars

**Part of:** [Platform Design Review](./README.md) · DOCS-P1 (#213)
**Grounded in:** ADR-018, ADR-019, ADR-036, ADR-041, ADR-042, ADR-043 (and the ADR register in [`docs/architecture-decisions/README.md`](../architecture-decisions/README.md))

This model decomposes SMT into **seven architecture pillars**. Each pillar is documented with a fixed set of fields so it can be reviewed, scored, and upgraded independently:

- **Purpose** — what the pillar is for
- **Boundary** — what it owns and what it explicitly does not
- **Key decisions** — the governing ADRs
- **Operational value** — why it matters in production / adoption
- **Risks & failure modes** — how it breaks and what that costs
- **Documentation score** — 1–5 maturity of *the docs for this pillar* (see rubric below)
- **Recommended upgrades** — concrete next steps

### Documentation score rubric (1–5)

| Score | Meaning |
|---|---|
| 5 | Canonical doc + ADRs + examples; matches implementation; no known gaps |
| 4 | Solid doc + ADRs; minor gaps or staleness |
| 3 | Partial doc; ADRs exist but no consolidated reference; some drift |
| 2 | Scattered / placeholder docs ("coming soon"); ADRs only |
| 1 | Essentially undocumented outside code |

### Pillar map

| # | Pillar | Doc score | Primary ADRs |
|---|---|:--:|---|
| 1 | CLI & Agent Interface | 4 | ADR-015, 016, 017, 018, 033, 039 |
| 2 | DSL Manifest & Type System | 3 | ADR-006, 008, 010, 011, 040, 043 |
| 3 | Code Generation Engine | 2 | ADR-009, 013, 034, 043 |
| 4 | Framework Plugin System | 4 | ADR-022, 034, 036 |
| 5 | Runtime Platform & Lifecycle Contract | 3 | ADR-001–005, 026, 041, 042, 053 |
| 6 | BFF / GraphQL Mesh Layer | 3 | ADR-012, 027, 050, 052 |
| 7 | MCP & AI-Native Tooling | 3 | ADR-018, 019, 033 |

> Control-plane / daemon orchestration (ADR-054–058) is currently treated as an emerging concern *within* Pillar 5 (Runtime Platform). It is called out as a recommended split candidate in [Information Architecture](./information-architecture.md).

---

## Pillar 1 — CLI & Agent Interface

**Purpose.** Provide the single universal interface for every platform operation — scaffolding, generation, building, BFF management, deployment — usable identically by a human (colored prompts) and an AI agent (`--json --no-interactive`).

**Boundary.**
- *Owns:* oclif command dispatch, the `BaseCommand` pattern, the `CommandResult<T>` envelope, typed-error → exit-code mapping, hooks (init/prerun/postrun/command-not-found), structured logging.
- *Does not own:* the *logic* of codegen, runtime, or BFF (those are separate pillars it invokes); framework-specific build behavior (Pillar 4).

**Key decisions.** ADR-015 (oclif replaces Commander), ADR-016 (BaseCommand pattern — implement `runCommand()`), ADR-017 (typed error hierarchy), ADR-018 (`CommandResult<T>` single-line stdout envelope), ADR-033 (two-headed-giant model), ADR-039 (structured logger, no `console.log`).

**Operational value.** One tool surface for humans and automation; machine-parseable output makes the platform scriptable and CI-friendly; typed exit codes let callers branch on failure class without scraping text.

**Risks & failure modes.**
- A command that writes non-envelope output to stdout under `--json` breaks every machine consumer (and the MCP layer). Mitigated by `BaseCommand`, but new commands must comply.
- `process.exit` inside command logic (rather than via `BaseCommand`) can bypass envelope emission.
- Exit-code taxonomy drift between docs and `BaseCommand` would mislead callers — see [Contract Alignment Pass](./contract-alignment-pass.md).

**Documentation score: 4.** README + spec + ADR-018/033 are strong and current; the precise JSON-mode side-effect rules and full exit-code table are not consolidated in one consumer-facing reference (closed by #219).

**Recommended upgrades.**
- Publish a single "CLI contract" reference: envelope shape, stdout/stderr rules, complete exit-code table, `--json`/`--dry-run`/`--no-interactive` semantics.
- Add a conformance test fixture asserting "exactly one JSON line on stdout" per command.

---

## Pillar 2 — DSL Manifest & Type System

**Purpose.** Define the single source of truth for an MFE: `mfe-manifest.yaml` declaring identity, capabilities, lifecycle hooks, and data sources, plus the unified type system that validates and normalizes it.

**Boundary.**
- *Owns:* manifest schema (Zod), capability/lifecycle/data grammar, type normalization, `framework`/`bundler`/`language` as open fields, handler-source declarations (ADR-040), generated-from traceability (ADR-011).
- *Does not own:* how the manifest is turned into files (Pillar 3); framework build behavior (Pillar 4).

**Key decisions.** ADR-006 (unified type system), ADR-008 (data type metadata), ADR-010 (data lifecycle alignment), ADR-011 (GeneratedFrom traceability), ADR-040 (manifest-declared handler sources), ADR-043 (manifest as codegen source of truth).

**Operational value.** Intent is declarative and reproducible; validation catches errors before generation; open `framework`/`bundler` fields mean new stacks don't require schema changes (unknown values warn, not fail — ADR-036).

**Risks & failure modes.**
- Schema/grammar drift vs. the codegen consumer can yield manifests that validate but generate incorrectly.
- "Open string" fields trade strictness for extensibility — a typo'd `framework` passes validation and only fails at `loadFrameworkPlugin()`.
- Authorization expression grammar (ADR-007) is deferred; security-sensitive manifests may imply capability that isn't enforced.

**Documentation score: 3.** `docs/DSL/dsl-schema-reference.md` and template exist; ADRs are thorough. There is no single canonical "manifest reference" that enumerates every field with validation rules and examples, and the deferred ADR-007 isn't clearly flagged in the schema docs.

**Recommended upgrades.**
- Generate a manifest field reference from the Zod schema (single source, no drift).
- Add an explicit "deferred / not enforced" callout for ADR-007 in the schema reference.

---

## Pillar 3 — Code Generation Engine

**Purpose.** Turn a validated manifest into a complete, framework-specific project: bundler config, runtime lifecycle wiring, capability stubs, BFF layer, Docker setup.

**Boundary.**
- *Owns:* `UnifiedGenerator` orchestration, EJS template processing, file emission, per-capability generation, generated/developer-owned ownership markers.
- *Does not own:* manifest validation (Pillar 2); framework-specific build/dev/Docker logic, which it delegates to the resolved framework plugin (Pillar 4).

**Key decisions.** ADR-043 (manifest-driven pipeline: parse/validate → resolve variant → render → write), ADR-009 (language field → template selection), ADR-013 (generated MFE test templates), ADR-034 (pluggable bundler/framework via codegen variants — superseded in practice by ADR-036 for build logic).

**Operational value.** Moves integration-correctness from every team to one tested pipeline; generated tests raise the floor on quality; ownership markers tell humans/agents what is safe to edit.

**Risks & failure modes.**
- Templates are the highest-leverage failure point: a bug regenerates across every MFE.
- The branch-per-framework history (ADR-034) caused 15+ fix commits; logic that still lives in the generator instead of plugins re-introduces that fragility.
- Generated `.tsx` import-extension issues (see open issue #209) show template/TS-config coupling that can break `tsc` on generated output.

**Documentation score: 2.** This is the weakest pillar for docs: `architecture-codegen.md` is marked "Coming Soon", there is no consolidated description of the UnifiedGenerator flow, template catalog, or ownership-marker contract. ADRs exist but no reference doc.

**Recommended upgrades.** (highest-priority doc investment)
- Author `architecture-codegen.md`: pipeline diagram, template catalog, variant resolution, ownership markers, regeneration safety rules.
- Document the generated-project layout and which files are GENERATED vs DEVELOPER-OWNED.

---

## Pillar 4 — Framework Plugin System

**Purpose.** Make UI framework + bundler a *plugin* concern, not a fork in the generator. The core owns the *shape* of build/scaffold/Docker operations; each framework implements the *how*.

**Boundary.**
- *Owns:* `BaseFrameworkPlugin` abstract contract, `loadFrameworkPlugin()` resolution, env checks, shared-dependency declarations, `build:dev/prod/docker/check` and `remote:init`/`deploy` delegation.
- *Does not own:* lifecycle semantics (Pillar 5); manifest schema (Pillar 2).

**Key decisions.** ADR-036 (abstract `BaseFrameworkPlugin` + concrete `ReactRspackPlugin` / `AngularWebpackPlugin`), ADR-034 (predecessor; codegen variants), ADR-022 (plugin-first architecture).

**Operational value.** Adding a framework = publish `@seans-mfe/framework-<name>` + a template variant — no change to dispatch logic; open `framework`/`bundler` fields keep the manifest stable; mirrors the proven `BaseMFE` pattern.

**Risks & failure modes.**
- Only React and Angular plugins exist; the extension path is designed but not yet proven for a third framework.
- A plugin that misreports env checks or shared deps can produce a project that builds locally but fails in CI/Docker.
- Resolution failure (`loadFrameworkPlugin()`) is the single catch-point for typo'd open fields — its error UX matters.

**Documentation score: 4.** `docs/framework-plugin-authoring.md` + ADR-036 are strong and current, with concrete reference plugins. Minor gap: an end-to-end "author a new framework plugin" walkthrough validated against a non-shipped framework.

**Recommended upgrades.**
- Add a worked example authoring a minimal third-framework plugin (even a stub) to prove the path.
- Document the `loadFrameworkPlugin()` failure modes and recommended error messaging.

---

## Pillar 5 — Runtime Platform & Lifecycle Contract

**Purpose.** Provide the execution contract every MFE conforms to: `BaseMFE` abstract base, the ten platform capabilities, the lifecycle state machine, and platform handlers — identical across delivery mechanisms.

**Boundary.**
- *Owns:* `BaseMFE` orchestration (state assertion → hooks → transition), the 10 capabilities and their `do*()` extension points, the state machine, platform handlers (auth/telemetry/validation/error/caching/rate-limiting), re-entrancy guard.
- *Does not own:* how a subclass implements `do*()` for a given framework (that is the concrete subclass / Pillar 4 territory); BFF data fetching internals (Pillar 6).

**Key decisions.** ADR-041 (BaseMFE abstract base + 10-capability contract), ADR-042 (lifecycle state machine), ADR-001 (re-entrancy guard), ADR-002/003 (hook model, no custom phases), ADR-004/005 (handler arrays, discovery), ADR-026 (atomic load), ADR-053 (RemoteMFE.doQuery simplification).

**Operational value.** A shell drives every MFE through one lifecycle regardless of framework; illegal transitions fail loudly at the boundary; the contract is the stable integration surface the whole platform promise rests on.

**Risks & failure modes.**
- **This pillar is actively in progress** (REQ-RUNTIME-001–012, issues #47–59): several handler implementations are not yet complete. Adopters must check which capabilities they depend on against `PROJECT-STATUS.md`.
- A subclass that throws outside the lifecycle, or mutates state directly, can corrupt the state machine.
- Control-plane/daemon work (ADR-054–058) is layered on top but not yet a first-class, separately-documented pillar — risk of an under-documented surface.

**Documentation score: 3.** `PLATFORM-CONTRACT.md`, `architecture-runtime-platform.md`, and ADR-041/042 are good; but status of individual capabilities/handlers is spread across issues, and control-plane docs are thin relative to the shipped protocol (ADR-054).

**Recommended upgrades.**
- Add a per-capability status matrix (shipped / in-progress / planned) inside the runtime doc, synced with the issues.
- Decide whether control-plane/daemon graduates to its own pillar + doc (tracked in #218).

---

## Pillar 6 — BFF / GraphQL Mesh Layer

**Purpose.** Give each MFE a per-feature Backend-for-Frontend: a GraphQL Mesh layer composed from OpenAPI/REST sources, generated and managed by the CLI.

**Boundary.**
- *Owns:* Mesh config extraction from the manifest, BFF server generation (Express + Mesh), context/JWT forwarding, demo-mode mock switch, `bff:init/build/dev/validate`.
- *Does not own:* the runtime capability that *calls* the BFF (`query()` in Pillar 5); the manifest grammar (Pillar 2).

**Key decisions.** ADR-012 (GraphQL Mesh BFF layer), ADR-027 (Mesh v0.100.x plugins/transforms), ADR-050 (dependency governance — pinning, `hasBff` gate), ADR-052 (demo-mode per-request mock switch).

**Operational value.** Each MFE owns its data contract without a shared monolith BFF; demo mode enables offline/mocked stakeholder demos; OpenAPI-driven composition reuses existing API specs.

**Risks & failure modes.**
- Mesh version sensitivity (ADR-027/050): dependency drift historically broke BFF builds; pinning is a governance requirement, not optional.
- Query URL/fallback resolution behavior must match docs or `query()` integrations fail in non-obvious ways — see [Contract Alignment Pass](./contract-alignment-pass.md).
- Demo-mode switch, if mis-wired, can leak mock data into a non-demo deployment.

**Documentation score: 3.** `architecture-bff.md` is "Coming Soon"; ADR-012/027/052 plus `docs/requirements/graphql-bff-requirements.md` and `mesh-dependency-matrix.md` cover much of it, but there is no single BFF reference and the standalone `bff:init` path has a known gap (issue #199).

**Recommended upgrades.**
- Author `architecture-bff.md`: composition flow, context injection, demo-mode, version-pinning rationale.
- Document and close the `bff:init` standalone demo-mode emission gap (#199).

---

## Pillar 7 — MCP & AI-Native Tooling

**Purpose.** Expose every CLI command as a Model Context Protocol tool so AI agents can operate the platform safely, and provide the agent-facing affordances (structured output, isolation, federated tool discovery).

**Boundary.**
- *Owns:* the MCP server (`mcp:serve`), the federated tool registry (local schemas + plugins + remote MCP servers), child-process-per-tool-call isolation, mapping `CommandResult<T>` → MCP responses.
- *Does not own:* the command logic itself (Pillar 1); it deliberately *re-invokes* the real CLI rather than calling logic in-process.

**Key decisions.** ADR-019 (child-process isolation — spawn `seans-mfe-tool <cmd> --json` per call), ADR-018 (envelope that makes child-process parsing trivial), ADR-033 (AI head as a first-class developer).

**Operational value.** Agents drive the platform without bespoke integration; isolation makes each tool call atomic and concurrency-safe; the server always tests the real CLI because it shells out to the same binary.

**Risks & failure modes.**
- Per-call Node/Bun startup cost (~200–400ms) accumulates for batch operations; no streaming progress.
- Tool-name collisions across federated sources are a startup error — a misconfigured `mcp.json` blocks the server.
- The MCP layer's correctness is *entirely* dependent on the envelope contract (Pillar 1); any stdout-contract violation breaks it silently.

**Documentation score: 3.** README's MCP section + ADR-018/019 are clear on the mechanism; there is no consolidated "operating the MCP server" guide (config, federation, collision handling, performance characteristics) — tracked as a P2 playbook (#221).

**Recommended upgrades.**
- Author an MCP integration playbook: `mcp.json` schema, federation sources, collision rules, performance guidance (#221).
- Add agent-facing examples mapping common CLI flows to tool calls.

---

## Cross-pillar observations

- **The repeated pattern is "abstract base owns the shape; concrete owns the how"** — `BaseMFE`/`BaseCommand`/`BaseFrameworkPlugin`. It is the single most important thing for a new reader to internalize.
- **Two pillars carry the most documentation debt:** Code Generation Engine (score 2) and several "Coming Soon" subsystem docs. These are the highest-leverage targets in the [Documentation Gap Matrix](./documentation-gap-matrix.md).
- **The envelope contract (Pillar 1) is load-bearing for Pillar 7** — they should be reviewed together (see [Contract Alignment Pass](./contract-alignment-pass.md)).

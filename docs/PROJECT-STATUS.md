# Project Status

**Last Updated:** 2026-07-26

This is the single authoritative overview of what's done, what's active, and what's deferred.
Read this before starting any new work. Then read `CLAUDE.md` for coding conventions and `.github/copilot-instructions.md` for the full context.

> **What this file is not.** It is hand-maintained, so it can drift — it did, by
> two months, which is why the July refresh below exists. For anything with a
> generated source, trust the source over this page:
>
> | Question | Generated source |
> |---|---|
> | Which ADRs exist, and their status | [`docs/spec.md#adr-index`](./spec.md#adr-index) (`npm run build:adr-index`) |
> | Which decisions are outstanding | `seans-mfe-tool adr:status` |
> | What the CLI accepts and returns | [`schemas/`](../schemas/) (`npm run build:schemas`) |
> | Whether the fleet matches its manifests | `npm run check:mfe-drift` |
>
> **Currency note (2026-07-26).** Reconciled against the ADR register, the open
> issue list, and the working tree. The June entry claimed the Runtime Platform
> was the primary active stream; in practice the last two months were the slot
> contract, the control plane, and the drift-gate program — none of which this
> file mentioned. Corrected below.

---

## ✅ Shipped

### CLI Platform — Epic A + B + C (PR #123, closed April 2026)

All 26 issues (#90–#115) closed. Full detail: [`docs/archive/agent-plans/oclif-migration.md`](./archive/agent-plans/oclif-migration.md)

| What                                                                              | Where                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------- |
| oclif replaces Commander; dual bin entries (Bun dev / Node publish)               | `bin/dev.ts`, `bin/run.js`                        |
| `BaseCommand` with `--json` envelope and typed exit codes                         | `packages/oclif-base/`                            |
| `CommandResult<T>`, typed error taxonomy, sysexits exit codes                     | `packages/contracts/`                             |
| All commands ported: `bff/*`, `remote/*`, `api`, `deploy`, `schemas`, `mcp:serve` | `src/commands/`                                   |
| oclif hooks: init, prerun, postrun (graphql-ws telemetry), command_not_found      | `src/hooks/`                                      |
| MCP server with federated tool registry                                           | `src/mcp/`, `src/commands/mcp/serve.ts`           |
| Auto-generated JSON schemas for all command inputs/outputs                        | `schemas/*.json`                                  |
| `--dry-run` normalized across all mutating commands                               | all mutating commands                             |
| Integration test: JSON contract round-trip with ajv                               | `src/oclif/__tests__/json-contract.test.ts`       |
| Plugin contract + starter skeleton                                                | `PLUGIN-CONTRACT.md`, `examples/plugin-skeleton/` |
| npm workspaces + Turborepo build graph                                            | `package.json` (`workspaces`), `turbo.json`       |
| Merge plan: phased path to monorepo                                               | `MERGE-PLAN.md`                                   |

### Code Generation & DSL (pre-#90 era)

| What                                                        | Requirement           | Where                           |
| ----------------------------------------------------------- | --------------------- | ------------------------------- |
| DSL schema, parser, validator, type system                  | REQ-042–058 ✅        | `src/dsl/`, `packages/dsl/`     |
| GraphQL BFF (Mesh init, validate, build, dev)               | REQ-BFF-001–008 ✅    | `src/commands/bff/`             |
| DSL-first remote generation                                 | REQ-REMOTE-001–010 ✅ | `src/commands/remote/`          |
| Orchestration system (shell + registry + auto-registration) | REQ-001–041 ✅        | `src/commands/`, `src/codegen/` |
| OpenAPI → REST API generator (Express + MongoDB/SQLite)     | — ✅                  | `src/codegen/`                  |

### Framework Plugin System — ADR-036 (Issues #167–185, PRs #187–188, May 2026)

| What                                                                              | Where                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------- |
| Abstract `BaseFrameworkPlugin` (core owns build/scaffold/Docker shape)            | `packages/contracts/src/framework-plugin.ts`      |
| Concrete `ReactRspackPlugin` / `AngularWebpackPlugin`                              | `packages/framework-react/`, `packages/framework-angular/` |
| `loadFrameworkPlugin()` resolution; `--framework` flag on `remote:init`           | `src/framework/loader.ts`                         |
| `build:dev/prod/docker/check`, `remote:init`, `deploy` delegate to the plugin     | `src/commands/build/`, `src/commands/remote/`     |
| Open `framework`/`bundler` manifest fields (unknown → stderr warn, not error)     | `src/dsl/schema.ts` (`FrameworkSchema`/`BundlerSchema`; ADR-036, #181) |
| Authoring guide                                                                   | [`docs/framework-plugin-authoring.md`](./framework-plugin-authoring.md) |

### Runtime Composition — Control Plane, Slots, Layout (ADR-054–060, ADR-066–073)

| What | Where |
| --- | --- |
| Control-plane message protocol; virtualized daemon socket | `packages/contracts/src/` (ADR-054, ADR-057) |
| `LayoutManager` — daemon-driven slot composition; contextualized VM composition | `packages/runtime/src/layout-manager.ts` (ADR-055, ADR-060) |
| `BaseControlPlane` abstract base | `packages/runtime/src/base-control-plane.ts` (ADR-059) |
| Slot contract — stable addressing, desired-state placement, provider-scoped ids, single-sourced grammar | `packages/contracts/src/slot-contract.ts`, `slot-grammar.ts` (ADR-066–069) |
| `DeclaredSlot` app-code API + design-time validation (`slots:validate`, `slots-implemented` rule) | `packages/framework-react/`, `packages/dsl/src/slot-validation.ts` (ADR-072, ADR-073) |
| Explainers | [`docs/slot-contract.md`](./slot-contract.md), [`docs/slot-architecture.md`](./slot-architecture.md) |

### Drift Control — the fleet cannot disagree with its manifests

Five gates, all CI-enforced. This is the platform's answer to "what does the tool own": ownership is
the `overwrite` flag on the generation plan, enforced by regenerating and diffing (ADR-074, ADR-077).

| Gate | Keeps in sync | Command |
| --- | --- | --- |
| #295 | generator-owned files ⇄ manifest | `npm run check:mfe-drift` |
| #296 | `package.json` + federation `shared` ⇄ manifest | `npm run check:mfe-consistency` |
| ADR-073 | app code ⇄ manifest; registry rules ⇄ manifest | `mfe:validate`, `slots:validate` |
| #328 | a freshly scaffolded MFE ⇄ `tsc` | `npm run check:template-typecheck` |
| ADR-075 | the ADR library itself | `npm run check:adr` |

### ADR Governance under Drift Control (ADR-075)

Frontmatter is the source of truth; [`docs/spec.md#adr-index`](./spec.md#adr-index) and the PDR↔ADR
map are generated from it. `adr:status` and `adr:validate` ship as commands. **79 ADRs**: 52
Implemented, 14 Accepted, 11 Proposed, 1 Deferred, 1 Superseded.

### Agent Contract (ADR-077, epic #139)

| What | Where |
| --- | --- |
| `--no-interactive` as a real flag, separable from `--json` | `packages/oclif-base/src/BaseCommand.ts` |
| Typed sysexits codes on *every* failure path, not only under `--json` | same |
| MCP tool catalog derived from the oclif registry — inputs from flags/args, outputs from each command's declared result type | `src/oclif/schema-derivation.ts`, `src/oclif/type-to-schema.ts`, `scripts/generate-schemas.ts` |
| Registry-driven conformance sweep + response validation against published schemas | `src/oclif/__tests__/command-conformance.test.ts`, `output-schema-conformance.test.ts` |
| Build output parsed into classified `BuildError`s (rspack, tsc, `ng`) | `packages/contracts/src/build-output-parser.ts` |
| `strict: true` across every tsconfig | root + `packages/*/tsconfig.json` |

### Reference Applications

| App | What it demonstrates |
| --- | --- |
| [`examples/meridian-station/`](../examples/meridian-station/) | 7 MFEs across React and Angular, three deliberately hostile APIs, per-MFE BFFs, a control-plane-driven generic shell. Everything but the shell generated by the real CLI, two MFEs through MCP. See its `DX-REPORT.md` — a 22-item field report, 18 fixed in the same PR. |
| [`examples/abc-kids/`](../examples/abc-kids/) | 14 game MFEs, an imperative arcade shell, the ADR-052 live/mock switch. Engineering-discipline parity tracked in #289. |

---

## 🟡 Active

### Agent contract completion — epic #139 (ADR-077)

The two-headed giant epic, re-derived from measured friction rather than the April spec.
Full evidence: [`docs/archive/platform-design-review/two-headed-giant-re-derivation.md`](./archive/platform-design-review/two-headed-giant-re-derivation.md).

Remaining: real `likely-cause` classification beyond the current parsers, MCP schema coverage
verified for the three commands with no cheap success-path fixture, `received`/`suggestion` on
manifest validation errors (#141), and wiring ADR-030's dead pattern branch.

### `platform:init` — composition environment as a generated artifact (#329)

ADR-078 (Accepted, impl phased under #139) + PDR-008 (Accepted). `@falese/daemon` is **retired**
and this repo owns the canonical control plane.

**§1 done:** the registry and daemon are `packages/control-plane`, consumed by both reference
fleets; the two byte-identical copies are gone and each fleet keeps only its `rules.json`.

**Still open:** persistence as a manifest field (§2), `platform:init` generating the shell plus
its control plane in one command (§3), and generated registration blocks (§4). Absorbs #144.

### One fleet-description engine (#330)

`explain` / `system:map` / `status` as renderings over a single pure `describe()` layer, rather
than three discovery walks. Supersedes the approach in #146 and #147.

### abc-kids → Meridian engineering-discipline parity (#289)

Regen invariance, artifact hygiene, MCP dogfooding, and registry-resolved composition for the
arcade — keeping its product identity, not homogenising it. Children #290, #300–#305.

### ADR-070 experience-scoped federated supergraph (#282–#288)

Phased: `schema()` returning BFF SDL, registry schema cache, daemon-hosted Mesh gateway, then
cross-subgraph type merge.

### Runtime Platform (Issues #47–59)

**Requirement set:** REQ-RUNTIME-001 through REQ-RUNTIME-012  
**Architecture doc:** [`docs/architecture-runtime-platform.md`](./architecture-runtime-platform.md)  
**Code:** `packages/runtime/`

Long-running and partially overtaken — much of the lifecycle, error-boundary and platform-handler
work landed via ADR-024/025/076 and the control-plane stream rather than through these issues.
**Audit before picking one up**; several are likely closable.

### BaseMFE Boilerplate Codegen from DSL (Issue #39)

**Requirement:** REQ-057  
**Requirements doc:** [`docs/requirements/REQ-057-base-mfe-boilerplate.md`](./requirements/REQ-057-base-mfe-boilerplate.md)  
**Note:** Blocked until runtime platform is sufficiently stable (REQ-RUNTIME-002 at minimum).

---

## 📋 Planned (no issues yet)

### Lifecycle Engine Enhancements

**5 enhancements** to the lifecycle engine — all ADRs written, GitHub issues not yet created.

| Enhancement                | ADR     | Status                                                     |
| -------------------------- | ------- | ---------------------------------------------------------- |
| Timeout protection         | ADR-029 | ✅ Implemented — `packages/runtime/src/timeout-wrapper.ts`  |
| Error classification       | ADR-030 | ✅ Implemented — `packages/contracts/src/error-classifier.ts` (note: its pattern branch is unreachable from the CLI path — tracked in #139) |
| Parallel handler execution | ADR-028 | 📋 Proposed — no issue yet                                  |
| Conditional execution      | ADR-031 | 📋 Proposed — no issue yet                                  |
| Inter-hook communication   | ADR-032 | 📋 Proposed — no issue yet                                  |

**Requirements doc:** [`docs/requirements/lifecycle-enhancements.md`](./requirements/lifecycle-enhancements.md)  
**Issue templates ready:** see `docs/archive/planning/GITHUB-ISSUES-LIFECYCLE-ENHANCEMENTS.md` in git history (archive removed from the tree; #239)

To create issues:

```bash
# See docs/archive/planning/GITHUB-ISSUES-LIFECYCLE-ENHANCEMENTS.md for gh issue create commands
```

---

## ⏳ Deferred / Pending Prerequisites

### npm Publish: `@seans-mfe/contracts` + `@seans-mfe/oclif-base`

**Blocker for:** MERGE-PLAN.md Phase 1 success criteria  
**Tracking:** [`MERGE-PLAN.md`](MERGE-PLAN.md)

Phase 1 success criteria (all must be true before Phase 2 / monorepo merge):

- [ ] `@seans-mfe/contracts` published to npm with stable semver
- [ ] `@seans-mfe/oclif-base` published to npm with stable semver
- [ ] ~~`@falese/daemon-plugin` passes `plugins link` + `--json` envelope test~~ — **void.** PDR-008
      brings the control plane into the platform and retires `@falese/daemon`; the daemon is no
      longer a plugin to certify.
- [ ] `@falese/coder-plugin` passes MCP federation test
- [ ] Remaining repos have green CI running `turbo run test build`

Also pending and higher-leverage than it looks: **`@seans-mfe/runtime` is unpublished**
(ADR-064, #252). The Meridian DX report names the `dist/runtime` staging workaround as the cause
of "every one of this build's environment-specific detours" — it is the single most-cited source
of friction in the reference-app builds.

### Monorepo Consolidation

**Phase 2** of `MERGE-PLAN.md` — absorb `Falese/coder` into a single repo. (`Falese/daemon` is
retired, not absorbed — the control plane already ships here, PDR-008/ADR-078.)  
**Prerequisite:** All Phase 1 criteria met + contract stability ≥30 days.

### Deferred Feature Work

See [`docs/requirements/deferred-backlog.md`](./requirements/deferred-backlog.md) for the full list, including:

- Marker-aware DSL regeneration (preserve user code in generated files)
- Multiple bundler support (webpack, vite)
- Interactive capability wizard
- E2E / visual regression test templates
- Authorization expression grammar

---

## Key Navigation

| I want to...                                         | Go to                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Understand *why* the platform is built this way      | [`docs/product-decisions/`](./product-decisions/README.md) (PDRs)                                       |
| Find an architecture decision (ADR-NNN)              | [`docs/spec.md#adr-index`](./spec.md#adr-index) — generated from frontmatter (ADR-075)                  |
| See which decisions are outstanding                 | `seans-mfe-tool adr:status`                                                                             |
| Understand slot composition                         | [`docs/slot-contract.md`](./slot-contract.md), [`docs/slot-architecture.md`](./slot-architecture.md)   |
| Understand the agent-facing contract                | [`docs/archive/platform-design-review/two-headed-giant-re-derivation.md`](./archive/platform-design-review/two-headed-giant-re-derivation.md) |
| See what a real agent-driven build hit              | [`examples/meridian-station/DX-REPORT.md`](../examples/meridian-station/DX-REPORT.md)                   |
| Understand the CLI/oclif migration that just shipped | [`docs/archive/agent-plans/oclif-migration.md`](./archive/agent-plans/oclif-migration.md)                               |
| Work on the runtime platform                         | [`docs/architecture-runtime-platform.md`](./architecture-runtime-platform.md) + `packages/runtime/`     |
| Implement a lifecycle engine enhancement             | [`docs/requirements/lifecycle-enhancements.md`](./requirements/lifecycle-enhancements.md) + ADR-028–032 |
| Understand the merge/monorepo plan                   | [`MERGE-PLAN.md`](MERGE-PLAN.md)                                                                     |
| Find a specific requirement (REQ-XXX)                | [`docs/requirements/TRACEABILITY.md`](./requirements/TRACEABILITY.md)                                   |
| Understand the full architecture                     | [`docs/architecture-current-state.md`](./architecture-current-state.md)                                 |
| Check coding patterns and agent guidance             | [`CLAUDE.md`](../CLAUDE.md) + [`.github/copilot-instructions.md`](../.github/copilot-instructions.md)   |

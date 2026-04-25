# Project Status

**Last Updated:** April 2026  
**Branch:** `main`

This is the single authoritative overview of what's done, what's active, and what's deferred.
Read this before starting any new work. Then read `CLAUDE.md` for coding conventions and `.github/copilot-instructions.md` for the full context.

---

## ✅ Shipped

### CLI Platform — Epic A + B + C (PR #123, closed April 2026)

All 26 issues (#90–#115) closed. Full detail: [`docs/agent-plans/oclif-migration.md`](./agent-plans/oclif-migration.md)

| What | Where |
|---|---|
| oclif replaces Commander; dual bin entries (Bun dev / Node publish) | `bin/dev.ts`, `bin/run.js` |
| `BaseCommand` with `--json` envelope and typed exit codes | `packages/oclif-base/` |
| `CommandResult<T>`, typed error taxonomy, sysexits exit codes | `packages/contracts/` |
| All commands ported: `bff/*`, `remote/*`, `api`, `deploy`, `schemas`, `mcp:serve` | `src/commands/` |
| oclif hooks: init, prerun, postrun (graphql-ws telemetry), command_not_found | `src/hooks/` |
| MCP server with federated tool registry | `src/mcp/`, `src/commands/mcp/serve.ts` |
| Auto-generated JSON schemas for all command inputs/outputs | `schemas/*.json` |
| `--dry-run` normalized across all mutating commands | all mutating commands |
| Integration test: JSON contract round-trip with ajv | `src/oclif/__tests__/json-contract.test.ts` |
| Plugin contract + starter skeleton | `PLUGIN-CONTRACT.md`, `examples/plugin-skeleton/` |
| pnpm workspaces + Turborepo build graph | `pnpm-workspace.yaml`, `turbo.json` |
| Merge plan: phased path to monorepo | `MERGE-PLAN.md` |

### Code Generation & DSL (pre-#90 era)

| What | Requirement | Where |
|---|---|---|
| DSL schema, parser, validator, type system | REQ-042–058 ✅ | `src/dsl/`, `packages/dsl/` |
| GraphQL BFF (Mesh init, validate, build, dev) | REQ-BFF-001–008 ✅ | `src/commands/bff/` |
| DSL-first remote generation | REQ-REMOTE-001–010 ✅ | `src/commands/remote/` |
| Orchestration system (shell + registry + auto-registration) | REQ-001–041 ✅ | `src/commands/`, `src/codegen/` |
| OpenAPI → REST API generator (Express + MongoDB/SQLite) | — ✅ | `src/codegen/` |

---

## 🟡 Active

### Runtime Platform (Issues #47–59)

**Requirement set:** REQ-RUNTIME-001 through REQ-RUNTIME-012  
**Architecture doc:** [`docs/architecture-runtime-platform.md`](./architecture-runtime-platform.md)  
**Requirements doc:** [`docs/requirements/`](./requirements/) (runtime-requirements.md)  
**Code:** `src/runtime/`, `packages/runtime/`

Priority order:
1. #49 — REQ-RUNTIME-002: Shared Context
2. #52 — REQ-RUNTIME-005: Platform Handler Registry
3. #47 — REQ-RUNTIME-001: Load Capability (atomic — ADR-060)
4. #51 — REQ-RUNTIME-004: Render Capability
5. #53 — REQ-RUNTIME-006: Auth Handler
6. #56 — REQ-RUNTIME-009: Error Handling Handler
7–12. Remaining handlers (#54, #55, #57, #50, #58, #59)

### BaseMFE Boilerplate Codegen from DSL (Issue #39)

**Requirement:** REQ-057  
**Requirements doc:** [`docs/requirements/REQ-057-base-mfe-boilerplate.md`](./requirements/REQ-057-base-mfe-boilerplate.md)  
**Note:** Blocked until runtime platform is sufficiently stable (REQ-RUNTIME-002 at minimum).

---

## 📋 Planned (no issues yet)

### Lifecycle Engine Enhancements

**5 enhancements** to the lifecycle engine — all ADRs written, GitHub issues not yet created.

| Enhancement | ADR | Status |
|---|---|---|
| Parallel handler execution | ADR-063 | 📋 Planned |
| Timeout protection | ADR-064 | 📋 Planned |
| Error classification | ADR-065 | 📋 Planned |
| Conditional execution | ADR-066 | 📋 Planned |
| Inter-hook communication | ADR-067 | 📋 Planned |

**Requirements doc:** [`docs/requirements/lifecycle-enhancements.md`](./requirements/lifecycle-enhancements.md)  
**Issue templates ready:** [`docs/archive/planning/GITHUB-ISSUES-LIFECYCLE-ENHANCEMENTS.md`](./archive/planning/GITHUB-ISSUES-LIFECYCLE-ENHANCEMENTS.md)

To create issues:
```bash
# See docs/archive/planning/GITHUB-ISSUES-LIFECYCLE-ENHANCEMENTS.md for gh issue create commands
```

### Architecture Sub-docs

These are referenced in `architecture-current-state.md` but not yet written:

- `docs/architecture-codegen.md` — Code Generation Engine
- `docs/architecture-dsl.md` — DSL & Type System
- `docs/architecture-bff.md` — BFF Layer
- `docs/architecture-api-generator.md` — API Generator

All underlying code is complete; documentation is the gap.

---

## ⏳ Deferred / Pending Prerequisites

### npm Publish: `@seans-mfe/contracts` + `@seans-mfe/oclif-base`

**Blocker for:** MERGE-PLAN.md Phase 1 success criteria  
**Tracking:** [`MERGE-PLAN.md`](../MERGE-PLAN.md)

Phase 1 success criteria (all must be true before Phase 2 / monorepo merge):
- [ ] `@seans-mfe/contracts` published to npm with stable semver
- [ ] `@seans-mfe/oclif-base` published to npm with stable semver
- [ ] `@falese/daemon-plugin` passes `plugins link` + `--json` envelope test
- [ ] `@falese/coder-plugin` passes MCP federation test
- [ ] All three repos have green CI running `turbo run test build`

### Monorepo Consolidation

**Phase 2** of `MERGE-PLAN.md` — absorb `Falese/daemon` and `Falese/coder` into a single repo.  
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

| I want to... | Go to |
|---|---|
| Understand the CLI/oclif migration that just shipped | [`docs/agent-plans/oclif-migration.md`](./agent-plans/oclif-migration.md) |
| Work on the runtime platform | [`docs/architecture-runtime-platform.md`](./architecture-runtime-platform.md) + `packages/runtime/` |
| Implement a lifecycle engine enhancement | [`docs/requirements/lifecycle-enhancements.md`](./requirements/lifecycle-enhancements.md) + ADR-063–067 |
| Understand the merge/monorepo plan | [`MERGE-PLAN.md`](../MERGE-PLAN.md) |
| Find a specific requirement (REQ-XXX) | [`docs/requirements/TRACEABILITY.md`](./requirements/TRACEABILITY.md) |
| Understand the full architecture | [`docs/architecture-current-state.md`](./architecture-current-state.md) |
| Check coding patterns and agent guidance | [`CLAUDE.md`](../CLAUDE.md) + [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) |

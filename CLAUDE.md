# CLAUDE.md

Guidance for Claude Code sessions working on `seans-mfe-tool`.

**Read `.github/copilot-instructions.md` first.** It is the 754-line baseline covering CLI structure, codegen flow, module federation, templates, runtime patterns, and ADR references. This file is a thin overlay with context the copilot doc predates — the in-flight migration, locked architectural decisions, and new code patterns.

For deep background, read `docs/agent-plans/oclif-migration.md`.

## Migration state ✅ Complete

All three epics shipped via PR #123 (merged April 2026). Issues #90–#115 are closed.

| Epic                       | Issues                         | Theme                                                                                                  | Status  |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | ------- |
| A — oclif Migration        | falese/seans-mfe-tool#90–#99   | Replace Commander with oclif; Bun dev entry; plugin system                                             | ✅ Done |
| B — JSON Agent Interface   | falese/seans-mfe-tool#100–#108 | `CommandResult` envelope, `--json` mode, JSON Schemas, MCP server                                      | ✅ Done |
| C — Unification Foundation | falese/seans-mfe-tool#109–#115 | `@seans-mfe/contracts` + `@seans-mfe/oclif-base` packages, plugin contract, MCP federation, merge plan | ✅ Done |

See `docs/agent-plans/oclif-migration.md` for verification gates and completion notes.

### What's active now

| Work stream                                                     | Location                                                   | Status                              |
| --------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| Runtime platform (REQ-RUNTIME-001–012)                          | `src/runtime/`, `packages/runtime/`                        | 🟡 In Progress (issues #47–59)      |
| BaseMFE boilerplate codegen from DSL                            | `docs/requirements/REQ-057-base-mfe-boilerplate.md`        | 🟡 In Progress (issue #39)          |
| Lifecycle engine enhancements (5 features)                      | `docs/requirements/lifecycle-enhancements.md`, ADR-063–067 | 📋 Planned (issues not yet created) |
| npm publish of `@seans-mfe/contracts` + `@seans-mfe/oclif-base` | `packages/contracts/`, `packages/oclif-base/`              | ⏳ Pending (MERGE-PLAN.md Phase 1)  |

See `docs/PROJECT-STATUS.md` for the full current-state overview.

## Locked decisions — do not relitigate

These were decided during planning. Do not open them back up inside an implementation PR; propose a new ADR if new evidence warrants revisiting.

- **Plugin-first, not merge-first.** `Falese/daemon` and `Falese/coder` ship oclif plugins depending on `@seans-mfe/contracts`. Monorepo merge is a later phase (`MERGE-PLAN.md`).
- **Namespace: `@seans-mfe/*`** for shared packages; `@falese/*` for third-party plugins.
- **MCP uses child-process per tool call.** Spawn `seans-mfe-tool <cmd> --json`, parse stdout envelope. Isolates `process.exit` and cwd mutations; concurrency-safe.
- **Bun for dev, Node for the published npm package.** `bin/dev.ts` runs under Bun (no transpile). `bin/run.js` is the pure-Node published entry loading `dist/commands/`.

## New patterns introduced by the migration

### BaseCommand

Every oclif command extends `BaseCommand` (pre-C3: `src/oclif/BaseCommand.ts`; post-C3: `@seans-mfe/oclif-base`). Subclasses implement `async runCommand(): Promise<T>`, NOT `run()`. `BaseCommand.run()` owns the JSON envelope, exit codes, stdout/stderr split, and prompt rejection under `--json`.

### Typed errors

Do NOT `throw new Error(...)` in command code. Use typed errors from `@seans-mfe/contracts` (pre-C1: `src/runtime/errors/`):

- `ValidationError` — bad user input, missing required flag, Zod failure. Exit 64.
- `BusinessError` — rule violation (e.g., directory exists without `--force`). Exit 65.
- `NetworkError` — registry, WS, HTTP failure. Exit 66.
- `SystemError` — FS read, missing binary, interactive-prompt-under-json. Exit 69.
- `TimeoutError` — exit 124. `SecurityError` — exit 77.

The classifier (`error-classifier.ts`) turns these into `CommandResult.error` under `--json`.

### JSON envelope contract

Under `--json`, stdout emits exactly ONE line: a `CommandResult<T>` object. Everything else (chalk, logs, progress) goes to stderr. Exit codes: 0, 2, 64, 65, 66, 69, 70, 77, 124. Source of truth: `packages/contracts/src/envelope.ts` post-C1, `src/oclif/envelope.ts` pre-C1.

### File layout for oclif

- Colon topics → nested dirs. `bff:init` lives at `src/commands/bff/init.ts`, not `bff.ts`.
- Files prefixed with `_` (e.g. `_shared.ts`) are skipped by oclif discovery — use for helpers.
- Legacy top-level files (`bff.ts`, `remote-init.ts`, `create-api.ts`) stay as re-export shims during migration so existing tests keep working.

## Where things live (post-migration)

| Concept          | Path                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `BaseCommand`    | `packages/oclif-base/src/BaseCommand.ts` (post-C3) / `src/oclif/BaseCommand.ts` (pre-C3) |
| Envelope types   | `@seans-mfe/contracts/envelope` (post-C1) / `src/oclif/envelope.ts` (pre-C1)             |
| Typed errors     | `@seans-mfe/contracts/errors` (post-C1) / `src/runtime/errors/` (pre-C1)                 |
| Error classifier | `@seans-mfe/contracts/error-classifier` (post-C1) / `src/runtime/error-classifier.ts`    |
| JSON schemas     | `schemas/<topic>/<cmd>.json` (generated by B5)                                           |
| MCP server       | `src/commands/mcp/serve.ts`; registry `src/mcp/tool-registry.ts`                         |
| Hooks            | `src/hooks/{init,prerun,postrun,command-not-found}.ts`                                   |
| Plugin skeleton  | `examples/plugin-skeleton/`                                                              |

## Dev commands

| Command                 | When to run                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `npm run lint`          | Before every commit                                                |
| `npm run typecheck`     | Before every commit (TS work especially)                           |
| `npm test`              | After any `src/**/*` change                                        |
| `npm run test:ci`       | If you changed anything in `src/runtime/` (enforces 80% coverage)  |
| `npm run build`         | Before pushing; catches broken oclif manifest                      |
| `npm run build:schemas` | After any change to command flags, args, or return types (post-B5) |
| `npm run dev`           | Legacy Node entry; will switch to `bun bin/dev.ts` after A1        |
| `bun bin/dev.ts <cmd>`  | Post-A1 dev entry; no transpile                                    |
| `npm run format`        | Before PR                                                          |

## Files that require coordination

These are touched by multiple in-flight issues. Before editing, check if another open PR already has them:

- `package.json` `oclif` section — modified by A1, A7, A8, A9, A10.
- `src/oclif/BaseCommand.ts` — modified by A2, B2, then moved in C3.
- `src/oclif/envelope.ts` — created in B1, moved in C1.
- `src/commands/**/*.ts` — B3, B4, B8 touch all of them.
- `schemas/` — generated only; never hand-edit.
- `pnpm-workspace.yaml`, `turbo.json` — only C1, C3, C6 touch these.

## Verification gates before push

Run these in order. Push only after all pass:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test` (or `npm run test:ci` if you touched runtime code)
4. `npm run build`
5. Post-B5: `npm run build:schemas && git diff --exit-code schemas/`

## Branch and commit discipline

- Branch: `claude/issue-<num>-<short-slug>` (e.g., `claude/issue-92-port-deploy-oclif`). Matches existing `claude/*` pattern in git log.
- Commits: Conventional Commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Every commit body includes `Refs #<num>` (or `Closes #<num>` on the final commit of a PR).
- No `--no-verify`, no `--no-gpg-sign`, no `--amend` on pushed commits.
- No force-push to `main`, ever.

## ADR interaction

ADRs in `docs/architecture-decisions/` are stable decisions. If your issue contradicts or extends an ADR:

- Add a NEW ADR file in the same PR (e.g., `ADR-068-...`).
- Do NOT edit existing ADRs mid-implementation.
- Reference the new ADR in the PR body.

## Session-end checklist

Before opening the PR:

- [ ] Every acceptance criterion from the issue is checked off in the PR body with evidence (test name or command).
- [ ] All verification gates green.
- [ ] PR body links the issue (`Closes #<num>`).
- [ ] No files from "Files that require coordination" touched unless the issue explicitly owns them.

# seans-mfe-tool — Project Memory

## What this project is

A platform for delivering **domain features as independently deployable units**, in any framework, language, or federation pattern. The CLI generates and manages domain-capability MFEs; the runtime platform provides the lifecycle contract that makes them composable in a shell — regardless of how they were built.

Federation (Module Federation, ESM, iframe, web components) is a delivery mechanism, not the purpose of the platform.

Long-term goal: a community marketplace of domain-capability packages — teams publish adaptor packs; any shell operator installs and composes them.

Full spec: `@docs/spec.md`

## Stack

- **Runtime:** Node ≥18 (published), Bun (dev entry — no transpile)
- **Language:** TypeScript (strict, no `any`)
- **CLI framework:** oclif (colon topics, plugin architecture)
- **Packages:** `packages/contracts/`, `packages/oclif-base/`, `packages/runtime/`
- **Bundler support generated:** rspack (React), webpack/@angular-builders (Angular)
- **Test runner:** Jest
- **Validation:** Zod

## Commands

| Command | When to run |
|---|---|
| `npm run lint` | Before every commit |
| `npm run typecheck` | Before every commit |
| `npm test` | After any `src/**/*` change |
| `npm run test:ci` | If you touched `src/runtime/` (enforces 80% coverage) |
| `npm run build` | Before pushing — catches broken oclif manifest |
| `npm run build:schemas` | After any change to command flags, args, or return types |
| `npm run format` | Before PR |
| `bun bin/dev.ts <cmd>` | Dev entry (no transpile) |
| `turbo run docker:build:examples` | Build CLI image + all abc-kids MFE images (full chain; skips if inputs unchanged) |
| `turbo run docker:build:examples --force` | Force-rebuild everything (use in CI or after deleting images) |

## Development rules

- **TDD always** — write a failing test first, then the code to pass it
- Never write code without a corresponding test
- `npm run typecheck` must be clean before any commit
- `npm run lint` must be clean before any commit
- No `any` types — use `unknown` and narrow
- No `console.log` in production code — use the structured logger
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Every commit body includes `Refs #N` (or `Closes #N` on the final commit of a PR)
- No `--no-verify`, no `--no-gpg-sign`, no force-push to `main`

## ADR governance

**Before making any architectural decision, check `docs/architecture-decisions/`.**

- If a relevant ADR exists → reference it in code comments, commit messages, and PR body (`ADR-NNN`)
- If no ADR covers the decision → **stop and ask the human** before implementing; do not invent architecture
- Never edit existing ADRs mid-implementation — add a new ADR file instead
- New ADRs go in `docs/architecture-decisions/ADR-NNN-short-slug.md`
- Reference the new ADR in the PR body

ADR quick index: `@docs/spec.md#adr-index`

## Architecture constraints

- **BaseCommand pattern:** every oclif command extends `BaseCommand` from `@seans-mfe/oclif-base`; implement `runCommand()` not `run()`
- **Typed errors:** never `throw new Error()` — use `ValidationError` / `BusinessError` / `NetworkError` / `SystemError` / `TimeoutError` / `SecurityError` from `@seans-mfe/contracts`
- **JSON envelope:** under `--json`, stdout emits exactly ONE `CommandResult<T>` line; everything else goes to stderr
- **MCP child-process per tool call:** spawn `seans-mfe-tool <cmd> --json`, parse stdout — isolates `process.exit` and cwd mutations
- **Bun for dev, Node for publish:** `bin/dev.ts` runs under Bun; `bin/run.js` is the pure-Node published entry
- **Framework-agnostic runtime contract:** `BaseMFE` lifecycle is delivery-mechanism-independent; adding a new framework means a new codegen template variant, not a new lifecycle

## Current state (2026-05-24)

| Work stream | Status |
|---|---|
| oclif migration (Epics A + B + C, PR #123) | ✅ Done |
| Codegen + DSL pipeline | ✅ Done |
| GraphQL BFF layer | ✅ Done |
| Runtime platform (REQ-RUNTIME-001–012) | 🟡 In Progress (issues #47–59) |
| BaseMFE boilerplate codegen from DSL (REQ-057) | 🟡 In Progress (issue #39) |
| Lifecycle engine enhancements (ADR-063–067) | 📋 Planned (issues not yet created) |
| npm publish `@seans-mfe/contracts` + `@seans-mfe/oclif-base` | ⏳ Pending (MERGE-PLAN.md Phase 1) |

See `docs/PROJECT-STATUS.md` for priority order and blockers.

## Where things live

| Concept | Path |
|---|---|
| `BaseCommand` | `packages/oclif-base/src/BaseCommand.ts` |
| Envelope types | `packages/contracts/src/envelope.ts` |
| Typed errors | `packages/contracts/src/errors/` |
| Error classifier | `packages/contracts/src/error-classifier.ts` |
| Runtime lifecycle | `packages/runtime/src/` |
| JSON schemas | `schemas/<topic>/<cmd>.json` (generated — never hand-edit) |
| MCP server | `src/commands/mcp/serve.ts`; registry `src/mcp/tool-registry.ts` |
| Hooks | `src/hooks/{init,prerun,postrun,command-not-found}.ts` |
| Codegen templates | `src/codegen/templates/` |
| Plugin skeleton | `examples/plugin-skeleton/` |
| ADRs | `docs/architecture-decisions/` |

## Resolved decisions — do not relitigate

- **Plugin-first, not merge-first.** `Falese/daemon` and `Falese/coder` ship as oclif plugins depending on `@seans-mfe/contracts`. Monorepo merge is a later phase.
- **Namespace: `@seans-mfe/*`** for shared packages; `@falese/*` for third-party plugins.
- **MCP child-process per tool call.** Spawn `seans-mfe-tool <cmd> --json`. Isolates `process.exit` and cwd mutations; concurrency-safe.
- **Bun for dev, Node for publish.** `bin/dev.ts` / `bin/run.js` split is permanent.
- **Framework-agnostic codegen.** `framework` and `bundler` are DSL manifest fields; new framework support = new template variant (ADR-069).

## Backlog priority

1. ~~oclif Migration (A + B + C)~~ ✅
2. ~~Codegen + DSL pipeline~~ ✅
3. ~~GraphQL BFF layer~~ ✅
4. Runtime platform — REQ-RUNTIME-002 → 005 → 001 → 004 → … (issues #47–59) 🟡
5. BaseMFE boilerplate codegen from DSL — REQ-057 (issue #39, blocked on #49) 🟡
6. Lifecycle engine enhancements — ADR-063–067 (issues not yet created) 📋
7. npm publish `@seans-mfe/contracts` + `@seans-mfe/oclif-base` ⏳
8. Monorepo consolidation (MERGE-PLAN.md Phase 2) ⏳

## Verification gates before push

Run in order — push only after all pass:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test` (or `npm run test:ci` if you touched runtime code)
4. `npm run build`
5. `npm run build:schemas && git diff --exit-code schemas/` (if you changed command flags/types)

## Branch and commit discipline

- Branch: `claude/issue-<num>-<short-slug>` (e.g. `claude/issue-49-shared-context`)
- Commits: Conventional Commits with `Refs #N` or `Closes #N` in body
- No `--no-verify`, no `--no-gpg-sign`, no `--amend` on pushed commits
- No force-push to `main`

## Session-end checklist

Before opening the PR:

- [ ] Every acceptance criterion checked off in PR body with evidence (test name or command output)
- [ ] All verification gates green
- [ ] PR body links the issue (`Closes #N`) and references governing ADRs
- [ ] New architectural decisions either cite an existing ADR or include a new ADR file in the PR
- [ ] No shared files touched unless the issue explicitly owns them (`package.json` oclif section, `pnpm-workspace.yaml`, `turbo.json`, `schemas/`)

For the current session's active issue and spec context: `@session-prompt.md`

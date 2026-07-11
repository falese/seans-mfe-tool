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
| `npm run build && npm run docker:build:cli` | After any `src/runtime/**` change: recompile dist/ THEN rebuild CLI image (dist/ is gitignored but baked into the CLI Docker image) |

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
| Framework plugin system (ADR-036, #167–#185, PRs #187–#188) | ✅ Done |
| Runtime platform (REQ-RUNTIME-001–012) | 🟡 In Progress (issues #47–59) |
| Slot contract — stable addressing, desired-state placement, manifest-declared/provider-scoped slots (ADR-066/067/068, #265) | 🟡 On branch `claude/slot-address-stability-t4cx9u`, pending PR/CI; see `docs/slot-contract.md` |
| BaseMFE boilerplate codegen from DSL (REQ-057) | 🟡 In Progress (issue #39) |
| Lifecycle engine enhancements (ADR-028–032) | 📋 Planned (issues not yet created) |
| npm publish `@seans-mfe/contracts` + `@seans-mfe/oclif-base` | ⏳ Pending (docs/MERGE-PLAN.md Phase 1) |

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
| ADR register (canonical numbering) | `docs/architecture-decisions/README.md` |
| Product decisions (why) | `docs/product-decisions/` (PDRs + register) |
| Slot contract logic (matching + guard, framework-free) | `packages/runtime/src/slot-contract.ts` |
| React slot sugar (`DeclaredSlot`, beside `MfeHost`) | `packages/framework-react/src/runtime/DeclaredSlot.tsx` |
| Generated slot contract template (data + thin binding) | `packages/codegen/templates/base-mfe/slots.tsx.ejs` |
| Slot contract explainer (ADR-066/067/068 in plain language) | `docs/slot-contract.md` |
| Framework plugin base | `packages/contracts/src/framework-plugin.ts` |
| Framework plugin loader | `src/framework/loader.ts` |
| React plugin | `packages/framework-react/src/plugin.ts` |
| Angular plugin | `packages/framework-angular/src/plugin.ts` |
| Plugin authoring guide | `docs/framework-plugin-authoring.md` |

## Resolved decisions — do not relitigate

- **Plugin-first, not merge-first.** `Falese/daemon` and `Falese/coder` ship as oclif plugins depending on `@seans-mfe/contracts`. Monorepo merge is a later phase.
- **Namespace: `@seans-mfe/*`** for shared packages; `@falese/*` for third-party plugins.
- **MCP child-process per tool call.** Spawn `seans-mfe-tool <cmd> --json`. Isolates `process.exit` and cwd mutations; concurrency-safe.
- **Bun for dev, Node for publish.** `bin/dev.ts` / `bin/run.js` split is permanent.
- **Framework-agnostic codegen.** `framework` and `bundler` are DSL manifest fields; new framework support = new template variant (ADR-034).
- **Framework plugins, not hardcoded variants.** `build:dev`, `build:prod`, `build:docker`, `build:check`, `remote:init`, and `deploy` all resolve the framework via `loadFrameworkPlugin()` (ADR-036). Adding a new framework = publishing `@seans-mfe/framework-<name>`.
- **Open schema for framework/bundler.** `FrameworkSchema` and `BundlerSchema` are `z.string().min(1)` — not enums. Unknown values emit a stderr warning; they are not validation errors (ADR-036, #181).

## Backlog priority

1. ~~oclif Migration (A + B + C)~~ ✅
2. ~~Codegen + DSL pipeline~~ ✅
3. ~~GraphQL BFF layer~~ ✅
4. Runtime platform — REQ-RUNTIME-002 → 005 → 001 → 004 → … (issues #47–59) 🟡
5. BaseMFE boilerplate codegen from DSL — REQ-057 (issue #39, blocked on #49) 🟡
6. Lifecycle engine enhancements — ADR-028–032 (issues not yet created) 📋
7. npm publish `@seans-mfe/contracts` + `@seans-mfe/oclif-base` ⏳
8. Monorepo consolidation (docs/MERGE-PLAN.md Phase 2) ⏳

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

## Local-test runbook on the PR (standing practice for big changes)

When landing a significant or user-facing change, post a comment on the PR with a
copy-pasteable **local-test runbook** — as a matter of course, not only when asked:

- exact build commands, including any image/artifact rebuilds the change forces
  (e.g. `npm run build && npm run docker:build:cli` whenever `src/runtime/**`
  changed — `dist/runtime` is baked into the CLI image and staged into MFEs);
- how to run it end to end and drive the new behavior;
- what a correct result looks like, and the first place to look if it isn't.

Keep it accurate to the pushed SHA. This is the manual end-to-end check that
complements CI (the arbiter for the automated suites).

## Session-end checklist

Before opening the PR:

- [ ] Every acceptance criterion checked off in PR body with evidence (test name or command output)
- [ ] All verification gates green
- [ ] For significant/user-facing changes, a **local-test runbook comment** is posted on the PR (see above)
- [ ] PR body links the issue (`Closes #N`) and references governing ADRs
- [ ] New architectural decisions either cite an existing ADR or include a new ADR file in the PR
- [ ] No shared files touched unless the issue explicitly owns them (`package.json` oclif section, `pnpm-workspace.yaml`, `turbo.json`, `schemas/`)

For the current session's active issue and spec context: `@docs/session-prompt.md`

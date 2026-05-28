# DEVIN.md — seans-mfe-tool

Guidance for Devin sessions working on `seans-mfe-tool`.

## What this project is

**seans-mfe-tool** is a platform for delivering domain features as independently deployable units, in any framework, language, or federation pattern. The CLI generates, manages, and orchestrates domain-capability MFEs from a DSL manifest. The runtime platform (`@seans-mfe-tool/runtime`) provides a lifecycle contract that makes domain capabilities composable in a shell regardless of how they were built.

Federation (Module Federation, native ESM, iframe, web components) is one of several delivery mechanisms — not the purpose of the platform. The `framework` and `bundler` fields in the DSL manifest select the codegen template variant; adding a new framework means adding a new template variant, not changing the generator logic.

Full spec: `docs/spec.md`.

---

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Runtime (dev) | Bun — `bun bin/dev.ts <cmd>` |
| Runtime (published) | Node ≥18 — `bin/run.js` loading `dist/commands/` |
| CLI framework | oclif |
| Test runner | Jest |
| Validation | Zod |
| Codegen templates | EJS |
| Packages | `packages/contracts/`, `packages/oclif-base/`, `packages/runtime/` |

---

## CLI command surface

```
seans-mfe-tool remote:generate          # Generate/regenerate MFE source from DSL manifest
seans-mfe-tool remote:init              # Scaffold a new remote MFE project
seans-mfe-tool remote:init-angular      # Scaffold a new Angular remote MFE project
seans-mfe-tool bff:init                 # Scaffold a GraphQL BFF for an MFE
seans-mfe-tool deploy                   # Generate Docker/K8s deployment artifacts
seans-mfe-tool schemas                  # Generate JSON schemas from command types
seans-mfe-tool mcp:serve               # Start MCP server (tool registry)
```

---

## Architecture constraints — do not violate

- **BaseCommand**: Every oclif command extends `BaseCommand` from `packages/oclif-base/src/BaseCommand.ts`. Subclasses implement `runCommand()`, NOT `run()`.
- **Typed errors**: Never `throw new Error(...)`. Use typed errors from `@seans-mfe/contracts` — `ValidationError` (exit 64), `BusinessError` (65), `NetworkError` (66), `SystemError` (69), `TimeoutError` (124), `SecurityError` (77).
- **JSON envelope**: Under `--json`, stdout emits exactly ONE line: `{ ok: true; data: T }` or `{ ok: false; error: {...} }`. All other output goes to stderr.
- **MCP**: Child-process per tool call. Spawn `seans-mfe-tool <cmd> --json`, parse stdout envelope. Never persistent server with shared state.
- **Bun for dev, Node for published entry**: `bin/dev.ts` runs under Bun. `bin/run.js` is pure-Node.
- **No `any`**: TypeScript strict mode. No `console.log` in source.
- **schemas/ is generated only**: Regenerate via `npm run build:schemas`. Never hand-edit.

---

## ADR governance — non-negotiable

All architecture decisions live in `docs/architecture-decisions/`.

1. Before implementing anything that touches the platform contract, bundler integration, lifecycle, or BFF layer — check `docs/architecture-decisions/` for a matching ADR.
2. If a relevant ADR exists: reference it in your implementation and PR body (`ADR-NNN`).
3. **If no ADR exists for the decision at hand: stop and ask the human before implementing.** Do not invent architecture — a new ADR must be written or the human must explicitly waive it.
4. Do not edit existing ADRs; propose a new ADR file instead.

ADR index:

| ADR | Title | Area |
|-----|-------|------|
| ADR-001 | Lifecycle Re-Entrancy Guard in BaseMFE | Runtime lifecycle |
| ADR-024 | Platform Handler Library Standardization | Runtime handlers |
| ADR-025 | Platform Handler Interface & Execution Model | Runtime handlers |
| ADR-026 | Load Capability — Atomic Operation Design | Runtime lifecycle |
| ADR-027 | GraphQL Mesh v0.100.x with Production Plugins & Transforms | BFF layer |
| ADR-028 | Parallel Handler Execution with Context Isolation | Lifecycle engine |
| ADR-029 | Timeout Protection with AbortSignal | Lifecycle engine |
| ADR-030 | Error Classification with Hybrid Detection | Lifecycle engine |
| ADR-031 | Conditional Execution with Jexl Expression Engine | Lifecycle engine |
| ADR-032 | Inter-Hook Communication with TypeScript Code Generation | Lifecycle engine |
| ADR-033 | Two-headed giant — AI-native + human-legible developer experience | Developer model |
| ADR-034 | Pluggable bundler + framework via codegen variants | Codegen / polyglot |

---

## Where things live

| Concept | Path |
|---|---|
| Commands | `src/commands/<topic>/<cmd>.ts` (colon = nested dir) |
| `BaseCommand` | `packages/oclif-base/src/BaseCommand.ts` |
| Envelope types | `packages/contracts/src/envelope.ts` |
| Typed errors | `packages/contracts/src/errors/` |
| JSON schemas | `schemas/<topic>/<cmd>.json` (generated; never hand-edit) |
| MCP server | `src/commands/mcp/serve.ts`; registry `src/mcp/tool-registry.ts` |
| Codegen templates | `src/codegen/templates/<framework>/<bundler>/` |
| Runtime platform | `packages/runtime/src/` |

Files prefixed with `_` (e.g., `_shared.ts`) are skipped by oclif discovery — use for helpers.

---

## Current state (2026-05-24)

| Work stream | Status |
|---|---|
| oclif migration (epics A/B/C) | ✅ Complete |
| Runtime platform (REQ-RUNTIME-001–012) | 🟡 In progress |
| BaseMFE boilerplate codegen from DSL | 🟡 In progress |
| Lifecycle engine enhancements (ADR-028–067) | 📋 Planned |
| npm publish of `@seans-mfe/contracts` + `@seans-mfe/oclif-base` | ⏳ Pending |

---

## Dev commands

```bash
bun bin/dev.ts <cmd>     # Dev entry (no transpile)
npm run lint             # Before every commit
npm run typecheck        # Before every commit
npm test                 # After any src/**/* change
npm run test:ci          # If you touched src/runtime/ (80% coverage gate)
npm run build            # Before pushing
npm run build:schemas    # After changing command flags, args, or return types
```

---

## Verification gates before push

Run in order. Push only if all pass:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test` (or `npm run test:ci` if you touched `src/runtime/`)
4. `npm run build`
5. `npm run build:schemas && git diff --exit-code schemas/` (if you changed command interfaces)

---

## Branch and commit discipline

- Branch: `devin/issue-<num>-<short-slug>`
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Every commit body includes `Refs #<num>` (or `Closes #<num>` on the final commit)
- No `--no-verify`, no `--amend` on pushed commits, no `git push --force` to `main`

---

## When to stop and ask

Stop and surface the question rather than guessing:

- An acceptance criterion is ambiguous.
- A blocker issue is still open.
- Another open PR already touches the same file.
- You need to deviate from a locked decision.
- A required file or tool is missing.
- **A decision is needed and no existing ADR governs it** — stop and ask for an ADR before proceeding.

---

## Locked decisions — do not relitigate

- **Plugin-first, not merge-first.** Shared packages ship as oclif plugins depending on `@seans-mfe/contracts`. Monorepo merge is a later phase.
- **Namespace: `@seans-mfe/*`** for shared packages; `@falese/*` for third-party plugins.
- **MCP uses child-process per tool call.** Spawn `seans-mfe-tool <cmd> --json`, parse stdout envelope.
- **Bun for dev, Node for the published npm package.**

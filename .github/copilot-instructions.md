# GitHub Copilot Instructions

## What this project is

**seans-mfe-tool** is a platform for delivering domain features as independently deployable units, in any framework, language, or federation pattern. The CLI generates, manages, and orchestrates domain-capability MFEs from a DSL manifest. The runtime platform provides a lifecycle contract that makes domain capabilities composable in a shell regardless of how they were built.

Federation (Module Federation, native ESM, iframe, web components) is one of several delivery mechanisms — not the purpose of the platform.

Long-term goal: a community marketplace of domain-capability packages.

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

All commands accept `--json` for machine-readable `CommandResult<T>` output.  
All mutating commands accept `--dry-run`.

---

## BaseCommand pattern

Every oclif command extends `BaseCommand` from `packages/oclif-base/src/BaseCommand.ts`.

```typescript
// Subclasses implement runCommand(), NOT run()
protected abstract runCommand(): Promise<T>;
```

`BaseCommand.run()` owns:
- JSON envelope wrapping under `--json`
- Exit code mapping from typed errors
- stdout/stderr split (progress → stderr, result → stdout under `--json`)
- Rejection of interactive prompts when `--json` is active

**`CommandResult<T>` shape:**
```typescript
{ ok: true;  data: T }
{ ok: false; error: { code: string; message: string; exitCode: number } }
```

---

## Typed errors

Never `throw new Error(...)` in command code. Use typed errors from `@seans-mfe/contracts`:

| Error class | Exit code | When to use |
|---|---|---|
| `ValidationError` | 64 | Bad user input, missing flag, Zod failure |
| `BusinessError` | 65 | Rule violation (directory exists, missing --force) |
| `NetworkError` | 66 | Registry, HTTP, WebSocket failure |
| `SystemError` | 69 | FS read, missing binary, prompt under --json |
| `TimeoutError` | 124 | Operation exceeded time budget |
| `SecurityError` | 77 | Auth/permission failure |

---

## DSL manifest (`mfe-manifest.yaml`)

```yaml
name: my-feature
version: 1.0.0
type: remote
language: typescript
framework: react          # angular | react | vue | svelte | vanilla
bundler: rspack           # webpack | rspack | vite | esbuild

endpoint: http://localhost:3001
remoteEntry: http://localhost:3001/remoteEntry.js

capabilities:
  - MyCapability:
      type: domain
      description: What this capability does
  - Load:
      type: platform
      lifecycle:
        before:
          - onLoadBegin:
              handler: onLoadBegin
              description: Log load entry

dependencies:
  runtime:
    react: ^18.2.0
```

**Manifest fields `framework` and `bundler` select the codegen template variant.** Adding Vue support means adding a `vue/rspack` template variant — not changing the generator logic.

---

## Codegen flow

```
mfe-manifest.yaml
      │
      ▼
seans-mfe-tool remote:generate
      │
      ├─ Parse & validate manifest (Zod schema)
      ├─ Resolve codegen variant (framework + bundler)
      ├─ Select EJS templates from src/codegen/templates/<variant>/
      ├─ Render templates with manifest variables
      └─ Write generated files (skip if unchanged, --force to overwrite)
```

Templates live at `src/codegen/templates/`. Compiled templates are copied to `dist/codegen/templates/` by `scripts/copy-runtime-files.js` (tsc doesn't copy non-TS files).

---

## Runtime platform (`@seans-mfe-tool/runtime`)

**Package:** `packages/runtime/` → published as `@seans-mfe-tool/runtime`  
**Dist:** `dist/runtime/` (compiled, installable via `file:` in Docker)

### Class hierarchy

```
BaseMFE (abstract)
  └── RemoteMFE          — React/rspack MFEs
  └── AngularRemoteMFE   — Angular/webpack MFEs
```

### Platform lifecycle

| Capability | Description |
|---|---|
| `load()` | Initialize runtime: fetch remoteEntry.js, init Module Federation container |
| `render()` | Mount component into DOM container |
| `refresh()` | Reload data and re-render without unmounting |
| `authorizeAccess()` | Validate JWT and evaluate permissions |
| `health()` | Report liveness/readiness status |
| `describe()` | Return manifest metadata |
| `schema()` | Return JSON schema for capability inputs/outputs |
| `query()` | Execute a read-only domain query |
| `emit()` | Publish a domain event |
| `updateControlPlaneState()` | Push state update to orchestration layer |

### Import paths

```typescript
import { BaseMFE, RemoteMFE } from '@seans-mfe-tool/runtime';
import { AngularRemoteMFE } from '@seans-mfe-tool/runtime/angular';
```

---

## ADR governance

All architecture decisions live in `docs/architecture-decisions/`. **Before implementing anything that touches the platform contract, bundler integration, lifecycle, or BFF layer:**

1. Check `docs/architecture-decisions/` for a matching ADR.
2. If a relevant ADR exists: reference it in your implementation (`ADR-NNN`).
3. **If no ADR exists for the decision at hand: stop and ask the human before implementing.** Do not invent architecture — a new ADR must be written or the human must explicitly waive it.
4. Do not edit existing ADRs; add a new ADR file instead.

| ADR | Title | Area |
|-----|-------|------|
| ADR-022 | Lifecycle Re-Entrancy Guard in BaseMFE | Runtime lifecycle |
| ADR-058 | Platform Handler Library Standardization | Runtime handlers |
| ADR-059 | Platform Handler Interface & Execution Model | Runtime handlers |
| ADR-060 | Load Capability — Atomic Operation Design | Runtime lifecycle |
| ADR-062 | GraphQL Mesh v0.100.x with Production Plugins & Transforms | BFF layer |
| ADR-063 | Parallel Handler Execution with Context Isolation | Lifecycle engine |
| ADR-064 | Timeout Protection with AbortSignal | Lifecycle engine |
| ADR-065 | Error Classification with Hybrid Detection | Lifecycle engine |
| ADR-066 | Conditional Execution with Jexl Expression Engine | Lifecycle engine |
| ADR-067 | Inter-Hook Communication with TypeScript Code Generation | Lifecycle engine |
| ADR-068 | Two-headed giant — AI-native + human-legible developer experience | Developer model |
| ADR-069 | Pluggable bundler + framework via codegen variants | Codegen / polyglot |

---

## File layout

| Concept | Path |
|---|---|
| Commands | `src/commands/<topic>/<cmd>.ts` (colon = nested dir) |
| `BaseCommand` | `packages/oclif-base/src/BaseCommand.ts` |
| Envelope types | `packages/contracts/src/envelope.ts` |
| Typed errors | `packages/contracts/src/errors/` |
| Error classifier | `packages/contracts/src/error-classifier.ts` |
| JSON schemas | `schemas/<topic>/<cmd>.json` (generated; never hand-edit) |
| MCP server | `src/commands/mcp/serve.ts`; registry `src/mcp/tool-registry.ts` |
| Codegen templates | `src/codegen/templates/<framework>/<bundler>/` |
| Runtime platform | `packages/runtime/src/` |
| Hooks | `src/hooks/{init,prerun,postrun,command-not-found}.ts` |

Files prefixed with `_` (e.g., `_shared.ts`) are skipped by oclif discovery — use for helpers.

---

## Development rules

- TDD: write failing tests first, then implementation.
- No `any`, no `console.log` in source.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Run `npm run lint && npm run typecheck && npm test && npm run build` before push.
- `schemas/` is generated only — regenerate via `npm run build:schemas`, never hand-edit.

## Dev commands

| Command | When to run |
|---|---|
| `bun bin/dev.ts <cmd>` | Local dev entry (no transpile) |
| `npm run lint` | Before every commit |
| `npm run typecheck` | Before every commit |
| `npm test` | After any `src/**/*` change |
| `npm run test:ci` | If you touched `src/runtime/` (enforces 80% coverage) |
| `npm run build` | Before pushing |
| `npm run build:schemas` | After changing command flags, args, or return types |

---

## Definition of done

- [ ] All tests pass (`npm test`)
- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds
- [ ] PR body links the issue (`Closes #N`) and references governing ADRs
- [ ] New architectural decisions either cite an existing ADR or a new ADR file is included

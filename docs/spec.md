# seans-mfe-tool — Spec

> Last updated: 2026-05-24

---

## Context

**seans-mfe-tool** is a platform for delivering domain features as independently deployable units, in any framework, language, or federation pattern.

The key idea: a domain team defines _capabilities_ (e.g. `PlayGame`, `ShowCover`) in a DSL manifest. The CLI generates the full project scaffold — bundler config, runtime lifecycle wiring, BFF layer, Docker setup — targeting whatever framework and delivery mechanism the team uses. The generated code conforms to the **platform lifecycle contract** (`@seans-mfe-tool/runtime`), which makes domain capabilities composable in a shell regardless of how they were built.

Federation (Module Federation, native ESM, iframe, web components) is one of several delivery mechanisms, not the purpose of the platform.

Long-term goal: a community marketplace of domain-capability packages — domain expert teams publish adaptor packs; any shell operator can install and compose them.

---

## Hardware and runtime

| Constraint | Value |
|---|---|
| Node | ≥ 18 |
| Dev entry | `bun bin/dev.ts` (no transpile) |
| Published entry | `bin/run.js` (pure Node, loads `dist/commands/`) |
| CLI framework | oclif |
| Build output | `dist/` (TypeScript → CJS) |
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

## Codegen flow

```
mfe-manifest.yaml
      │
      ▼
seans-mfe-tool remote:generate
      │
      ├─ Parse & validate manifest (Zod schema)
      ├─ Resolve codegen variant (framework + bundler from manifest fields)
      ├─ Select EJS templates from src/codegen/templates/<variant>/
      ├─ Render templates with manifest variables
      └─ Write generated files (skip if unchanged, --force to overwrite)
```

**Manifest fields that drive variant selection:**
- `framework: angular | react | vue | svelte | vanilla`
- `bundler: webpack | rspack | vite | esbuild`
- `language: typescript | javascript` (default: `typescript`)

These fields are **not hardcoded** in templates — they are variables. Adding a new framework means adding a new template variant, not changing the generator logic.

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
discovery: http://localhost:3001/.well-known/mfe-manifest.yaml

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
        after:
          - onLoadComplete:
              handler: onLoadComplete
              description: Log load success
        error:
          - onLoadError:
              handler: onLoadError
              contained: true
              description: Log load failure

dependencies:
  runtime:
    react: ^18.2.0       # framework-specific runtime deps
```

---

## Domain capability delivery patterns

Domain capabilities are packaged as independently deployable units. The **platform lifecycle contract** is delivery-mechanism-agnostic — the shell doesn't care how a capability was built.

| Delivery mechanism | Generator variant | Shared deps pattern |
|---|---|---|
| rspack Module Federation | `react` | `shared: { react: { singleton: true } }` |
| webpack Module Federation | `angular` | `@angular-architects/module-federation` |
| Native ESM | (future) | no shared dep negotiation |
| iframe | (future) | postMessage contract |
| Web components | (future) | custom element registration |

**The manifest `framework` and `bundler` fields select the generator variant.** Adding Vue support means adding a `vue/rspack` template variant — not changing how the platform lifecycle works.

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

### Platform lifecycle (10 capabilities)

All are inherited by subclasses; domain teams implement `loadDomainComponent()` and their domain capability methods.

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

### Docker note

`dist/runtime/package.json` exports conditions must include `require`, `import`, and `default` so both webpack (Angular) and rspack (React) can resolve the package. See `scripts/copy-runtime-files.js`.

---

## BaseCommand + JSON envelope

All oclif commands extend `BaseCommand` from `@seans-mfe/oclif-base`.

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

Import from `@seans-mfe/contracts` (post-C1) or `src/runtime/errors/` (pre-C1).

| Error class | Exit code | When to use |
|---|---|---|
| `ValidationError` | 64 | Bad user input, missing flag, Zod failure |
| `BusinessError` | 65 | Rule violation (directory exists, missing --force) |
| `NetworkError` | 66 | Registry, HTTP, WebSocket failure |
| `SystemError` | 69 | FS read, missing binary, prompt under --json |
| `TimeoutError` | 124 | Operation exceeded time budget |
| `SecurityError` | 77 | Auth/permission failure |

Never `throw new Error(...)` in command code. Always use typed errors.

---

## Observability

All generation and training workflows emit structured JSON to stderr (or log file at `--log-level debug`).

```json
{ "ts": "...", "event": "generate_start", "command": "remote:generate", "manifest": "..." }
{ "ts": "...", "event": "generate_complete", "files_written": 8, "files_skipped": 22, "duration_ms": 430 }
```

---

## ADR index

All architecture decisions live in `docs/architecture-decisions/`. **Before implementing anything that touches the platform contract, bundler integration, lifecycle, or BFF layer — look here first.**

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
| ADR-070 | Docker build orchestration via Turborepo task graph | Docker / CI |

`docs/architecture-decisions/architecture-decisions.md` is the narrative index with rationale.

---

## Definition of done

**A feature is complete when:**

- [ ] All tests pass (`npm test`)
- [ ] `npm run typecheck` clean (tsc --noEmit)
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds (catches broken oclif manifest)
- [ ] Post-B5: `npm run build:schemas && git diff --exit-code schemas/`
- [ ] PR body links the issue (`Closes #N`) and references governing ADRs
- [ ] New architectural decisions either cite an existing ADR or include a new ADR file

---

## Out of scope (v1)

- Hosted marketplace registry (v1 uses git-based `--from-git`)
- Multi-capability composition within a single render context
- Hot-swap adaptor loading at runtime
- Vite / esbuild bundler variants (webpack + rspack only in v1)
- Vue, Svelte, vanilla framework variants (React + Angular only in v1)
- Windows / Linux support

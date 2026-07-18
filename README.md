# seans-mfe-tool

A platform for delivering **domain features as independently deployable units** —
in any framework, language, or federation pattern. The CLI generates and manages
domain-capability micro-frontends (MFEs); the runtime provides the lifecycle
contract that makes them composable in a shell, regardless of how they were built.

Federation (Module Federation, ESM, iframe, web components) is a *delivery
mechanism*, not the purpose of the platform. The platform contract is what stays
constant; the delivery mechanism is a template variant.

> **Full specification:** [`docs/spec.md`](./docs/spec.md) ·
> **Architecture decisions:** [`docs/architecture-decisions/`](./docs/architecture-decisions/) ·
> **Project memory:** [`CLAUDE.md`](./CLAUDE.md)

---

## How it fits together

```
                ┌───────────────────────────────────────────────┐
   author       │  mfe-manifest.yaml  (the DSL — single source   │
   writes  ───▶ │  of truth: capabilities, lifecycle, data)      │
                └───────────────────┬───────────────────────────┘
                                    │  seans-mfe-tool remote:generate
                                    ▼
                ┌───────────────────────────────────────────────┐
   CLI          │  UnifiedGenerator pipeline (ADR-043)           │
   generates    │  parse/validate → resolve framework+bundler    │
                │  variant → render EJS templates → write files  │
                └───────────────────┬───────────────────────────┘
                                    │  produces an MFE that extends…
                                    ▼
                ┌───────────────────────────────────────────────┐
   runtime      │  BaseMFE  (ADR-041) — abstract base class      │
   contract     │  10 platform capabilities + lifecycle state    │
                │  machine (ADR-042); subclasses only fill do*() │
                │    ├── RemoteMFE         (React / rspack)       │
                │    └── AngularRemoteMFE  (Angular / webpack)    │
                └───────────────────────────────────────────────┘
```

The **manifest** declares intent. The **generator** turns it into framework code.
The **runtime** gives every MFE the same lifecycle a shell can drive — no matter
which framework or bundler produced it.

---

## The platform contract — 10 capabilities

Every MFE extends `BaseMFE` and inherits exactly ten platform capabilities
(ADR-041). Each public capability is orchestrated by the base class (state
assertion → lifecycle hooks → state transition) and backed by one abstract
`do*()` method that the generated subclass implements.

| Capability | Backed by | What it does |
|---|---|---|
| `load()` | `doLoad()` | Initialize runtime — fetch `remoteEntry.js`, init the federation container |
| `render()` | `doRender()` | Mount the component into the DOM container |
| `refresh()` | `doRefresh()` | Reload data and re-render without unmounting |
| `authorizeAccess()` | `doAuthorizeAccess()` | Validate JWT, evaluate permissions |
| `health()` | `doHealth()` | Report liveness / readiness |
| `describe()` | `doDescribe()` | Return manifest metadata |
| `schema()` | `doSchema()` | Return the capability input/output schema |
| `query()` | `doQuery()` | Execute a read-only domain query |
| `emit()` | `doEmit()` | Publish a domain event / telemetry |
| `updateControlPlaneState()` | `doUpdateControlPlaneState()` | Push state to the orchestration layer |

**Lifecycle state machine** (ADR-042) — capabilities are only valid in the right
order; illegal transitions throw at the boundary:

```
uninitialized → loading → ready → rendering → ready
                   │         │        │
                   └──→ error ┘        └──→ error
                          │
ready / error ──────────→ destroyed   (terminal)
```

**Lifecycle phases** run around every `do*()` body (ADR-002):

```
before hooks → main (your do*() implementation) → after hooks → error hooks
```

Adding a framework means a **new template variant + thin subclass** — never a new
capability and never a change to the generator logic (ADR-034, ADR-036, ADR-043).

---

## Quick start

```bash
npm install
npm run build         # build packages, compile, generate oclif manifest + schemas

# Dev entry — Bun, no transpile, fastest feedback (ADR-020)
bun bin/dev.ts <cmd> [args]

# Compiled / installed entry
./bin/run.js <cmd> [args]
seans-mfe-tool <cmd> [args]      # when installed globally
```

All commands accept `--json` for a machine-readable `CommandResult<T>` envelope
(ADR-018), and all mutating commands accept `--dry-run`.

---

## CLI command surface

### Scaffold and generate MFEs

```bash
# Scaffold a new remote MFE project (manifest + project skeleton)
seans-mfe-tool remote:init <name> [--port 3001] [--framework react] [--force]

# Scaffold an Angular remote MFE
seans-mfe-tool remote:init-angular <name> [--port 3001]

# Generate / regenerate MFE source from the DSL manifest
seans-mfe-tool remote:generate [--dry-run] [--force]

# Generate a single capability
seans-mfe-tool remote:generate:capability <name> [--dry-run] [--force]
```

The generator reads `mfe-manifest.yaml`, resolves the framework/bundler template
variant via `loadFrameworkPlugin()`, and writes a project whose MFE class extends
`BaseMFE`. See [ADR-043](./docs/architecture-decisions/ADR-043-manifest-driven-codegen.md).

### Build (framework-agnostic, resolved via plugin — ADR-036)

```bash
seans-mfe-tool build:dev          # development build
seans-mfe-tool build:prod         # production build
seans-mfe-tool build:docker       # container image
seans-mfe-tool build:check        # validate build config
```

### GraphQL BFF layer (ADR-012, ADR-027)

```bash
seans-mfe-tool bff:init [name] [--port <port>] [--specs <files...>]
seans-mfe-tool bff:build    [--manifest <path>]
seans-mfe-tool bff:dev      [--manifest <path>]
seans-mfe-tool bff:validate [--manifest <path>]
```

### REST API from an OpenAPI spec

```bash
seans-mfe-tool api <name> [--spec openapi.yaml] [--database sqlite|mongodb] [--port 3001]
```

### Deploy / package

```bash
seans-mfe-tool deploy <name> --type <shell|remote|api> [options]
```

### Plugins (`@seans-mfe/*` core, `@falese/*` third-party — ADR-021, ADR-022)

```bash
seans-mfe-tool plugins install daemon            # shortname → @seans-mfe scope
seans-mfe-tool plugins install @falese/daemon-plugin
seans-mfe-tool plugins                           # list installed
seans-mfe-tool plugins uninstall daemon
```

Reserved topics (available once the plugin is installed):
`daemon:*` (`@falese/daemon-plugin`), `coder:*` (`@falese/coder-plugin`).

---

## The DSL manifest

The `mfe-manifest.yaml` is the single source of truth for a generated MFE.
`framework`, `bundler`, and `language` are *fields* that select the codegen
variant — they are never hardcoded in templates.

```yaml
name: my-feature
version: 1.0.0
type: remote
language: typescript
framework: react          # angular | react | vue | svelte | vanilla
bundler: rspack           # webpack | rspack | vite | esbuild

endpoint:    http://localhost:3001
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
              source: ../../handlers/load      # optional — ADR-040
        error:
          - onLoadError:
              handler: onLoadError
              contained: true

data:
  sources:
    - name: AnalysisAPI
      handler:
        openapi:
          source: ./specs/analysis-api.yaml
```

`framework` / `bundler` are open strings (ADR-036): unknown values warn on stderr
rather than failing validation, and fail loudly only at `loadFrameworkPlugin()`.

---

## Runtime package

The runtime ships as **`@seans-mfe-tool/runtime`** (`packages/runtime/`).

```typescript
import { BaseMFE, RemoteMFE } from '@seans-mfe-tool/runtime';
import { AngularRemoteMFE } from '@seans-mfe-tool/runtime/angular';
```

Class hierarchy is intentionally shallow (ADR-041):

```
BaseMFE (abstract)
  ├── RemoteMFE          — React / rspack Module Federation
  └── AngularRemoteMFE   — Angular / webpack Module Federation
```

Long-form capability reference: [`PLATFORM-CONTRACT.md`](./docs/PLATFORM-CONTRACT.md).

---

## MCP server — CLI as agent tools

`seans-mfe-tool mcp:serve` exposes every CLI command as a Model Context Protocol
tool so AI agents (Claude, Copilot, …) can invoke them. Each tool call spawns
`seans-mfe-tool <cmd> --json` as a child process, isolating `process.exit` and
cwd mutations (ADR-019).

Tools are discovered from three federated sources:

| Source | Prefix | How it works |
|--------|--------|--------------|
| Local | `mfe:` | Reads `schemas/*.json` bundled with the CLI |
| Plugins | topic (e.g. `daemon:`) | Reads installed oclif plugins that ship `schemas/` |
| Remote | server name | Spawns/connects to entries in `~/.config/seans-mfe/mcp.json` |

```json
// ~/.config/seans-mfe/mcp.json — proxy external MCP servers
{
  "servers": [
    { "name": "coder",  "command": "bunx", "args": ["@falese/coder-mcp"] },
    { "name": "daemon", "url": "http://daemon.local:8080/mcp" }
  ]
}
```

Each entry's `name` becomes the tool prefix (`coder:refactor`, `daemon:start`, …).
Name collisions across sources are a startup error.

---

## Examples

| Path | What it shows |
|---|---|
| [`examples/abc-kids/`](./examples/abc-kids/) | End-to-end platform demo: a generic shell composes 13 game MFEs plus a home/layout MFE through a containerized registry + daemon control plane. The fleet mixes React/rspack and Angular/webpack Module Federation; the home MFE provides the stable `abc-kids-home/main` and `abc-kids-home/info` slots. |
| [`examples/api-examples/`](./examples/api-examples/) | REST APIs generated from OpenAPI specs (`bizcase-api`, `petstore-api`) |

```bash
# Build the CLI image + every abc-kids MFE image (full chain, cached by Turborepo)
npx turbo run docker:build:examples
```

See the [ABC Kids quick start](./examples/abc-kids/README.md), the
[control-plane walkthrough](./examples/abc-kids/DAEMON-DEMO.md), and the
[slot contract](./docs/slot-contract.md).

---

## Extending the platform

- **New UI framework (Vue, Svelte, Solid, …):** publish
  `@seans-mfe/framework-<name>` extending `BaseFrameworkPlugin` and add a
  template variant. See the
  [Framework Plugin Authoring Guide](./docs/framework-plugin-authoring.md)
  (ADR-036) and `packages/framework-react/` / `packages/framework-angular/`.
- **New CLI capability (plugin):** see [PLUGIN-CONTRACT.md](./docs/PLUGIN-CONTRACT.md)
  and the `@falese/bff-plugin` package under `packages/bff-plugin/` as a worked
  example of an out-of-tree oclif plugin.
- **Roadmap toward a unified monorepo:** [MERGE-PLAN.md](./docs/MERGE-PLAN.md).

---

## Architecture & governance

Architectural decisions are recorded as ADRs. **Before any architectural
change, check [`docs/architecture-decisions/`](./docs/architecture-decisions/)**;
the canonical index lives in [`docs/spec.md#adr-index`](./docs/spec.md#adr-index).

Foundational decisions worth reading first:

| ADR | Decision |
|---|---|
| [ADR-041](./docs/architecture-decisions/ADR-041-base-mfe-abstract-base.md) | BaseMFE abstract base & the 10-capability platform contract |
| [ADR-042](./docs/architecture-decisions/ADR-042-mfe-lifecycle-state-machine.md) | MFE lifecycle state machine |
| [ADR-043](./docs/architecture-decisions/ADR-043-manifest-driven-codegen.md) | Manifest-driven code generation pipeline |
| [ADR-036](./docs/architecture-decisions/ADR-036-framework-plugins.md) | Framework plugin system |
| [ADR-066](./docs/architecture-decisions/ADR-066-stable-slot-addressing-desired-state-placement.md) / [067](./docs/architecture-decisions/ADR-067-manifest-declared-slot-contract.md) / [068](./docs/architecture-decisions/ADR-068-provider-scoped-slot-addresses.md) / [069](./docs/architecture-decisions/ADR-069-slot-grammar-single-source.md) | Stable, manifest-declared, provider-scoped slot contract |
| [ADR-016](./docs/architecture-decisions/ADR-016-base-command-pattern.md) / [ADR-018](./docs/architecture-decisions/ADR-018-command-result-envelope.md) | BaseCommand pattern & `CommandResult<T>` JSON envelope |

Product rationale ("why") lives in
[`docs/product-decisions/`](./docs/product-decisions/) (PDRs).

---

## Stack

- **Runtime:** Node ≥ 18 (published), Bun (dev entry, no transpile)
- **Language:** TypeScript (strict, no `any`)
- **CLI framework:** oclif (colon topics, plugin architecture)
- **Packages:** `packages/{contracts,oclif-base,runtime,framework-react,framework-angular,bff-plugin}`
- **Bundlers generated:** rspack (React), webpack / `@angular-builders` (Angular)
- **BFF:** GraphQL Mesh · **Validation:** Zod · **Tests:** Jest + Playwright

---

## Development

```bash
npm run lint            # ESLint
npm run typecheck       # tsc --noEmit
npm test                # Jest
npm run test:ci         # Jest + coverage (use if you touched runtime code)
npm run build           # full build — catches a broken oclif manifest
npm run build:schemas   # regenerate JSON schemas after changing command flags/types
npm run format          # Prettier
```

Verification gates run in order before any push:
`lint → typecheck → test → build → build:schemas` (see
[`CLAUDE.md`](./CLAUDE.md#verification-gates-before-push)). Commits follow
Conventional Commits with `Refs #N`; development is test-first (ADR-037).

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
>
> **New here?** Start with the [**system map**](https://falese.github.io/seans-mfe-tool/system-map.html)
> — an interactive explanation of why the platform exists, how it lets many teams
> build one product, and what happens to a single capability end to end.

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

Requires Node 20 or later. The CLI and the runtime are not on npm yet: today
you run them from a checkout of this repository (ADR-064 covers publishing).

All commands accept `--json` for a machine-readable `CommandResult<T>` envelope
(ADR-018). The commands that generate or scaffold (`remote:init`,
`remote:generate`, `bff:init`, `bff:build`, `api`, `compose:build`) accept
`--dry-run`; the table below marks them.

---

## CLI command surface

Every command, in one place. `seans-mfe-tool <command> --help` has the flags;
`seans-mfe-tool schemas` lists each command's input and output contract.

| Command | What it does | `--dry-run` |
|---|---|---|
| `remote:init <name>` | Scaffold a new MFE project and its manifest | yes |
| `remote:generate` | Generate an MFE's files from its manifest | yes |
| `remote:generate:capability <name>` | Generate one capability | yes |
| `mfe:validate [dir]` | Check an MFE is consistent with its manifest, and report code that needs a platform migration | — |
| `build:check` | Check the local toolchain for the MFE's framework | — |
| `build:dev` | Start the dev server | — |
| `build:prod` | Production build | — |
| `build:docker` | Write a Dockerfile; `--build` also builds the image | no |
| `bff:init`, `bff:build` | Scaffold and build the GraphQL BFF | yes |
| `bff:validate`, `bff:dev` | Validate the BFF config; run it with reload | — |
| `compose:build <project>` | Compile `control-plane.yaml` into the registry's `rules.json` | yes |
| `compose:validate <project>` | Validate the composition; `--check` fails on a stale `rules.json` | — |
| `slots:validate` | Check every placement targets a slot some MFE declares | — |
| `mcp:serve` | Serve the commands to AI agents as MCP tools | — |
| `schemas` | List the command contracts | — |
| `api <name>` | Generate an Express API from an OpenAPI spec | yes |
| `flow:status [dir]` | Where a directory stands in a multi-step flow, and the next command | — |
| `decompose:capture`, `analyze`, `propose`, `present`, `workspace`, `verify` | Propose and verify a split of a running monolith into MFEs (early; see [the runbook](./docs/decompose-runbook.md)) | no |
| `design:export <url>` | Export a running screen as a Figma import bundle (proof of concept) | no |
| `coder:compile <intent>` | Compile a described intent into a manifest through a model (proof of concept) | — |
| `adr:status`, `adr:validate`, `sentinel:validate` | This repository's own governance checks | — |

"no" marks a command that writes files and has no preview yet.


### Scaffold and generate MFEs

```bash
# Scaffold a new remote MFE project (manifest + project skeleton)
seans-mfe-tool remote:init <name> [--port 3001] [--framework react] [--force]

# Scaffold an Angular remote MFE (any framework: --framework <name>,
# with @seans-mfe/framework-<name> installed for third-party ones)
seans-mfe-tool remote:init <name> --framework angular [--port 3001]

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

### Deploying

There is no `deploy` command. `build:docker` writes a hardened Dockerfile for
the MFE and, with `--build`, builds the image; running it is yours. Deployment
targets will return as plugins (ADR-122).

### Plugins (`@seans-mfe/*` core, `@falese/*` third-party — ADR-021, ADR-022)

```bash
seans-mfe-tool plugins                           # list installed
seans-mfe-tool plugins install <package>         # a bare name resolves to the @seans-mfe scope
seans-mfe-tool plugins uninstall <package>
```

`coder:compile` ships with the CLI (`@seans-mfe/plugin-coder`). It is the seam
to a model; the model engine itself stays external (ADR-085).

> **The control plane is not a plugin.** The registry and daemon ship with the
> platform and this repository owns the canonical implementation (PDR-008,
> ADR-078); `@falese/daemon` is retired. It lives in
> [`packages/control-plane/`](./packages/control-plane/README.md) and both
> reference fleets build their images from it. The `daemon:*` topic is reserved
> for that in-platform control plane.

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
framework: react          # react and angular ship; any other name needs its framework plugin
bundler: rspack           # rspack (React) or webpack (Angular)

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

The runtime is **`@seans-mfe-tool/runtime`** (`packages/runtime/`). It is not
published to npm yet (ADR-064): a generated MFE resolves it from this
repository's `dist/runtime`, or from the CLI Docker image, which carries it.

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

`seans-mfe-tool mcp:serve` exposes the CLI's commands as Model Context Protocol
tools so AI agents (Claude, Copilot, …) can invoke them. Each tool call spawns
`seans-mfe-tool <cmd> --json` as a child process, isolating `process.exit` and
cwd mutations (ADR-019). Use the colon form: `mcp serve` with a space prints
the topic help and does not start the server.

```json
// Claude Desktop / any MCP client
{ "mcpServers": { "seans-mfe": { "command": "seans-mfe-tool", "args": ["mcp:serve"] } } }
```

Tools are discovered from two sources:

| Source | Prefix | How it works |
|--------|--------|--------------|
| Local | `mfe:` | Reads `schemas/*.json` bundled with the CLI |
| Plugins | topic (e.g. `daemon:`) | Reads installed oclif plugins that ship `schemas/` |

Name collisions across sources are a startup error.

A tool call is untrusted input — the caller is an agent acting on text it has
read — so the server checks it before anything runs (ADR-121):

- **Arguments are validated** against the tool's input schema. An argument the
  tool does not declare, a wrong type or a missing required one is refused.
- **`cwd` is confined** to the tree the server was started for: the directory
  it was launched in, or `--root <dir>`.
- **Three commands are off by default**: `build:dev`, `bff:dev` and
  `decompose:workspace` start a server and never return. Offer one with
  `--allow <command>` (repeatable).
- **A call that times out** (`--timeout-ms`, default 5 minutes) is stopped
  together with every process it started.

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

## The system map

[`docs/system-map.html`](./docs/system-map.html) is a single self-contained page that
explains the platform to three audiences at once, using progressive disclosure so each
one gets the depth it needs and no more:

| Audience | What it answers |
|---|---|
| **Executive / product** | What is this? Why does it exist? What value does it create? |
| **Product / architecture** | How does the platform deliver that value, what are its capabilities, and how does one feature move through it end to end? |
| **Engineering** | Where is each concept implemented? Toggle **Show technical implementation** to reveal repository paths throughout the page. |

It opens with the business problem — many teams changing one product — rather than with
the architecture, then works down through the six-step model (capability definition →
build system → platform standard → composition rules → runtime → customer experience), an
interactive **Follow one capability** walkthrough of two real capabilities in `examples/`, the
platform's capability map, the detailed architecture diagram, and finally what the
architecture *enables* and what it *trades off*. Claims are labelled `fact` or
`inference` so the evidence behind each one is checkable.

### Viewing it

**Published:** <https://falese.github.io/seans-mfe-tool/system-map.html>

**Locally** — the page is a single file with no external CSS, JavaScript, fonts or
images, so opening it directly works:

```bash
open docs/system-map.html          # macOS (xdg-open on Linux)
```

To exercise it exactly as GitHub Pages serves it, run a static server over `docs/`:

```bash
npx http-server docs -p 8080 -c-1   # then http://localhost:8080/system-map.html
```

How the site is assembled and deployed: [`docs/docs-site.md`](./docs/docs-site.md).

---

## Extending the platform

- **New UI framework (Vue, Svelte, Solid, …):** publish
  `@seans-mfe/framework-<name>` extending `BaseFrameworkPlugin` and add a
  template variant. See the
  [Framework Plugin Authoring Guide](./docs/framework-plugin-authoring.md)
  (ADR-036) and `packages/framework-react/` / `packages/framework-angular/`.
- **New CLI capability (plugin):** see [PLUGIN-CONTRACT.md](./docs/PLUGIN-CONTRACT.md)
  and the `@seans-mfe/plugin-bff` package under `packages/plugin-bff/` as a worked
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

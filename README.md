# MFE Platform Contract — Teaching Reference

A CLI tool and reference library demonstrating how **Micro-Frontend (MFE) base classes** can be implemented in any language from a single, language-neutral specification.

The key insight: **Module Federation is one implementation strategy.** The platform contract — 9 capabilities every MFE must expose — works identically whether your MFE is TypeScript, Python, Go, or Rust.

---

## The Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENDERER  (React / HTML)                     │
│  Displays MFE experiences · Sends user actions                  │
└──────┬──────────────────────────────────────────────┬──────────┘
       │ sendAction (state change)                     │ MFE's rendered output
       │ GraphQL / WebSocket                           │ relayed by daemon
       ▼                                               │
┌──────────────────────────────────────────────────────┤
│                DAEMON  (Node.js or Rust)             │
│  Receives state changes · Asks registry what to show │
│  Calls the resolved MFE · Relays output back up      │
└──────┬───────────────────────────────────────────────┘
       │ "which MFE should handle this state?"
       │ GraphQL / WebSocket
       ▼
┌──────────────────────────────────────────────────────┐
│                REGISTRY  (Node.js)                   │
│  Rules engine · Resolves state → MFE + capability    │
│  Returns: { mfe, capability, props }                 │
└──────────────────────────────────────────────────────┘
       ↑ daemon uses resolution to call the right MFE
┌──────────────────────────────────────────────────────┐
│              MFE IMPLEMENTATIONS  (any language)     │
│                                                      │
│  Owns its own experience — renders what it wants     │
│  doRender() → HTML / React component / rich data     │
│                                                      │
│  TypeScript/JS  ← this repo (reference + codegen)   │
│  Python         ← examples/polyglot-stubs/python/   │
│  Go             ← examples/polyglot-stubs/go/        │
│  Rust           ← examples/polyglot-stubs/rust/      │
└──────────────────────────────────────────────────────┘
```

The Registry resolves **what to show**. The MFE decides **how it looks**. The daemon routes between them. The daemon itself exists in Node.js and Rust variants — proof that the same protocol works across runtimes. This repo teaches the same lesson for MFE implementations.

---

## The Platform Contract  (10 Capabilities)

Every MFE — regardless of language — must implement these 10 capabilities:

| Capability | What it does | Who calls it |
|---|---|---|
| `describe()` | Return this MFE's manifest | Registry on registration |
| `load()` | Initialize runtime (DB, caches, config) | Daemon after registry resolves this MFE |
| `render()` | **Produce the MFE's own experience** (HTML / component / data) | Daemon after registry resolves which MFE + capability |
| `refresh()` | Reload data, same MFE stays selected | Daemon when state changes but MFE stays |
| `emit()` | Publish telemetry/metrics to observers | MFE itself — no registry reaction |
| `query()` | Execute a GraphQL query | Daemon or renderer requesting data |
| `schema()` | Expose GraphQL SDL for introspection | Registry schema registry |
| `authorizeAccess()` | Validate JWT, gate access | Daemon before calling `render()` |
| `health()` | Report dependency liveness | Registry liveness polling |
| `updateControlPlaneState()` | **Push domain state for registry re-evaluation** | MFE itself — after completing work that changes what should be shown |

**State machine** (all implementations share this):
```
uninitialized → loading → ready → rendering → error → destroyed
```

**Lifecycle phases** (per capability):
```
before hooks → main (your do_* implementation) → after hooks → error hooks
```

---

## Reading Order  (start here)

| Step | File | What you learn |
|------|------|----------------|
| 1 | `examples/dsl-mfe/mfe-manifest.yaml` | The language-neutral spec — defines capabilities, lifecycle hooks, data sources |
| 2 | `src/runtime/base-mfe.ts` | TypeScript abstract base class — 9 abstract `do*()` methods + lifecycle orchestration |
| 3 | `src/runtime/remote-mfe.ts` | Concrete TypeScript implementation using Module Federation |
| 4 | `examples/polyglot-stubs/python/base_mfe.py` | Same contract in Python (Flask) |
| 5 | `examples/polyglot-stubs/go/base_mfe.go` | Same contract in Go (net/http) |
| 6 | `examples/polyglot-stubs/rust/base_mfe.rs` | Same contract in Rust (Tokio + axum) |
| 7 | `PLATFORM-CONTRACT.md` | Full reference: capability table, daemon protocol mapping, language guide |

---

## How Code Generation Works

The `mfe-manifest.yaml` is both the spec and the code generation input:

```bash
# Generate a TypeScript MFE from a manifest
seans-mfe-tool remote:generate --manifest my-mfe-manifest.yaml

# Initialize a new MFE project (creates manifest + scaffold)
seans-mfe-tool remote:init my-mfe --port 3002
```

The generator reads the manifest and produces:
- `src/remote.tsx` — Module Federation entry point with lazy-loaded capabilities
- `src/features/{CapabilityName}/` — one folder per domain capability
- `src/platform/api.ts` — RTK Query hooks from `data.sources[]`
- `rspack.config.js` — Module Federation configuration
- `package.json` with correct shared dependencies

---

## The Manifest (Generic Specification)

The `mfe-manifest.yaml` is language-neutral. It declares:

```yaml
name: csv-analyzer
version: 1.0.0
type: tool
language: python          # javascript | typescript | python | go | rust | java

capabilities:
  - load:
      type: platform
      lifecycle:
        before:
          - validateConfig:
              handler: checkConfig   # language-neutral handler name
        main:
          - initializeRuntime:
              handler: setupRuntime

  - DataAnalysis:
      type: domain
      description: Analyze CSV files and generate statistical summaries

data:
  sources:
    - name: AnalysisAPI
      handler:
        openapi:
          source: ./specs/analysis-api.yaml
```

The code generator reads this and produces language-appropriate scaffolding. In TypeScript that means Module Federation. In Python that means Flask HTTP handlers. The contract is the same; only the implementation changes.

---

## CLI Commands

### Local development

```bash
# Bun entry — no transpile, fastest feedback loop
bun bin/dev.ts <cmd> [args]

# Node entry (uses compiled dist/)
npm run dev -- <cmd> [args]

# Installed globally
seans-mfe-tool <cmd> [args]
```

### Initialize a new MFE project

```bash
seans-mfe-tool remote:init <name> [options]

Options:
  --port <port>           Port number (default: 3001)
  --template <template>   Path to DSL template file
  --skip-install          Skip npm install
  --force                 Overwrite existing directory
```

### Generate code from a manifest

```bash
seans-mfe-tool remote:generate [options]

Options:
  --dry-run               Preview generated files without writing
  --force                 Overwrite existing files

# Generate a single capability
seans-mfe-tool remote:generate:capability <name> [--dry-run] [--force]
```

### Create a REST API from an OpenAPI spec

```bash
seans-mfe-tool api <name> [options]

Options:
  --spec <path>           OpenAPI specification file (default: openapi.yaml)
  --database <type>       mongodb or sqlite (default: sqlite)
  --port <port>           Port number (default: 3001)
```

### Build a Backend-for-Frontend (GraphQL Mesh)

```bash
seans-mfe-tool bff:init [name] [--port <port>] [--specs <files...>]
seans-mfe-tool bff:build [--manifest <path>]
seans-mfe-tool bff:dev   [--manifest <path>]
seans-mfe-tool bff:validate [--manifest <path>]
```

### Deploy / package

```bash
seans-mfe-tool deploy <name> --type <shell|remote|api> [options]
```

### Plugin install

Extend the CLI with community and first-party plugins scoped to `@seans-mfe`:

```bash
# Install a plugin (shortname — resolves via @seans-mfe scope)
seans-mfe-tool plugins install daemon

# Install by full package name
seans-mfe-tool plugins install @falese/daemon-plugin

# List installed plugins
seans-mfe-tool plugins

# Uninstall
seans-mfe-tool plugins uninstall daemon
```

Reserved topics (available once the plugin is installed):
- `daemon:*` — control-plane daemon commands (`@falese/daemon-plugin`)
- `coder:*` — AI-assisted coding commands (`@falese/coder-plugin`)

### Building a plugin

See [PLUGIN-CONTRACT.md](./PLUGIN-CONTRACT.md) for the full integration spec
and [`examples/plugin-skeleton/`](./examples/plugin-skeleton/) for a working
starter plugin you can clone and rename.

---

## Working Example

The `examples/dsl-mfe/` directory contains a complete, runnable TypeScript MFE with:
- Full `mfe-manifest.yaml` with all 9 platform capabilities
- GraphQL Mesh BFF (`data:` section → `.meshrc.yaml`)
- Module Federation with rspack
- React + Material-UI
- Docker Compose setup

```bash
cd examples/dsl-mfe
npm install
npm start
# → http://localhost:3002
```

---

## Development

```bash
npm install
npm run build       # Compile TypeScript
npm test            # Run tests
npm run typecheck   # Type-check without building
npm run lint        # ESLint
```

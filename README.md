# MFE Platform Contract — Teaching Reference

A CLI tool and reference library demonstrating how **Micro-Frontend (MFE) base classes** can be implemented in any language from a single, language-neutral specification.

The key insight: **Module Federation is one implementation strategy.** The platform contract — 9 capabilities every MFE must expose — works identically whether your MFE is TypeScript, Python, Go, or Rust.

---

## The Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENDERER  (React / HTML)                     │
│  Subscribes to Daemon · Sends user actions · Mounts components  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ GraphQL over WebSocket
                              │ (graphql-transport-ws)
┌─────────────────────────────▼───────────────────────────────────┐
│                DAEMON  (Node.js or Rust)                        │
│  Control plane · Routes actions · Broadcasts components         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ GraphQL over WebSocket
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                REGISTRY  (Node.js)                              │
│  Rules engine · Component store · Evaluates action → component  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP (9 capability endpoints)
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│              MFE IMPLEMENTATIONS  (any language)                │
│                                                                  │
│  TypeScript/JS  ← this repo (reference + code generator)        │
│  Python         ← examples/polyglot-stubs/python/               │
│  Go             ← examples/polyglot-stubs/go/                   │
│  Rust           ← examples/polyglot-stubs/rust/                 │
└─────────────────────────────────────────────────────────────────┘
```

The daemon exists in both Node.js and Rust variants — proof that the same protocol works across runtimes. This repo teaches the same lesson for MFE implementations.

---

## The Platform Contract  (9 Capabilities)

Every MFE — regardless of language — must implement these 9 capabilities:

| Capability | What it does | Daemon maps to |
|---|---|---|
| `describe()` | Return this MFE's manifest | Registry stores as component metadata |
| `load()` | Initialize runtime (DB, caches, config) | Registry `renderComponent()` mutation |
| `render()` | Return component payload (data or UI descriptor) | Daemon `COMPONENT_UPDATE` push to renderer |
| `refresh()` | Reload fresh data without full re-init | Registry `componentUpdate` subscription |
| `emit()` | Publish action/event upstream | Renderer `sendAction` → Daemon → Registry |
| `query()` | Execute a GraphQL query | Daemon `Query.state` |
| `schema()` | Expose GraphQL SDL for introspection | Registry schema registry |
| `authorizeAccess()` | Validate JWT, gate access | Registry rules engine |
| `health()` | Report dependency liveness | Registry health monitor |

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

### Initialize a new MFE project

```bash
seans-mfe-tool remote:init <name> [options]

Options:
  --port <port>           Port number (default: 3001)
  --template <template>   Project template
  --skip-install          Skip npm install
```

### Generate code from a manifest

```bash
seans-mfe-tool remote:generate <manifest-path> [options]

Options:
  --dry-run               Preview generated files without writing
  --force                 Overwrite existing files
  --capability <name>     Generate a specific capability only
```

### Create a REST API from an OpenAPI spec

```bash
seans-mfe-tool create-api <name> [options]

Options:
  --spec <path>           OpenAPI specification file
  --database <type>       mongodb or sqlite (default: sqlite)
  --port <port>           Port number (default: 3001)
```

### Build a Backend-for-Frontend (GraphQL Mesh)

```bash
seans-mfe-tool bff <name> [options]
```

### Deploy / package

```bash
seans-mfe-tool deploy <name> [options]
```

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

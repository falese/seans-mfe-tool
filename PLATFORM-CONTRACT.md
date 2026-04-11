# MFE Platform Contract  v3.2

This document is the definitive reference for building an MFE that integrates
with the daemon control plane. It explains what every MFE must implement,
how the daemon calls it, and how that maps to each supported language.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENDERER  (React / HTML)                     │
│  Displays MFE experiences · Sends user actions to daemon        │
└──────┬──────────────────────────────────────────────┬──────────┘
       │ sendAction (user interacts)                   │ rendered experience
       │ GraphQL / WebSocket                           │ returned by MFE
       ▼                                               │
┌──────────────────────────┐                           │
│   DAEMON  (Node.js/Rust) │                           │
│   Control plane          │                           │
│   Routes state changes   │◄──────────────────────────┘
└──────┬───────────────────┘
       │ "what should render for this state change?"
       │ GraphQL / WebSocket
       ▼
┌──────────────────────────┐
│   REGISTRY  (Node.js)    │
│   Rules engine           │
│   Resolves state →       │
│   { mfe, capability,     │
│     props }              │
└──────┬───────────────────┘
       │ resolution JSON: which MFE, which capability, what props
       ▼
┌──────────────────────────┐
│   DAEMON  (receives       │
│   resolution, calls MFE) │
└──────┬───────────────────┘
       │ POST /render (with props from registry resolution)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│              MFE  (any language)                                 │
│  Owns its experience · Renders what it wants · Returns output   │
│                                                                  │
│  doRender() → HTML fragment / React component / rich data       │
│               (the MFE decides — not the daemon, not the        │
│                renderer, not a fixed component type library)    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Daemon Message Protocol

All messages flowing over WebSocket subscriptions share this envelope:

```typescript
interface Message {
  direction: "COMPONENT" | "ACTION";
  kind: "COMPONENT_UPDATE" | "STATE_SNAPSHOT" | "ACTION_ECHO" | "ACTION_FORWARD";
  payload: RenderedExperience | ActionRecord;
  metadata: {
    correlationId: string;   // UUID, carried end-to-end
    acknowledged: boolean;
    error: string | null;
  };
}

// What an MFE render() returns — the MFE decides the shape
interface RenderedExperience {
  mfe: string;               // which MFE produced this
  capability: string;        // which domain capability was rendered
  output: unknown;           // MFE-owned: HTML string, component ref, data payload
  contentType: string;       // "text/html" | "application/json" | "module-federation"
}
```

**The daemon does not define component types.** It relays whatever the MFE's
`render()` returns to the Renderer. The Renderer knows how to display each MFE's
output because it loaded (or can load) the MFE's own presentation layer.

---

## The 9 Capabilities

### Full Reference Table

| Capability | HTTP method | Endpoint | Who calls it | Returns |
|---|---|---|---|---|
| `describe` | GET | `/describe` | Registry on MFE registration | MFE manifest + capabilities |
| `load` | POST | `/load` | Daemon after registry resolution selects this MFE | `{status: "loaded"}` |
| `render` | POST | `/render` | Daemon after registry resolves which MFE + capability to show | MFE's own experience (HTML / component / data) |
| `refresh` | POST | `/refresh` | Daemon when state changes but same MFE stays selected | void |
| `emit` | POST | `/emit` | MFE itself, or daemon forwarding an action from renderer | `{emitted, eventId}` |
| `query` | POST | `/query` | Daemon or renderer requesting data from this MFE | `{data, errors}` |
| `schema` | GET | `/schema` | Registry introspection | GraphQL SDL |
| `authorizeAccess` | POST | `/authorize` | Daemon before calling `render()` | `{authorized: bool}` |
| `health` | GET | `/health` | Registry liveness polling | `{status, checks}` |

---

## Data Flows

### Render Flow  (state change → registry resolution → MFE renders)

1. User interacts with the Renderer — an action (click, submit, etc.)
2. Renderer sends `sendAction` to Daemon with a `correlationId`
3. Daemon sends `ACTION_ECHO` back to Renderer (acknowledged)
4. Daemon forwards the state change to Registry via `handleMessage`
5. Registry evaluates rules: **which MFE should handle this state?**
6. Registry returns a resolution JSON to Daemon:
   ```json
   { "mfe": "csv-analyzer", "capability": "DataAnalysis", "props": { ... } }
   ```
7. Daemon calls `authorizeAccess()` on the resolved MFE (gate check)
8. Daemon calls `render()` on the resolved MFE with the props
9. **MFE produces its own experience** — HTML fragment, React component tree, rich data
10. Daemon relays the MFE's rendered output back to the Renderer
11. Renderer displays the MFE's experience

### Refresh Flow  (same MFE, new state)

When a state change arrives but the Registry resolves to the **same** MFE
that is already loaded, the Daemon calls `refresh()` instead of `render()` —
the MFE reloads its data and updates its presentation in place.

### Query Flow  (data fetch without render)

The Daemon or Renderer can call `query()` on an MFE directly to fetch data
without triggering a full render cycle. The MFE executes the GraphQL query
against its own schema and returns structured data.

---

## Capability Details

### `describe()` — Self-registration

The Registry calls this when an MFE registers. Return your full manifest so
the Registry can store it as component metadata.

```json
GET /describe
→ {
    "name": "csv-analyzer",
    "version": "1.0.0",
    "type": "tool",
    "capabilities": ["load", "render", "refresh", "authorizeAccess",
                     "health", "describe", "schema", "query", "emit"],
    "manifest": { ... }
  }
```

### `load()` — Initialization

Called when the Registry wants to activate your MFE. Connect to databases,
warm caches, validate config. Corresponds to Registry `renderComponent()` mutation.

```json
POST /load
Body: { "inputs": { "config": {} } }
→ { "status": "loaded", "timestamp": "..." }
```

### `render()` — MFE produces its own experience

The Daemon calls this after the Registry resolves that **this** MFE should
handle the current state. The MFE owns what it renders — there is no fixed
component type library. The output travels from the MFE back through the
Daemon to the Renderer.

```json
POST /render
Body: { "inputs": { "capability": "DataAnalysis", "props": { "fileId": "abc" } } }
→ {
    "status": "rendered",
    "element": {
      "contentType": "text/html",
      "output": "<section class='csv-analysis'>...</section>"
    }
  }
```

For TypeScript/Module Federation MFEs, `element` carries a component reference
the Renderer mounts dynamically. For server-side MFEs (Python, Go, Rust),
`element` carries an HTML fragment or structured data payload. The Renderer
handles both — it fetches the MFE's presentation layer on first load, then
renders subsequent `output` values using that layer.

### `refresh()` — Data reload

Called when the Registry `componentUpdate` subscription fires. Reload fresh
data without full re-initialization.

```json
POST /refresh
Body: { "inputs": { "full": false } }
→ { "refreshed": true }
```

### `authorizeAccess()` — JWT validation

The daemon forwards the renderer's JWT when calling this. Return whether
access is granted. The Registry rules engine uses this to gate component creation.

```json
POST /authorize
Headers: Authorization: Bearer <jwt>
Body: { "inputs": { "token": "<jwt>", "context": {} } }
→ { "authorized": true, "permissions": ["read", "analyze"] }
```

### `health()` — Liveness

The Registry polls this to monitor component health. Check all dependencies
and return their status.

```json
GET /health
→ {
    "status": "healthy",
    "checks": [
      { "name": "database", "status": "pass" },
      { "name": "disk", "status": "pass" }
    ]
  }
```

### `schema()` — GraphQL introspection

Return your GraphQL SDL. The Registry uses this to build a federated schema
across all registered MFEs.

```json
GET /schema
→ { "schema": "type Query { ... }", "format": "graphql" }
```

### `query()` — Data fetching

Execute a GraphQL query. Surfaced via Daemon `Query.state` when the renderer
or another service requests data from your MFE.

```json
POST /query
Body: { "inputs": { "query": "{ analysis(id: \"1\") { rowCount } }", "variables": {} } }
→ { "data": { "analysis": { "rowCount": 1000 } }, "errors": [] }
```

### `emit()` — Event publication

Publish a telemetry event, metric, or domain action. In the daemon flow this
triggers `sendAction` → `handleMessage` → rules engine evaluation.

```json
POST /emit
Body: { "inputs": { "eventType": "metric", "eventData": { ... }, "severity": "info" } }
→ { "emitted": true, "eventId": "uuid" }
```

---

## State Machine

All implementations must track and enforce these transitions:

```
uninitialized ──→ loading ──→ ready ──→ rendering ──→ ready
                     │           │           │
                     ▼           ▼           ▼
                   error ←──────────────── error
                     │
                     ▼
                 destroyed
```

| State | Description |
|---|---|
| `uninitialized` | MFE has been created but `load()` has not been called |
| `loading` | `load()` is in progress |
| `ready` | Loaded and available for `render()`, `query()`, etc. |
| `rendering` | `render()` is in progress |
| `error` | A capability failed; can retry `load()` or be destroyed |
| `destroyed` | Terminal state — no further transitions allowed |

---

## Lifecycle Phases

Each capability executes in four optional phases, defined in the manifest:

```yaml
capabilities:
  - load:
      type: platform
      lifecycle:
        before:      # Run before main logic — validation, pre-checks
          - validateConfig:
              handler: checkConfig
              contained: true   # failures are logged but don't abort
        main:        # The core logic — failures abort and jump to error phase
          - initializeRuntime:
              handler: setupRuntime
        after:       # Run after success — notifications, cleanup
          - emitReadyEvent:
              handler: notifyReady
        error:       # Run on failure — rollback, fallback
          - cleanup:
              handler: rollbackInit
              contained: true
```

**Phase semantics:**
- `before` / `after` / `error`: failures are logged, execution continues (OR-like)
- `main`: first failure stops execution and jumps to `error` phase (AND-like)
- `contained: true`: wraps handler in try/catch — errors are swallowed after logging

---

## Language Implementation Guide

### Method names by language

| Contract method | TypeScript | Python | Go | Rust |
|---|---|---|---|---|
| Orchestrator | `load(ctx)` | `load(ctx)` | `Load(ctx, mfeCtx)` | `load(&self, ctx)` |
| Implementation | `doLoad(ctx)` | `do_load(ctx)` | `DoLoad(ctx, mfeCtx)` | `do_load(&self, ctx)` |
| Orchestrator | `render(ctx)` | `render(ctx)` | `Render(ctx, mfeCtx)` | `render(&self, ctx)` |
| Implementation | `doRender(ctx)` | `do_render(ctx)` | `DoRender(ctx, mfeCtx)` | `do_render(&self, ctx)` |
| Orchestrator | `authorizeAccess(ctx)` | `authorize_access(ctx)` | `AuthorizeAccess(ctx, mfeCtx)` | `authorize_access(&self, ctx)` |
| Implementation | `doAuthorizeAccess(ctx)` | `do_authorize_access(ctx)` | `DoAuthorizeAccess(ctx, mfeCtx)` | `do_authorize_access(&self, ctx)` |

_(same pattern for refresh, health, describe, schema, query, emit)_

### TypeScript (reference)

```typescript
// Extend BaseMFE and implement the 9 abstract do*() methods:
export class MyMFE extends BaseMFE {
  protected async doLoad(ctx: Context): Promise<LoadResult> {
    // connect, warm, validate
    return { status: 'loaded', timestamp: new Date() };
  }
  // ... 8 more methods
}
```

File: `src/runtime/base-mfe.ts` (abstract) · `src/runtime/remote-mfe.ts` (Module Federation concrete)

### Python (Flask)

```python
class MyMFE(BaseMFE):
    async def do_load(self, ctx: Context) -> LoadResult:
        # connect, warm, validate
        return LoadResult(status="loaded")
    # ... 8 more methods
```

File: `examples/polyglot-stubs/python/base_mfe.py`

### Go (net/http)

```go
func (m *MyMFE) DoLoad(ctx context.Context, mfeCtx MFEContext) (LoadResult, error) {
    // connect, warm, validate
    return LoadResult{Status: "loaded"}, nil
}
// ... 8 more methods
```

File: `examples/polyglot-stubs/go/base_mfe.go`

### Rust (Tokio + axum)

```rust
async fn do_load(&self, _ctx: MfeContext) -> Result<LoadResult, String> {
    // connect, warm, validate
    Ok(LoadResult { status: "loaded".to_string(), container: None })
}
// ... 8 more methods
```

File: `examples/polyglot-stubs/rust/base_mfe.rs`

---

## The Manifest (Generic Specification)

The `mfe-manifest.yaml` is the single source of truth. The code generator reads
it to produce language-specific scaffolding:

```yaml
name: my-mfe
version: 1.0.0
type: tool
language: python          # javascript | typescript | python | go | rust | java

capabilities:
  - load:
      type: platform
      lifecycle:
        before:
          - validateConfig:
              handler: checkConfig    # language-neutral handler name
        main:
          - initializeRuntime:
              handler: setupRuntime

  - MyFeature:
      type: domain
      description: What this domain capability does

data:
  sources:
    - name: MyAPI
      handler:
        openapi:
          source: ./specs/my-api.yaml
          operationHeaders:
            Authorization: "Bearer {context.jwt}"
```

---

## What the Daemon Does NOT Do

The daemon is **not** a component store, not a template engine, and not a
fixed-component-type system. It does **not**:
- Define what components look like (no CARD/FORM/NOTIFICATION type library)
- Pre-render or store rendered output
- Own the presentation layer of any MFE

Instead, the daemon is a **state-change router and render orchestrator**:
1. Receives state changes from the Renderer (`sendAction`)
2. Asks the Registry: *"which MFE should handle this?"*
3. Gets back a resolution (which MFE, which capability, what props)
4. Calls that MFE's `render()` — the MFE decides what the experience looks like
5. Relays the MFE's output back to the Renderer

**The Renderer displays whatever the MFE produces.** The MFE owns its
presentation entirely.

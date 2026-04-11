# MFE Platform Contract  v3.2

This document is the definitive reference for building an MFE that integrates
with the daemon control plane. It explains what every MFE must implement,
how the daemon calls it, and how that maps to each supported language.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENDERER  (React / HTML)                     │
│  Subscribes to Daemon · Sends user actions · Mounts components  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ GraphQL over WebSocket
                              │ (graphql-transport-ws protocol)
┌─────────────────────────────▼───────────────────────────────────┐
│                DAEMON  (Node.js or Rust)                        │
│  Maintains component store · Routes actions · Broadcasts down   │
└──────────────┬──────────────────────────────┬───────────────────┘
               │ componentUpdate subscription  │ handleMessage mutation
               │ (receive new components)      │ (forward actions)
┌──────────────▼──────────────────────────────▼───────────────────┐
│                REGISTRY  (Node.js)                              │
│  Stores components · Evaluates rules · Publishes updates        │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP POST to each MFE capability
┌─────────────────────────────▼───────────────────────────────────┐
│              MFE  (any language)                                │
│  Implements 9 capabilities · Maintains state machine            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Daemon Message Protocol

All messages flowing over WebSocket subscriptions share this envelope:

```typescript
interface Message {
  direction: "COMPONENT" | "ACTION";
  kind: "COMPONENT_UPDATE" | "STATE_SNAPSHOT" | "ACTION_ECHO" | "ACTION_FORWARD";
  payload: Component | ActionRecord;
  metadata: {
    correlationId: string;   // UUID, carried end-to-end
    acknowledged: boolean;
    error: string | null;
  };
}
```

**Component types** the daemon knows about:
- `CARD` — displays a title, content, and action buttons
- `NOTIFICATION` — status message (SUCCESS | ERROR | WARNING | INFO)
- `FORM` — collectable input fields
- `ACTION_ECHO` — daemon acknowledgement of a received action
- `STATE_SNAPSHOT` — full state dump sent on connect or on request

---

## The 9 Capabilities

### Full Reference Table

| Capability | HTTP method | Endpoint | Daemon trigger | Returns |
|---|---|---|---|---|
| `describe` | GET | `/describe` | Registry stores on registration | MFE manifest + capabilities |
| `load` | POST | `/load` | Registry `renderComponent()` mutation | `{status: "loaded"}` |
| `render` | POST | `/render` | Daemon `COMPONENT_UPDATE` subscription push | Component payload |
| `refresh` | POST | `/refresh` | Registry `componentUpdate` subscription | void |
| `emit` | POST | `/emit` | Renderer `sendAction` → Daemon → Registry `handleMessage` | `{emitted, eventId}` |
| `query` | POST | `/query` | Daemon `Query.state` or Registry direct call | `{data, errors}` |
| `schema` | GET | `/schema` | Registry introspection query | GraphQL SDL |
| `authorizeAccess` | POST | `/authorize` | Registry rules engine gate | `{authorized: bool}` |
| `health` | GET | `/health` | Registry liveness polling | `{status, checks}` |

---

## Data Flows

### Component Flow  (down: Registry → Daemon → Renderer)

1. A component is created via `renderComponent()` on the Registry (or via `POST /render` on the MFE directly)
2. Registry stores the component, fires `componentUpdate` subscription event
3. Daemon (subscribed to Registry) receives event, stores in shared state
4. Daemon broadcasts `COMPONENT_UPDATE` message to all connected renderers
5. Renderer receives message, mounts/updates the component in UI

### Action Flow  (up: Renderer → Daemon → Registry → MFE)

1. User interacts with a component in the renderer
2. Renderer sends `sendAction` mutation to Daemon with `correlationId`
3. Daemon stores action, sends `ACTION_ECHO` back to renderer
4. Daemon forwards action to Registry via `handleMessage` mutation
5. Registry evaluates rules (component + action → new component?)
6. If a new component is produced, it travels down via the Component Flow

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

### `render()` — Component output

Return a component payload the daemon will broadcast to all renderers.
The payload should be one of the daemon component types (CARD, FORM, etc.)

```json
POST /render
Body: { "inputs": { "container": "...", "props": {} } }
→ { "status": "rendered", "element": { "type": "CARD", "data": { ... } } }
```

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

The daemon is **not** a traditional MFE loader. It does **not**:
- Call `load()` in a startup sequence
- Call `render()` directly on your server
- Manage MFE lifecycle itself

Instead, the daemon is a **reactive message router**:
1. It receives user actions from renderers (`sendAction` mutation)
2. It forwards them to the Registry (`handleMessage` mutation)
3. The Registry evaluates rules and produces components
4. The daemon broadcasts those components to all renderers (`componentUpdate` subscription)

Your MFE's `render()` capability returns the component *payload* that the daemon
broadcasts — not a DOM element, but a JSON descriptor the renderer uses to mount
the correct React/HTML component.

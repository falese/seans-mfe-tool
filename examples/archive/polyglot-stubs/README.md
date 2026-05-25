# Polyglot MFE Stubs

These stubs demonstrate that the **MFE platform contract** — 10 capabilities every MFE must implement — is independent of the programming language you choose.

Each directory contains a complete stub for the same `csv-analyzer` MFE, expressed idiomatically in a different language. The structure, state machine, and capability semantics are identical across all of them.

> **These are teaching stubs.** The method signatures and lifecycle wiring are correct; the business logic bodies are left as `TODO` for your implementation.

---

## Why multiple languages?

The daemon (control plane) communicates with MFEs via **GraphQL over WebSocket** using the `graphql-transport-ws` protocol. It doesn't care whether your MFE is written in TypeScript, Python, Go, or Rust — as long as your MFE:

1. Exposes HTTP endpoints for each capability
2. Returns the correct response shapes
3. Connects to the daemon's Registry via WebSocket for subscriptions

The TypeScript reference implementation uses Module Federation for browser-side MFEs. But Python, Go, and Rust MFEs are equally valid for server-side data MFEs, background services, and high-performance compute components.

---

## The 10 Capabilities

Every MFE — regardless of language — must implement these:

| Capability | What it does | Daemon protocol |
|---|---|---|
| `describe()` | Return this MFE's manifest | Registry stores as component metadata |
| `load()` | Initialize runtime (connect to DB, warm caches) | Registry `renderComponent()` mutation |
| `render()` | Return a component payload (data or UI descriptor) | Daemon `COMPONENT_UPDATE` push to renderer |
| `refresh()` | Reload fresh data without full re-init | Registry `componentUpdate` subscription |
| `emit()` | Publish telemetry/events (no registry reaction) | Renderer `sendAction` → Daemon → Registry `handleMessage` |
| `query()` | Execute a GraphQL query | Daemon `Query.state` |
| `schema()` | Expose GraphQL SDL for introspection | Registry schema registry |
| `authorizeAccess()` | Validate JWT, gate access | Registry rules engine |
| `health()` | Report dependency liveness | Registry component health monitor |
| `updateControlPlaneState()` | Push domain state → registry re-evaluates rules | `POST /state` → daemon `sendAction` mutation |

---

## Method Name Mapping (across languages)

| TypeScript (abstract) | Python | Go | Rust |
|---|---|---|---|
| `doLoad(ctx)` | `do_load(ctx)` | `DoLoad(ctx, mfeCtx)` | `do_load(&self, ctx)` |
| `doRender(ctx)` | `do_render(ctx)` | `DoRender(ctx, mfeCtx)` | `do_render(&self, ctx)` |
| `doRefresh(ctx)` | `do_refresh(ctx)` | `DoRefresh(ctx, mfeCtx)` | `do_refresh(&self, ctx)` |
| `doAuthorizeAccess(ctx)` | `do_authorize_access(ctx)` | `DoAuthorizeAccess(ctx, mfeCtx)` | `do_authorize_access(&self, ctx)` |
| `doHealth(ctx)` | `do_health(ctx)` | `DoHealth(ctx, mfeCtx)` | `do_health(&self, ctx)` |
| `doDescribe(ctx)` | `do_describe(ctx)` | `DoDescribe(ctx, mfeCtx)` | `do_describe(&self, ctx)` |
| `doSchema(ctx)` | `do_schema(ctx)` | `DoSchema(ctx, mfeCtx)` | `do_schema(&self, ctx)` |
| `doQuery(ctx)` | `do_query(ctx)` | `DoQuery(ctx, mfeCtx)` | `do_query(&self, ctx)` |
| `doEmit(ctx)` | `do_emit(ctx)` | `DoEmit(ctx, mfeCtx)` | `do_emit(&self, ctx)` |
| `doUpdateControlPlaneState(ctx)` | `do_update_control_plane_state(ctx)` | `DoUpdateControlPlaneState(ctx, mfeCtx)` | `do_update_control_plane_state(&self, ctx)` |

---

## Reading Order

To understand how the contract works, read in this order:

1. `../../src/runtime/base-mfe.ts` — TypeScript abstract base class (the reference)
2. `python/base_mfe.py` — same contract, Python idioms
3. `go/base_mfe.go` — same contract, Go idioms
4. `rust/base_mfe.rs` — same contract, Rust/Tokio idioms (mirrors daemon Rust variant)

For the full architecture and daemon protocol, see `../../PLATFORM-CONTRACT.md`.

---

## Running the Stubs

### Python (Flask)
```bash
cd python
pip install flask
python base_mfe.py
# → http://localhost:3002
```

### Go (net/http)
```bash
cd go
go mod init csv-analyzer && go mod tidy
# Add uuid: go get github.com/google/uuid
go run base_mfe.go
# → http://localhost:3003
```

### Rust (axum)
```bash
cd rust
# See Cargo.toml dependencies in base_mfe.rs comments
# Uncomment the axum server section at the bottom of base_mfe.rs
cargo run
# → http://localhost:3004
```

### TypeScript (reference)
See `../../src/runtime/base-mfe.ts` (abstract) and `../../src/runtime/remote-mfe.ts` (Module Federation concrete implementation).

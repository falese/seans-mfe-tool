# Runtime Class Hierarchy

This document explains the three-layer class hierarchy that every TypeScript/React
MFE is built on, why each layer exists, and what you are expected to implement
versus what you get for free.

---

## The three layers

```
BaseMFE  (abstract — src/runtime/base-mfe.ts)
  └── RemoteMFE  (concrete, Module Federation — src/runtime/remote-mfe.ts)
        └── YourMFE  (generated — src/platform/base-mfe/mfe.ts)
```

Each layer has a single, clear responsibility.

---

## Layer 1 — `BaseMFE` (abstract)

`BaseMFE` defines **what every MFE must be able to do**, regardless of language
or deployment model. It owns:

- **The 10-capability platform contract** — `load`, `render`, `refresh`,
  `authorizeAccess`, `health`, `describe`, `schema`, `query`, `emit`,
  `updateControlPlaneState`
- **The state machine** — enforces valid transitions:
  `uninitialized → loading → ready → rendering → error → destroyed`
- **Lifecycle orchestration** — drives the `before → main → after → error` hook
  phases for every capability invocation
- **Dependency injection** — accepts `BaseMFEDependencies` (custom telemetry,
  auth handlers, state validators, etc.)
- **Re-entrancy guards** — prevents concurrent calls to the same capability

`BaseMFE` implements **none** of the 10 capabilities itself. Every `doCapability()`
method is `protected abstract`, meaning subclasses must provide the implementation.
`BaseMFE` cannot be instantiated directly — it is a contract, not an implementation.

```typescript
// BaseMFE declares what must exist…
protected abstract doLoad(context: Context): Promise<LoadResult>;
protected abstract doRender(context: Context): Promise<RenderResult>;
protected abstract doUpdateControlPlaneState(context: Context): Promise<ControlPlaneStateResult>;
// …and so on for all 10 capabilities
```

This design means the same platform contract works for TypeScript, Python, Go,
and Rust — each language provides its own concrete base, all satisfying the
same 10-method surface.

---

## Layer 2 — `RemoteMFE` (concrete, Module Federation)

`RemoteMFE extends BaseMFE` and satisfies the abstract contract **specifically
for Module Federation remotes running in a browser via rspack**.

It provides real implementations of every `do*` method:

| Abstract method | What `RemoteMFE` does |
|---|---|
| `doLoad()` | 3-phase atomic load: fetch `remoteEntry.js` → initialize MF container → wire shared singletons (React, MUI) → emit telemetry at each checkpoint |
| `doRender()` | Select component by name from container, mount via React 18 `createRoot`, emit render telemetry |
| `doHealth()` | Check container is loaded and at least one component is available |
| `doDescribe()` | Return manifest name/version/type + capability inventory |
| `doSchema()` | Return manifest as JSON schema |
| `doRefresh()` | Stub (fetch fresh data + re-render) |
| `doAuthorizeAccess()` | Delegates to injected platform auth handler |
| `doQuery()` | Throws — queries go through the BFF, not the remote directly |
| `doEmit()` | Forward event to injected telemetry service |
| `doUpdateControlPlaneState()` | Send domain state to daemon via WebSocket `sendAction` mutation — daemon routes to Registry `handleMessage`, registry re-evaluates rules |

`RemoteMFE` also owns private Module Federation state:
- `container` — the live MF container reference
- `availableComponents` — component names extracted from the manifest
- `mountedComponent` — tracks the currently rendered component

If you were building a BFF-only MFE or a non-browser MFE, you would extend
`BaseMFE` directly with a different concrete base (e.g. `ServerMFE`,
`AgentMFE`). `RemoteMFE` is the Module Federation flavour.

---

## Layer 3 — Your generated MFE (domain)

The code generator produces a class that `extends RemoteMFE`. This is where
your business logic lives. You get everything from both parent layers for free
and only need to implement:

1. **Domain capabilities** — the features specific to your MFE
   (e.g. `DataAnalysis`, `ReportViewer`)
2. **Lifecycle hooks** — the custom handlers declared in your DSL manifest
   (e.g. `validateConfig`, `processData`, `handleError`)
3. **Optional overrides** — `doLoad()` and `doRender()` if you need to bolt
   domain logic onto the infrastructure (call `super()` first)

```typescript
export class csvanalyzerMFE extends RemoteMFE {

  // Optional — add domain logic after the MF infrastructure runs
  protected async doLoad(context: Context): Promise<LoadResult> {
    const result = await super.doLoad(context); // ← MF machinery runs here
    // seed domain state, validate domain config, etc.
    return result;
  }

  // Domain capability — your business logic
  async DataAnalysis(context: Context): Promise<DataAnalysisOutputs> {
    // parse CSV, run statistics, return report

    // When analysis is done, tell the control plane so the registry can
    // decide what to show next (e.g. a DataVisualization MFE):
    await this.updateControlPlaneState(context.clone({
      inputs: {
        stateKey: 'analysis.complete',
        stateData: { resultId, rowCount, quality },
        correlationId: context.requestId,
      }
    }));
  }

  // Lifecycle hook declared in mfe-manifest.yaml
  protected async validateConfig(context: Context): Promise<void> {
    // check that required env vars are set, schemas are valid, etc.
  }
}
```

You do **not** re-implement `load`, `render`, `health`, `describe`, or any of
the other platform capabilities. They are inherited and fully operational
the moment your class is instantiated.

---

## Why this split matters

### Separation of concerns

| Layer | Owns | Does not own |
|---|---|---|
| `BaseMFE` | Platform contract, state machine, lifecycle engine | How load/render works |
| `RemoteMFE` | Module Federation mechanics, React mounting | Domain features |
| `YourMFE` | Domain capabilities, lifecycle hooks | Infrastructure |

### Testability

Each layer can be tested independently. The root test suite
(`src/runtime/__tests__/`) covers `BaseMFE` and `RemoteMFE` exhaustively.
Generated tests in the example only need to verify domain capabilities and
hook existence — the infrastructure is already proven.

### Language portability

`BaseMFE` expresses the contract in TypeScript. The same contract is described
in `PLATFORM-CONTRACT.md` and implemented as stubs in
`examples/polyglot-stubs/` for Python (`base_mfe.py`), Go (`base_mfe.go`),
and Rust (`base_mfe.rs`). All four speak the same 10-capability API; only the
Module Federation machinery (Layer 2) is TypeScript-specific.

### Future flexibility

If rspack is replaced, or if Module Federation v2 changes the container API,
only `RemoteMFE` needs to change. Generated MFEs and `BaseMFE` are unaffected.

---

## Quick reference

```
Question                                              Answer
────────────────────────────────────────────────────  ─────────────────────────────────────────
Where is the state machine?                           BaseMFE
Where is the lifecycle hook engine?                   BaseMFE
Where does Module Federation loading happen?          RemoteMFE.doLoad()
Where does React mounting happen?                     RemoteMFE.doRender() → mountComponent()
Where do I put my business logic?                     YourMFE (generated class)
Where do I put my lifecycle handlers?                 YourMFE (generated class)
Can I skip calling super() in doLoad()?               No — the MF machinery lives there
Can I override health() directly?                     No — override doHealth() instead
When should I call updateControlPlaneState()?         When domain work completes and the
                                                      registry should decide what shows next
How is updateControlPlaneState() different from emit? emit() → observers (no registry reaction)
                                                      updateControlPlaneState() → registry rules
```

---

## Related files

| File | Purpose |
|---|---|
| `src/runtime/base-mfe.ts` | `BaseMFE` abstract class + all result types |
| `src/runtime/remote-mfe.ts` | `RemoteMFE` Module Federation implementation |
| `src/runtime/context.ts` | `Context` object passed through all phases |
| `src/runtime/handlers/` | Platform handler library (auth, caching, telemetry, etc.) |
| `src/runtime/index.ts` | Public exports for `@seans-mfe-tool/runtime` |
| `src/codegen/templates/base-mfe/mfe.ts.ejs` | Template that generates Layer 3 |
| `examples/dsl-mfe/src/platform/base-mfe/mfe.ts` | Generated Layer 3 example |
| `PLATFORM-CONTRACT.md` | Full capability reference (language-neutral) |
| `examples/polyglot-stubs/` | Python / Go / Rust equivalents of `RemoteMFE` |

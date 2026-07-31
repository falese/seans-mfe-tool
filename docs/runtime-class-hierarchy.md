# Runtime Class Hierarchy

This document explains the class hierarchy every TypeScript/React MFE is
built on, why each layer exists, and what you are expected to implement
versus what you get for free. It complements
[`docs/platform-design-review/base-mfe-architecture-and-demo.md`](./platform-design-review/base-mfe-architecture-and-demo.md),
which walks a real generated MFE through this hierarchy end to end.

---

## The layers

It's four, not three — the Module Federation lifecycle (framework-neutral)
and the React specifics are two separate classes, split so a future Angular
or Vue adapter reuses the first and replaces only the second:

```
BaseMFE          (abstract — packages/runtime/src/base-mfe.ts)
  └── BaseRemoteMFE  (abstract, Module Federation lifecycle, framework-neutral
       |               — packages/runtime/src/base-remote-mfe.ts)
       ├── RemoteMFE        (concrete, React — packages/runtime/src/remote-mfe.ts,
       |                     imported from '@seans-mfe-tool/runtime/react')
       └── AngularRemoteMFE (concrete, Angular — packages/runtime/src/angular-remote-mfe.ts,
                             imported from '@seans-mfe-tool/runtime/angular')
              └── YourMFE  (generated — src/platform/base-mfe/mfe.ts)
```

Each layer has a single, clear responsibility, and — this is the part a
3-layer summary loses — **only one layer is ever allowed to know about a UI
framework.** `BaseMFE` and `BaseRemoteMFE` must never import React or
Angular; `RemoteMFE`/`AngularRemoteMFE` are the only classes that do. This is
ADR-056's boundary, not an accident of file layout: a CI test
(`packages/runtime/src/__tests__/boundary.test.ts`) scans for it.

---

## Layer 1 — `BaseMFE` (abstract)

`BaseMFE` defines **what every MFE must be able to do**, regardless of
language or deployment model. It owns:

- **The 10-capability platform contract** — `load`, `render`, `refresh`,
  `authorizeAccess`, `health`, `describe`, `schema`, `query`, `emit`,
  `updateControlPlaneState`. The capability list itself, the manifest-key
  spellings, and the per-capability state-machine edges are single-sourced in
  `@seans-mfe/contracts` (ADR-080) — `BaseMFE` reads them, it doesn't declare
  them.
- **The state machine** — six states
  (`uninitialized`, `loading`, `ready`, `rendering`, `error`, `destroyed`)
  with a static transition table (`MFE_LIFECYCLE_TRANSITIONS`,
  `packages/contracts/src/platform-contract.ts:59`, re-exported as
  `VALID_TRANSITIONS` at `base-mfe.ts:207`). Not a single linear pipeline —
  `ready` and `error` both have a back-edge to `loading` (reload / retry):

  ```
  uninitialized → loading
  loading       → ready | error
  ready         → loading | rendering | destroyed
  rendering     → ready | error
  error         → loading | destroyed
  destroyed     → (terminal — no outgoing edges)
  ```

  Illegal transitions throw `Invalid state transition: <from> → <to>`.
- **The capability execution pipeline** (`executeCapability`,
  `base-mfe.ts:657-682`) — every one of the 10 public methods runs through
  the same middleware onion:
  `stateGuard(preStates) → stateTransition(enterState) → errorBoundary(lifecycle(before) → lifecycle(main) → doX() → lifecycle(after) → stateTransition(exitState))`.
  `preStates`/`enterState`/`exitState` per capability also come from
  `@seans-mfe/contracts` (ADR-080), not from per-method logic here.
- **Handler resolution** — `platform.*` lifecycle-hook names resolve through
  a static map over the platform handler library
  (`packages/runtime/src/handlers/`); `custom.*` names resolve through
  injected `deps.customHandlers` first, then fall back to a same-named method
  on the instance — which is why a lifecycle hook declared in your manifest
  shows up as a stub method on your generated class (see Layer 4).
- **Dependency injection** — `BaseMFEDependencies` (`telemetry`,
  `customHandlers`, `stateValidator`, `wsClient`, etc.), described below.
- **Re-entrancy guards** — a second call to the same capability while one is
  in flight is rejected, not queued.

`BaseMFE` implements **9 of its 10 `do*` methods as `protected abstract`** —
subclasses must supply them. The one exception is `doQuery`: `BaseMFE` ships
a real default that POSTs a GraphQL document to a resolved BFF URL
(`endpoint` + `data.serve.endpoint` from the manifest, or `deps.bffUrl`, or
`BFF_URL`) and returns `{ data: null }` — never throws — when the manifest
has no `data:` section at all (ADR-070's "uniform no-data contract": an MFE
without a BFF is a normal case, not an error state). `BaseMFE` cannot be
instantiated directly — the remaining 9 abstract methods mean it isn't a
concrete class.

```typescript
// BaseMFE declares what must exist…
protected abstract doLoad(context: Context): Promise<LoadResult>;
protected abstract doRender(context: Context): Promise<RenderResult>;
protected abstract doUpdateControlPlaneState(context: Context): Promise<ControlPlaneStateResult>;
// …and so on for 8 of the 10 capabilities. doQuery is the one with a real
// default implementation already on BaseMFE itself.
```

This design means the same platform contract can be reimplemented in Python,
Go, or Rust (ADR-041) — each language provides its own concrete base
satisfying the same capability surface; `docs/PLATFORM-CONTRACT.md` is the
language-neutral reference for that contract.

---

## Layer 2 — `BaseRemoteMFE` (abstract, Module Federation, framework-neutral)

`BaseRemoteMFE extends BaseMFE` and implements the parts of the contract
that are true of *any* Module Federation remote, independent of which UI
framework mounts it:

| Abstract method | What `BaseRemoteMFE` does |
|---|---|
| `doLoad()` | Real 3-phase atomic load — entry → mount → enable-render — resolving `remoteEntry` from the manifest, calling an injectable `fetchContainer()`, extracting available components/capabilities from the manifest, emitting a telemetry checkpoint at every subphase |
| `doRender()` | Validates `component`/`containerId`, resolves the component via `loadDomainComponent()` (overridable — throws by default), delegates the actual mount to the abstract `mountComponent()` |
| `doHealth()` | Checks the container loaded and at least one component is available |
| `doDescribe()` | Returns manifest name/version/type + capability inventory |
| `doSchema()` | Returns the manifest as a JSON schema |
| `doRefresh()` | Stub |
| `doAuthorizeAccess()` | Stub — returns `true` |
| `doEmit()` | Forwards the event to `deps.telemetry` if injected |
| `doUpdateControlPlaneState()` | Builds an `ActionRecord`/`Message` envelope and sends it to the daemon over `deps.wsClient` as a GraphQL `sendMessage` mutation — the daemon routes it to the registry, which re-evaluates placement rules |

It declares exactly **3 abstract members** — the quarantine boundary ADR-056
draws around framework knowledge: `getSharedDependencies()`,
`mountComponent(Component, props, containerId)`, `unmount(containerId)`.
Nothing else about "how do I put pixels on the screen" belongs here.

---

## Layer 3 — `RemoteMFE` (concrete, React)

`RemoteMFE extends BaseRemoteMFE`, imported from
**`@seans-mfe-tool/runtime/react`** — not the bare package. That subpath
split isn't stylistic: until it existed, the polyglot barrel
(`@seans-mfe-tool/runtime`) re-exported `RemoteMFE` directly, so any *value*
import from the barrel silently pulled React into the bundle. It stayed
invisible while every consumer used `import type` (erased at compile time)
until a template's first real value import broke three Angular MFEs with
`Can't resolve 'react-dom/client'`. The fix is the current invariant: the
barrel carries only the framework-neutral core; each framework-specific
class lives behind its own subpath, so importing a framework is always an
explicit choice, never a side effect. `AngularRemoteMFE` is the equivalent
concrete class behind `@seans-mfe-tool/runtime/angular`.

`RemoteMFE` supplies exactly the 3 abstract members Layer 2 left open:
`getSharedDependencies()` returns the Module Federation shared-scope
singletons (`react`, `react-dom`); `mountComponent()` does a React 18
`createRoot` mount wrapped in an error boundary (an MFE-provided
`./ErrorBoundary` federated export if one exists, else a default); `unmount()`
releases the root. That's the entire file — no further abstract surface, no
domain knowledge.

If you needed a BFF-only or non-browser MFE, you'd extend `BaseMFE` with a
different concrete base — Module Federation is one deployment flavor of the
platform contract, not the only one.

---

## Layer 4 — your generated MFE (domain)

The code generator produces a class that `extends RemoteMFE`
(`packages/codegen/templates/base-mfe/mfe.ts.ejs`; the Angular template
mirrors it against `AngularRemoteMFE`). This file is **generator-owned**
(`overwrite: true`) — every `remote:generate` re-stamps it from the manifest,
so a hand-edit here does not survive the next generation. What it gives you:

1. **Domain capability stub methods** — one `async <CapabilityName>(context)`
   per manifest-declared domain capability, returning `{} as OutputType` by
   default, marked `@generated Stub`.
2. **Lifecycle hook stub methods** — one `protected async <hookName>(context)`
   per manifest-declared hook, same stub convention.
3. **Optional `doLoad`/`doRender` overrides** — pre-stubbed to call
   `super.doLoad(context)`/`super.doRender(context)` first, then return the
   result unchanged; the comment tells you to add domain logic *after* the
   `super` call. These are the only two `do*` methods the template ever
   touches — the other 8 platform capabilities are inherited untouched.
4. **`loadDomainComponent(name)`** — a generated `switch` that dynamically
   imports the matching component under `src/features/<name>/` and hands it
   back to `BaseRemoteMFE.doRender()`.

```typescript
export class csvanalyzerMFE extends RemoteMFE {

  // Optional — add domain logic after the MF infrastructure runs
  protected async doLoad(context: Context): Promise<LoadResult> {
    const result = await super.doLoad(context); // ← MF machinery runs here
    // seed domain state, validate domain config, etc.
    return result;
  }

  // Domain capability stub — real implementations more often live in a
  // src/features/<Name>/<Name>.tsx component instead (see the architecture
  // doc's "composition, not inheritance" section) — this is where you may.
  async DataAnalysis(context: Context): Promise<DataAnalysisOutputs> {
    // ...
  }

  // Lifecycle hook declared in mfe-manifest.yaml
  protected async validateConfig(context: Context): Promise<void> {
    // check that required env vars are set, schemas are valid, etc.
  }
}
```

You do **not** re-implement `load`, `render`, `health`, `describe`, or any of
the other platform capabilities. They are inherited and fully operational
the moment your class is instantiated — which happens once, in the
generator-owned `bootstrap.ts`, exported as a module-level `mfe` singleton
that the rest of the MFE (developer-owned feature components, the
generator-owned `remote.tsx` presentation handle) consumes.

---

## Why this split matters

### Separation of concerns

| Layer | Owns | Does not own |
|---|---|---|
| `BaseMFE` | Platform contract, state machine, capability pipeline, lifecycle-hook engine | How load/render actually works, any UI framework |
| `BaseRemoteMFE` | Module Federation lifecycle (entry/mount/enable-render), telemetry checkpoints | Which UI framework mounts the component |
| `RemoteMFE` | React 18 mounting, MF shared-scope singletons, error boundary | Infrastructure, domain logic |
| `YourMFE` (generated) | Domain capability + lifecycle-hook stubs, presence in the manifest | Framework mechanics |

### Testability

Each layer is tested independently — `packages/runtime/src/__tests__/`
covers `BaseMFE` and `BaseRemoteMFE`/`RemoteMFE` exhaustively (including a
dedicated `boundary.test.ts` for the ADR-056 framework-quarantine rule).
Generated tests in an example MFE only need to verify domain capabilities
and hook existence — the infrastructure is already proven upstream.

### Language portability

`BaseMFE` expresses the contract in TypeScript; `docs/PLATFORM-CONTRACT.md`
is the same contract described language-neutrally. Only Layer 2/3
(Module Federation + React) are TypeScript/browser-specific.

### Future flexibility

If rspack is replaced, or Module Federation's container API changes, only
Layer 2/3 need to change. Generated MFEs and `BaseMFE` are unaffected. A new
UI framework needs a new Layer 3 concrete class, not a new copy of Layer 1/2.

### The other half of the platform: `BaseControlPlane`

`BaseControlPlane` (`packages/runtime/src/base-control-plane.ts`, ADR-059) is
a structurally similar pattern — abstract shape, concrete `doStart`/`doStop`
— but it's an entirely separate, **host-side** hierarchy: it's what the
*shell* extends to bundle a daemon, registry, and layout manager into one
unit. It is not part of the MFE-side chain above and an MFE author never
touches it directly.

---

## Quick reference

```
Question                                              Answer
────────────────────────────────────────────────────  ─────────────────────────────────────────
Where is the state machine?                           @seans-mfe/contracts (ADR-080), re-exported by BaseMFE
Where is the capability execution pipeline?            BaseMFE.executeCapability()
Where is the lifecycle hook engine?                    BaseMFE
Where does Module Federation loading happen?           BaseRemoteMFE.doLoad()
Where does React mounting happen?                      RemoteMFE.mountComponent()
Where do I put my business logic?                      YourMFE (generated class) or a
                                                        src/features/<Name>/ component it delegates to
Where do I put my lifecycle handlers?                  YourMFE (generated class)
Can I skip calling super() in doLoad()?                No — the MF machinery lives there
Can I override health() directly?                      No — override doHealth() instead
Can I edit mfe.ts by hand and keep the edit?            No — overwrite:true, re-stamped every
                                                        `remote:generate`. See the architecture doc.
What does query() do with no data: in the manifest?    Returns { data: null }, never throws (ADR-070)
When should I call updateControlPlaneState()?          When domain work completes and the
                                                        registry should decide what shows next
How is updateControlPlaneState() different from emit?  emit() → observers (no registry reaction)
                                                        updateControlPlaneState() → registry rules
```

---

## Related files

| File | Purpose |
|---|---|
| `packages/runtime/src/base-mfe.ts` | `BaseMFE` abstract class, capability pipeline, state machine re-export |
| `packages/runtime/src/base-remote-mfe.ts` | `BaseRemoteMFE` — framework-neutral Module Federation lifecycle |
| `packages/runtime/src/remote-mfe.ts` | `RemoteMFE` — React-specific concrete class (`@seans-mfe-tool/runtime/react`) |
| `packages/runtime/src/angular-remote-mfe.ts` | `AngularRemoteMFE` — Angular-specific concrete class (`@seans-mfe-tool/runtime/angular`) |
| `packages/runtime/src/context.ts` | `Context`/`TelemetryEvent` objects passed through all phases |
| `packages/runtime/src/handlers/` | Platform handler library (auth, caching, telemetry, etc.) |
| `packages/runtime/src/index.ts` | Public exports for `@seans-mfe-tool/runtime` (framework-neutral core only) |
| `packages/contracts/src/platform-contract.ts` | The 10 capabilities + state machine, single-sourced (ADR-080) |
| `packages/codegen/templates/base-mfe/mfe.ts.ejs` | Template that generates Layer 4 (React variant) |
| `packages/codegen/templates/base-mfe-angular/mfe.ts.ejs` | Template that generates Layer 4 (Angular variant) |
| `examples/meridian-station/meridian-console/src/platform/base-mfe/mfe.ts` | A real generated Layer 4 example |
| `docs/PLATFORM-CONTRACT.md` | Full capability reference (language-neutral) |
| `docs/architecture-decisions/ADR-056-mfe-presentation-boundary.md` | The framework-quarantine boundary this hierarchy enforces |
| `docs/platform-design-review/base-mfe-architecture-and-demo.md` | A real generated MFE walked through this hierarchy, live |

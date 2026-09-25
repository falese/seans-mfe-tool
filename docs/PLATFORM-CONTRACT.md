# The base class: the MFE platform contract

Every MFE on this platform, in every framework and language it can be built in,
is the same object underneath: a class with **ten platform capabilities**, a
**six-state lifecycle**, and a fixed set of **result shapes**. This document is
the reference for that class. It covers what each capability does, what you
write and what you inherit, and how the same contract appears in each build:
React, Angular, Swift, native Rust, and Rust compiled to WebAssembly.

The tables marked *generated* are produced by
`scripts/generate-platform-contract.ts` from the code that defines the
contract, and CI fails if they fall out of date. The prose around them is
written by hand.

- **Capability names, hooks and state rules** come from
  `packages/contracts/src/platform-contract.ts` (ADR-080: the contract is
  defined once, in code).
- **Result shapes** come from `packages/runtime/src/capability-results.ts`.
- **The rule that every build implements all ten** is ADR-102, enforced by
  `src/__tests__/every-target-implements-the-base-class.test.ts`.

The API reference has the full class pages: `BaseMFE`, `BaseRemoteMFE`,
`RemoteMFE` and `AngularRemoteMFE`, with every method and inherited member.

---

## The rule

1. **Every MFE has all ten capabilities.** A capability that has nothing to do
   still answers, in the documented shape. It never throws "not implemented".
2. **Every capability answers in the shape `capability-results.ts` defines**,
   whichever build produced it. A host reading a result cannot tell which
   language answered. The only exceptions are fields that exist because a DOM
   or a Module Federation container exists (`container`, `element`, and the
   atomic load's `telemetry` and `error`), which native builds omit.
3. **Every capability runs through the same pipeline** and moves the same
   lifecycle machine. You write the domain work; the platform owns the rest.

---

## How the class is layered

Each capability has two methods: a public **orchestrator** that the host calls,
and a protected **hook** that you override.

```
host calls  load(context)                        ← orchestrator, owned by the platform
              │
              ├─ state guard      is `load` legal in the current state?
              ├─ enter state      uninitialized → loading
              ├─ error boundary   a failure becomes a state, a telemetry event, a typed error
              ├─ before hooks     from the manifest's lifecycle.before
              ├─ main hooks       from the manifest's lifecycle.main
              ├─ doLoad(context)  ← the hook you override
              ├─ after hooks      from the manifest's lifecycle.after
              └─ exit state       loading → ready
```

The orchestrator order is the same in every build. In TypeScript it is
`executeCapability` in `packages/runtime/src/base-mfe.ts`, built on
`packages/runtime/src/capability-pipeline.ts`. Timeouts, retries and error
classification wrap the whole chain.

### Where each layer lives, per build

| Build | Orchestrators (ten capabilities) | Default hooks | What generated code extends |
|---|---|---|---|
| React | `BaseMFE` in `packages/runtime/src/base-mfe.ts` | `BaseRemoteMFE` in `packages/runtime/src/base-remote-mfe.ts` | `RemoteMFE` (`packages/runtime/src/remote-mfe.ts`) |
| Angular | `BaseMFE` | `BaseRemoteMFE` | `AngularRemoteMFE` (`packages/runtime/src/angular-remote-mfe.ts`) |
| Swift | `packages/framework-swift/templates/Sources/Platform/MFEBase.swift.ejs` | `packages/framework-swift/templates/Sources/Platform/NativeMFEBase.swift.ejs` | the generated `<Module>MFE` |
| Rust (native) | `packages/framework-rust/templates/src/platform/mfe_base.rs.ejs` | `packages/framework-rust/templates/src/platform/native_mfe_base.rs.ejs` | `MfeBase<…Native>` |
| Rust (WASM, in a browser) | the same crate as native Rust | the same crate | exposed by `packages/framework-rust/templates/web/src/platform/mod.rs.ejs` and the remote entry's `mfe` object (`packages/framework-rust/templates/web/www/remoteEntry.js.ejs`) |

The Swift and Rust files are templates: each MFE with `targets.swift` or
`targets.rust` gets its own generated copy (ADR-095, ADR-099), which it does
not edit.

### What you write and what you inherit

| Build | You write | You inherit |
|---|---|---|
| React | one component per capability, in `src/features/<Capability>/` | all ten capabilities. The generated class in `src/platform/base-mfe/mfe.ts` overrides `doLoad` and `doRender` and calls `super`; the generator owns that file and rewrites it on every run |
| Angular | one component per capability, in `src/features/<Capability>/` | the same, through a generated class that also overrides `doQuery` when the MFE has a data layer |
| Swift | the SwiftUI views per capability; the data provider when there is no BFF | all ten capabilities, implemented in `NativeMFEBase` |
| Rust (native) | the GraphQL document per capability (`src/features/<capability>_query.rs`) | all ten capabilities, implemented in `native_mfe_base.rs` |
| Rust (WASM) | one `render(element, props)` per capability (`rust/web/src/features/<capability>.rs`) | everything above, plus `fetch`, the shell's daemon channel and attachable telemetry |

The defaults, in every build:

- **`refresh` and `authorizeAccess`** succeed without doing work.
- **`health`** reports a status and the checks behind it. In TypeScript the
  check is whether the remote container loaded; natively it is the lifecycle
  state and the capability table.
- **`describe` and `schema`** return the manifest; `schema` returns it as JSON.
- **`emit`** forwards to the telemetry sink the host injected, and reports
  `emitted: false` when there is none.
- **`updateControlPlaneState`** sends a `STATE_UPDATE` envelope through the
  daemon channel the host injected, and reports `acknowledged: false` when there
  is none.

---

## The ten capabilities

*Generated from `PLATFORM_CAPABILITY_SPECS`.*

<!-- BEGIN GENERATED: capabilities -->
| Capability | Hook you override | Returns | Purpose |
|---|---|---|---|
| `describe` | `doDescribe` | `DescribeResult` | Self-description — name, version, type, capability names and the manifest. |
| `load` | `doLoad` | `LoadResult` | Initialization — connect, warm caches, validate config. |
| `render` | `doRender` | `RenderResult` | The MFE produces its own experience for a resolved capability. |
| `refresh` | `doRefresh` | `void` | Data reload in place when state changes but this MFE stays selected. |
| `emit` | `doEmit` | `EmitResult` | Telemetry publication. Does not trigger registry re-evaluation. |
| `query` | `doQuery` | `QueryResult` | Execute a GraphQL query against this MFE without rendering. |
| `schema` | `doSchema` | `SchemaResult` | Publishes the MFE's schema — by default its manifest, as JSON. |
| `authorizeAccess` | `doAuthorizeAccess` | `boolean` | Access check for the current caller. The default allows everyone; policy belongs to the product. |
| `health` | `doHealth` | `HealthResult` | Liveness — an overall status and the checks behind it. |
| `updateControlPlaneState` | `doUpdateControlPlaneState` | `ControlPlaneStateResult` | MFE-initiated push of domain state for registry re-evaluation. |

When each capability may run, and how it moves the lifecycle:

| Capability | Callable from | State change |
|---|---|---|
| `describe` | `uninitialized`, `loading`, `ready`, `rendering`, `error` | no change |
| `load` | `uninitialized`, `ready`, `error` | enters `loading`, `ready` on success, `error` on failure |
| `render` | `ready` | enters `rendering`, `ready` on success, `error` on failure |
| `refresh` | `ready` | no change |
| `emit` | any state | no change |
| `query` | `ready` | no change |
| `schema` | `ready` | no change |
| `authorizeAccess` | `ready` | no change |
| `health` | `uninitialized`, `loading`, `ready`, `rendering`, `error` | no change |
| `updateControlPlaneState` | `ready`, `rendering` | no change |
<!-- END GENERATED: capabilities -->

### emit versus updateControlPlaneState

Both send something out of the MFE. Only one of them changes what the user sees
next.

| | `emit` | `updateControlPlaneState` |
|---|---|---|
| Goes to | the telemetry sink the host injected | the daemon, then the registry |
| Purpose | metrics, logs, tracing | tell the control plane the MFE's state changed |
| Does the registry react? | no | yes: it re-evaluates its rules and may place a different capability |
| Use it when | "I observed something" | "My state changed; decide what comes next" |

Typical `updateControlPlaneState` moments: an analysis finished and a
visualization should appear, a form was submitted and a confirmation should
replace it, or a wizard step is done and the next step should load. The
inputs are `stateKey`, `stateData` and `correlationId`. With no connected
daemon channel the call answers `acknowledged: false`; it does not throw.

---

## The same capabilities in each language

*Generated.* Swift keeps the TypeScript names. Rust uses their `snake_case`
forms. The test that generates this table checks every Rust and Swift name
against the generated example crate and package.

<!-- BEGIN GENERATED: lanes -->
| TypeScript (React, Angular) | TypeScript hook | Swift | Rust (native and WASM) |
|---|---|---|---|
| `describe` | `doDescribe` | `describe` / `doDescribe` | `describe` / `do_describe` |
| `load` | `doLoad` | `load` / `doLoad` | `load` / `do_load` |
| `render` | `doRender` | `render` / `doRender` | `render` / `do_render` |
| `refresh` | `doRefresh` | `refresh` / `doRefresh` | `refresh` / `do_refresh` |
| `emit` | `doEmit` | `emit` / `doEmit` | `emit` / `do_emit` |
| `query` | `doQuery` | `query` / `doQuery` | `query` / `do_query` |
| `schema` | `doSchema` | `schema` / `doSchema` | `schema` / `do_schema` |
| `authorizeAccess` | `doAuthorizeAccess` | `authorizeAccess` / `doAuthorizeAccess` | `authorize_access` / `do_authorize_access` |
| `health` | `doHealth` | `health` / `doHealth` | `health` / `do_health` |
| `updateControlPlaneState` | `doUpdateControlPlaneState` | `updateControlPlaneState` / `doUpdateControlPlaneState` | `update_control_plane_state` / `do_update_control_plane_state` |
<!-- END GENERATED: lanes -->

---

## The lifecycle

*Generated from `MFE_LIFECYCLE_TRANSITIONS`.* A transition that is not in this
table is a programming error. The state guard rejects it before any hook runs
(ADR-042).

<!-- BEGIN GENERATED: lifecycle -->
| From | May move to |
|---|---|
| `uninitialized` | `loading` |
| `loading` | `ready`, `error` |
| `ready` | `loading`, `rendering`, `destroyed` |
| `rendering` | `ready`, `error` |
| `error` | `loading`, `destroyed` |
| `destroyed` | none (terminal) |
<!-- END GENERATED: lifecycle -->

| State | Meaning |
|---|---|
| `uninitialized` | Created; `load` has not run. |
| `loading` | `load` is in progress. |
| `ready` | Loaded and available: `render`, `query`, `refresh` and the rest may run. |
| `rendering` | `render` is in progress. |
| `error` | A capability failed. `load` may be retried, or the MFE destroyed. |
| `destroyed` | Terminal. Nothing leaves it. |

### Lifecycle hooks from the manifest

Each capability runs manifest-declared handlers in four phases:

```yaml
capabilities:
  - Load:
      type: platform
      lifecycle:
        before:
          - validateConfig:
              handler: checkConfig
              contained: true
        main:
          - initializeRuntime:
              handler: setupRuntime
        after:
          - emitReadyEvent:
              handler: notifyReady
        error:
          - cleanup:
              handler: rollbackInit
```

- **`main`**: the first failure aborts the capability and runs the `error`
  phase.
- **`before`, `after` and `error`**: a failure is logged as telemetry and the
  next handler still runs.
- **`contained: true`**: the handler's error is caught and logged, and never
  propagates.

Handlers named `platform.*` resolve against the runtime's handler library.
Other names resolve against methods on your MFE class (TypeScript) or
`MfeDependencies.custom_handlers` / `deps.customHandlers` (Rust and Swift,
ADR-098).

---

## What each capability returns

*Generated from `packages/runtime/src/capability-results.ts`.* Native builds
omit the DOM and Module Federation fields named in the rule above.

<!-- BEGIN GENERATED: results -->
#### describe → DescribeResult

| Field | Required | Type |
|---|---|---|
| `name` | yes | `string` |
| `version` | yes | `string` |
| `type` | yes | `string` |
| `capabilities` | yes | `string[]` |
| `manifest` | yes | `DSLManifest` |

#### load → LoadResult

| Field | Required | Type |
|---|---|---|
| `status` | yes | `'loaded' \| 'error'` |
| `container` | no | `unknown` |
| `mesh` | no | `unknown` |
| `worker` | no | `unknown` |
| `manifest` | no | `import('@seans-mfe/dsl').DSLManifest` |
| `availableComponents` | no | `string[]` |
| `capabilities` | no | `CapabilityMetadata[]` |
| `timestamp` | yes | `Date` |
| `duration` | no | `number` |
| `telemetry` | no | `{ entry: { start: Date; duration: number; }; mount: { start: Date; duration: number; }; enableRender: { start: Date; duration: number; }; }` |
| `error` | no | `{ message: string; phase: 'entry' \| 'mount' \| 'enable-render' \| 'before' \| 'after' \| 'error'; retryCount: number; retryable: boolean; }` |

#### render → RenderResult

| Field | Required | Type |
|---|---|---|
| `status` | yes | `'rendered' \| 'error'` |
| `element` | no | `unknown` |
| `timestamp` | yes | `Date` |

#### refresh

`refresh` returns nothing; success is the absence of a thrown error.

#### emit → EmitResult

| Field | Required | Type |
|---|---|---|
| `emitted` | yes | `boolean` |
| `eventId` | no | `string` |

#### query → QueryResult

| Field | Required | Type |
|---|---|---|
| `data` | yes | `unknown` |
| `errors` | no | `Array<{ message: string; path?: string[]; }>` |

#### schema → SchemaResult

| Field | Required | Type |
|---|---|---|
| `schema` | yes | `string` |
| `format` | yes | `'graphql' \| 'json' \| 'openapi'` |

#### authorizeAccess

`authorizeAccess` returns a boolean: `true` to allow, `false` to deny.

#### health → HealthResult

| Field | Required | Type |
|---|---|---|
| `status` | yes | `'healthy' \| 'degraded' \| 'unhealthy'` |
| `checks` | yes | `Array<{ name: string; status: 'pass' \| 'fail'; message?: string; }>` |
| `timestamp` | yes | `Date` |

#### updateControlPlaneState → ControlPlaneStateResult

| Field | Required | Type |
|---|---|---|
| `acknowledged` | yes | `boolean` |
| `correlationId` | yes | `string` |
| `error` | no | `string \| null` |
| `resolution` | no | `Resolution \| null` |
<!-- END GENERATED: results -->

---

## How a capability reaches a running MFE

The control plane never calls an MFE directly. In a browser:

1. A user action becomes a state key, sent to the daemon.
2. The registry matches the state key against the compiled composition rules
   (`control-plane/rules.json`, ADR-083) and resolves a placement: which MFE,
   which capability, which slot, what props.
3. The daemon pushes the placement to the shell over its GraphQL WebSocket.
4. The shell's layout manager loads the MFE's Module Federation container and
   hands it the slot's daemon channel through `mfe.attachControlPlane`
   (ADR-057). This is the channel `updateControlPlaneState` sends through.
5. The layout manager mounts through the MFE's imperative handle
   (`mount(element, { capability, props })`, ADR-056). Inside the MFE that
   runs `load` if needed, then `render`, through the pipeline above.

The code for steps 4 and 5 is `packages/runtime/src/layout-adaptors.ts`. A
native host (an iOS app, a Rust service) calls the orchestrators directly and
injects its own transport, daemon client and telemetry sink.

---

## Limits of the contract

- **`refresh` and `authorizeAccess` are thin in every build.** Both succeed
  without doing work by default. Authorization policy is left to the adopting
  product (see the system map's trade-offs).
- **The HTTP method and endpoint** in `PLATFORM_CAPABILITY_SPECS` describe how
  a capability *could* be served over HTTP. No server in this repository
  serves them, and no gate checks them (ADR-080).
- **Other languages.** Only the builds above exist. A new build is added as a
  framework plugin with a `targetId` (ADR-097) and joins the conformance suite
  in the same change (ADR-102).

## References

- ADR-041: `BaseMFE` as the abstract base of every MFE.
- ADR-042: the lifecycle state machine.
- ADR-054: the control-plane message protocol.
- ADR-056: the presentation boundary and the imperative mount handle.
- ADR-080: the contract is defined once, in `@seans-mfe/contracts`.
- ADR-098: native lifecycle hooks and `MfeDependencies`.
- ADR-101: the Rust build implements all ten capabilities.
- ADR-102: every build implements the base class.
- `docs/runtime-class-hierarchy.md`: the TypeScript class ladder in more depth.

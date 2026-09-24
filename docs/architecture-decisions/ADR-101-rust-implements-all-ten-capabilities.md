---
id: 0101
title: >-
  The Rust lane implements all ten capabilities against the runtime's result contract — emit and
  updateControlPlaneState included, natively and in the browser
status: Implemented
date: 2026-09-24
deciders: [sean]
area: Codegen / targets / native contract
enforcement: code
tags: [codegen, native, rust, wasm, capabilities, control-plane, telemetry, contracts]
relates-to: [42, 53, 57, 70, 96, 98, 99, 100]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/framework-rust/templates/src/platform/native_mfe_base.rs.ejs
  - packages/framework-rust/templates/src/platform/mfe_base.rs.ejs
  - packages/framework-rust/templates/src/platform/types.rs.ejs
  - packages/framework-rust/templates/web/src/platform/mod.rs.ejs
  - packages/framework-rust/templates/web/www/remoteEntry.js.ejs
verified-by:
  - packages/framework-rust/src/__tests__/rust-result-contract.test.ts
  - packages/framework-rust/src/__tests__/rust-contract-pin.test.ts
  - packages/framework-rust/templates/tests/lifecycle.rs.ejs
  - check:rust-build
  - check:rust-wasm
summary: >-
  Every capability `BaseRemoteMFE` implements, the Rust lane now implements too, returning the
  shapes in `packages/runtime/src/capability-results.ts` rather than the Swift lane's. `schema`
  returns the manifest as JSON; `emit` forwards to `deps.telemetry`; `updateControlPlaneState`
  validates its inputs, builds the `STATE_UPDATE` envelope and sends the daemon's `sendMessage`
  mutation through an injected `MfeControlPlaneClient`, the analogue of `deps.wsClient`. The browser
  build supplies `fetch`, the shell's per-slot daemon channel and a host telemetry function, and
  exposes all ten on the remote entry's `mfe` object. To make that possible, the crate's futures and
  injectable traits are `Send` natively and not on wasm32.
rationale-summary: >-
  ADR-099 carried over ADR-096's position that `emit` and `updateControlPlaneState` have no native
  transport and should fail. That was already untrue for Rust — `MfeDependencies` had a `telemetry`
  field — and a daemon client is one more injected seam, exactly as the web lane injects
  `deps.wsClient`. The same reasoning covered the result shapes: copying Swift's meant a host reading
  results from two lanes saw two contracts. The one change that is not a mirror of TypeScript is the
  wasm32 `Send` relaxation, and it is forced: every browser future holds a `JsValue`.
long-form: true
---

## Context

ADR-099 generated the ten capabilities, but three were not implemented in
the sense `BaseRemoteMFE` implements them. Its §Boundaries said so:

- `emit` and `updateControlPlaneState` threw `NotImplemented` — the Swift
  lane's position (ADR-096 §Boundaries: "no native transport").
- `schema` answered `sdl: None`.

And the results that did work had the Swift lane's shapes, not the runtime's.
`capability-results.ts` says `HealthResult` is `{ status, checks[], timestamp }`
and `ControlPlaneStateResult` is `{ acknowledged, correlationId, error,
resolution }`; the Rust crate answered `{ healthy, state }` and
`{ accepted, stateKey }`. ADR-100's browser build then inherited all of it,
plus its own gap: no data fetching, because the transport trait required
`Send` futures and browser futures are never `Send`.

The "no transport" reason did not survive contact with the Rust crate:
`MfeDependencies` already carried `telemetry`, so `emit` had somewhere to go.
And the control plane is reached in TypeScript through an *injected* client
(`deps.wsClient`), not a built-in one — a native lane can take the same seam.

## Decision

### 1. The results are the runtime's, field for field

Every result struct serializes to its `capability-results.ts` counterpart:
camelCase fields (`#[serde(rename_all = "camelCase")]`), lowercase enum values,
ISO-8601 timestamps (`Date.toJSON()`'s format). Only fields that exist because
a DOM or a Module Federation container exists are absent — `container`,
`element`, the atomic load's `telemetry` and `error` (ADR-026, ADR-096 §4).
`rust-result-contract.test.ts` reads the TypeScript file with the compiler
and compares it to the generated `types.rs`, honouring `#[serde(rename)]`.
It is not circular: neither file is rendered from the other.

Timestamps are `Option<String>`: `None` on `wasm32-unknown-unknown`, which has
no clock std can reach (ADR-100), rather than a fabricated time.

### 2. The ten, as `BaseRemoteMFE` implements them

| Capability | Rust |
|---|---|
| `load` | validates the capability table; `status: loaded`, components, capabilities, duration |
| `render` | validates the id, records the mount; `status: rendered` |
| `refresh` | no-op, as `BaseRemoteMFE.doRefresh` |
| `authorizeAccess` | `true`, as `BaseRemoteMFE`; a manifest `AuthorizeAccess` hook runs before it |
| `health` | checks `state`, `capability-table`, and — with a BFF — `transport`; unhealthy in `error`, degraded on any failed check |
| `describe` | name, version, `type`, capability names, and the manifest (embedded at generation) |
| `schema` | the manifest as pretty JSON, `format: json` |
| `query` | unchanged (ADR-053/070); errors are `{ message, path }` |
| `emit` | forwards `inputs.event` to `deps.telemetry`; `emitted: false` with no telemetry or no event |
| `updateControlPlaneState` | §3 |

### 3. `updateControlPlaneState` goes through an injected daemon client

`MfeDependencies.control_plane: Option<Arc<dyn MfeControlPlaneClient>>`, a
trait with the two members `BaseRemoteMFE` uses on `deps.wsClient`:
`connected()` and `mutation(query, variables, timeout_ms)`. The capability
follows `doUpdateControlPlaneState` step for step — validate
`stateKey`/`stateData`/`correlationId` (typed `MfeError::Validation`, the
contracts' `ValidationError`), answer `acknowledged: false` when there is no
connected client, build the ADR-057 `STATE_UPDATE` envelope in `buildMessage`'s
shape, send the same `sendMessage` mutation with the same 4 s timeout, report
a timeout as `sendMessage timed out`, and emit `control-plane-state-update`
telemetry.

### 4. The browser build supplies what a native host would inject

- **transport** — `fetch`, so `query` and the generated BFF provider reach
  the network (closing ADR-100's first boundary).
- **control_plane** — the shell's per-slot daemon channel. The shell's
  adaptor already calls `exports.mfe.attachControlPlane(channel)` (ADR-057);
  the remote entry now exposes an `mfe` object, holds the channel until the
  .wasm loads, and forwards it.
- **telemetry** — a host function via `mfe.attachTelemetry(fn)`. The telemetry
  trait gains `is_active()` so `emit` still answers `emitted: false` until one
  is attached, rather than reporting deliveries it drops.

The same `mfe` object exposes the ten capabilities by their contract names,
taking a TypeScript-shaped `Context`, so a host drives the Rust MFE exactly as
it drives a TypeScript one.

### 5. `Send` natively, not on wasm32

`BoxFuture` is `+ Send` natively and not on wasm32; injectable traits bound on
`MaybeSendSync` (`Send + Sync` natively, empty on wasm32). The browser is
single-threaded and every browser future holds a `JsValue`, so requiring
`Send` there made the browser build unable to reach the network at all. Native
code is unchanged: its futures still run on multi-threaded executors.

## Boundaries

- **`refresh` and `authorizeAccess` are as thin as TypeScript's.** Both lanes
  answer without doing work; making them do more is a contract decision for
  both lanes, not a Rust one.
- **`resolution` is never populated.** TypeScript does not populate it either;
  resolutions arrive on the daemon subscription.
- **The Swift lane still throws for `emit` and `updateControlPlaneState` and
  still returns its own result shapes.** This ADR is Rust's; carrying it to
  Swift is the same work with the same design, not done here.
- **Event ids are process-unique, not UUIDs.** No `uuid` dependency; the
  envelope's payload id is time plus a sequence number (sequence only on
  wasm32, which has no clock).

## Consequences

Better: a host — or the shell — cannot tell from any result which lane
answered, and the browser build is a complete MFE rather than a renderer. Both
properties are checked by something that runs: `cargo test` (32 generated
tests) and `check:rust-wasm`, which drives all ten in Chromium with the daemon
channel handed over by the shell's own adaptor, and fails when that hand-over
breaks.

Worse, and accepted:

- **A breaking change to the generated crate's API** (result types,
  `QueryResult.errors`, `StateTransition.at`). It lands before any release of
  the Rust target, and every changed file is generator-owned, so no
  developer-owned code needs a migration (ADR-082).
- **The manifest is embedded in every crate**, as TypeScript holds it in
  memory; a few KB of `&'static str`.
- **Two `cfg(target_arch = "wasm32")` shapes of the same traits**, which is
  the standard cost of one crate serving threaded and single-threaded hosts.

## References

- ADR-042 — the lifecycle states `health` reports on.
- ADR-053 — BFF endpoint resolution, unchanged for `query`.
- ADR-057 — the per-slot daemon channel the browser build bridges.
- ADR-070 — `query`'s uniform no-data answer, unchanged.
- ADR-096 — the native contract whose "no native transport" position this reverses for Rust.
- ADR-098 — manifest lifecycle hooks and the capability pipeline; `emit` and `updateControlPlaneState` run inside it.
- ADR-099 — the Rust target; its §Boundaries on `emit`/`updateControlPlaneState` no longer hold.
- ADR-100 — the browser build; its data-fetching boundary no longer holds.

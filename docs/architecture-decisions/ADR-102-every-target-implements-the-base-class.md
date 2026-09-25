---
id: 0102
title: >-
  Every build target implements all ten capabilities against the runtime's result contract — the
  Swift lane is brought level, and a conformance suite holds every lane to it
status: Implemented
date: 2026-09-24
deciders: [sean]
area: Targets / platform contract / conformance
enforcement: code
tags: [native, swift, rust, web, capabilities, contracts, conformance, control-plane, telemetry]
relates-to: [42, 57, 80, 95, 96, 98, 101]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/framework-swift/templates/Sources/Platform/NativeMFEBase.swift.ejs
  - packages/framework-swift/templates/Sources/Platform/MFEBase.swift.ejs
  - packages/framework-swift/templates/Sources/Platform/Types.swift.ejs
  - packages/framework-swift/templates/Gen/main.swift.ejs
  - packages/framework-swift/src/codegen.ts
  - src/__tests__/every-target-implements-the-base-class.test.ts
verified-by:
  - src/__tests__/every-target-implements-the-base-class.test.ts
  - packages/framework-swift/templates/Tests/LifecycleTests.swift.ejs
  - packages/framework-swift/src/__tests__/swift-contributor.test.ts
  - check:swift-build
summary: >-
  A rule, and the work to make it true: every build target — web (React, Angular), Swift, Rust, and
  any added later — implements all ten platform capabilities, answering in the shapes of
  `packages/runtime/src/capability-results.ts`. The web lanes already did (both inherit
  `BaseRemoteMFE`'s nine hooks); ADR-101 did it for Rust; this does it for Swift, with the same
  design: `schema` returns the manifest, `describe` carries `type` and the manifest, `health` reports
  checks, `emit` forwards to `deps.telemetry`, and `updateControlPlaneState` sends the `STATE_UPDATE`
  envelope through an injected `MFEControlPlaneClient`. `every-target-implements-the-base-class.test.ts`
  is the gate, for every lane at once.
rationale-summary: >-
  PDR-002 promises one language-neutral contract. Measured against the runtime, one lane met it
  fully, one had just been brought level (ADR-101), and one — Swift — threw for two capabilities and
  answered the other eight in shapes of its own. Per-lane fixes leave the next target free to repeat
  that, so the rule is stated once and checked across every lane by one suite, reading the contract
  from the runtime's own source with the TypeScript compiler so the comparison cannot be circular.
long-form: true
---

## Context

ADR-096 rendered the platform contract into Swift and recorded two
capabilities as boundaries: `emit` and `updateControlPlaneState` threw
`MFENotImplementedError`, because "there is no native transport". ADR-098
then gave `MFEDependencies` a `telemetry` member, which made the first half
of that reasoning untrue; the second half — no control-plane transport —
only ever meant nothing was injected, because the web lane's transport is an
injected `deps.wsClient` too.

The eight capabilities Swift did answer used result shapes of its own
(`{ healthy, state }`, `{ accepted }`, `{ sdl }`) rather than
`capability-results.ts`. ADR-101 found the same in the Rust lane, which had
copied Swift's, and fixed Rust. Swift was left as the one lane a host could
tell apart by its answers.

Auditing all four lanes for this ADR found the web lanes complete —
`BaseRemoteMFE` implements all nine abstract hooks, `doQuery` is concrete on
`BaseMFE`, and the React and Angular templates override only `doLoad`,
`doRender` and (Angular) `doQuery`, each delegating to `super`.

## Decision

### 1. The rule

**Every build target implements all ten platform capabilities, and answers in
the shapes of `capability-results.ts`.** Only fields that exist because a DOM
or a Module Federation container exists are exempt — `container`, `element`,
and the atomic load's `telemetry` and `error` (ADR-026, ADR-096 §4). A target
may answer `emitted: false` or `acknowledged: false` when its host injected no
telemetry or daemon client — as a web MFE with none does — but it may not
throw "not implemented" or invent a shape.

### 2. The gate

`src/__tests__/every-target-implements-the-base-class.test.ts`, for every lane:

- the web classes are concrete, and `BaseRemoteMFE` implements every abstract
  `do*` hook of `BaseMFE` (read with the TypeScript compiler);
- no native lane answers a capability with "not implemented";
- each native lane's result types carry the contract's field names —
  `capability-results.ts` read with the TypeScript compiler on one side, the
  generated `Types.swift` / `types.rs` on the other. Neither is rendered from
  the other, so the comparison is not circular.

A new target is added to this suite in the same change that adds the target.

### 3. Swift, brought level — the ADR-101 design, rendered in Swift

| Capability | Swift |
|---|---|
| `load` | `status: .loaded`, components, capabilities, ISO timestamp, duration |
| `render` | `status: .rendered`, capability id, timestamp |
| `refresh`, `authorizeAccess` | as `BaseRemoteMFE` — no-op, `true` |
| `health` | checks `state`, `capability-table`, and with a BFF its endpoint; unhealthy in `error`, degraded on a failed check |
| `describe` | name, version, `type`, capability names, the manifest |
| `schema` | the manifest as pretty JSON, `format: .json` |
| `query` | unchanged; errors are `QueryError { message, path }` |
| `emit` | forwards `inputs["event"]` to `deps.telemetry`; `emitted: false` without it |
| `updateControlPlaneState` | validates the inputs (`MFEValidationError`), answers `acknowledged: false` with no connected client, sends the ADR-057 `STATE_UPDATE` envelope through `deps.controlPlane` with the same `sendMessage` mutation and 4 s timeout, maps a timeout, emits telemetry |

`MFETelemetryEvent` becomes the runtime's `TelemetryEvent` shape, so hook
failures carry their hook, handler and error in `metadata` as `BaseMFE` puts
them. The results are `Codable` with property names equal to the contract's
field names, so they encode to the wire shape with no key mapping.

The manifest reaches `describe` and `schema` the way everything else reaches
the Swift lane (ADR-095, ADR-098 §5): the generator-owned `mfe-manifest.json`
projection gains `type` and the manifest's JSON, and the SPM build-tool plugin
renders them into `ManifestMetadata` at `swift build` time — base64-encoded in
the generated source, so no manifest content can end a string literal early.

## Boundaries

- **`refresh` and `authorizeAccess` are as thin as TypeScript's** in every
  lane. Making them do more is a contract change for all lanes at once.
- **Nothing ships an `MFEControlPlaneClient` or `MFETelemetry` conformer** for
  Swift. A host adapts its own graphql-ws client and collector; until it does,
  the capabilities answer `acknowledged: false` / `emitted: false`.
- **The SwiftUI views are still uncompiled on Linux.** Nothing here touches
  them, and the capabilities are all in the platform layer, which
  `check:swift-build` compiles and tests.

## Consequences

Better: PDR-002's claim is now checked rather than asserted. A host — or the
shell, or a registry reading `describe` — cannot tell from any capability's
answer which lane produced it, and a target added tomorrow fails the
conformance suite until it can say the same.

Found on the way, and fixed: a Swift package generated from a manifest with no
lifecycle hooks did not compile — `generatedHandlers` rendered as `[\n]`,
which Swift rejects as an empty *array* literal for a dictionary. Every fresh
`remote:init --swift` MFE has no hooks, and the one committed example has, so
`check:swift-build` never saw it. It now renders `[:]`, with a regression test.

Worse, and accepted:

- **A breaking change to the generated Swift package's API** — result types,
  `QueryResult.errors`, `MFETelemetryEvent`. Every changed file is
  generator-owned (`Platform/**`, `Gen/`, `Tests/`, `mfe-manifest.json`), so
  regeneration applies it; no developer-owned Swift file names these types, so
  no `PLATFORM_MIGRATIONS` entry is needed (ADR-082). A host that read the old
  result fields must update its reads.
- **The manifest is embedded in every package**, as TypeScript holds it in
  memory.

## References

- ADR-042 — the lifecycle states `health` reports on.
- ADR-057 — the virtualized daemon socket and per-slot control-plane channels `updateControlPlaneState` pushes state over.
- ADR-080 — the platform contract has one source; this checks every lane against it.
- ADR-095 — the manifest reaches the Swift build through the SPM plugin; the new fields ride the same path.
- ADR-096 — the native lifecycle contract whose `emit`/`updateControlPlaneState` boundary this closes.
- ADR-098 — native lifecycle hooks and `MFEDependencies`, which gains `controlPlane`.
- ADR-101 — the same work for the Rust lane; this applies its design to Swift and makes it a rule.

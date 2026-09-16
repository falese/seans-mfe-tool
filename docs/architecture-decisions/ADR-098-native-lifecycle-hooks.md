---
id: 0098
title: >-
  Manifest lifecycle hooks cross to the native lane, and the capability pipeline becomes composable
  middleware so they have somewhere to attach
status: Implemented
date: 2026-09-15
deciders: [sean]
area: Runtime / native / lifecycle hooks
enforcement: code
tags: [native, swift, runtime, lifecycle, hooks, middleware]
relates-to: [1, 2, 40, 76, 79, 96]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/framework-swift/templates/Sources/Platform/MFEBase.swift.ejs
  - packages/framework-swift/templates/Gen/main.swift.ejs
  - packages/framework-swift/src/codegen.ts
verified-by:
  - packages/framework-swift/src/__tests__/native-hooks.test.ts
  - packages/framework-swift/templates/Tests/LifecycleTests.swift.ejs
  - scripts/check-swift-build.sh
  - packages/framework-swift/src/__tests__/base-mfe-surface.test.ts
summary: >-
  `MFEBase.execute` inlined the guard, transition and error steps as a `do`/`catch`, which made the
  state machine correct and left manifest lifecycle hooks nowhere to attach. It is replaced by the
  same middleware pipeline `BaseMFE.executeCapability` composes, in the same order, and the hook
  engine ADR-002 specifies — handler arrays, `contained` containment, main-phase propagation,
  telemetry on every failure, and the ADR-001 re-entrancy guard — is rendered onto it. Handler
  RESOLUTION is where the lanes must differ: TypeScript finds a custom handler by dynamic method
  lookup on the subclass, which Swift cannot do, so the injected handler map is the mechanism
  rather than an override of one.
rationale-summary: >-
  Adding hooks without the middleware rework was not available. The inlined pipeline had no seam
  between the state transition and the capability body, so a `before` phase could only have been
  bolted on at a point that does not correspond to where the web lane runs it — which would have
  produced hooks that fire in a different order in the two lanes while both claimed ADR-002. The
  ordering IS the contract, so the structure that expresses the ordering had to come across too.
long-form: true
---

## Context

ADR-096 rendered the platform contract into Swift and recorded manifest
lifecycle hooks as a boundary: *"a web-lane feature that the native lane does
not yet carry."* That boundary was load-bearing in a way the ADR did not say.

`MFEBase.execute` looked like a faithful reduction of
`BaseMFE.executeCapability`:

```swift
try assertState(capability)
if let enter = capability.enterState { try transition(to: enter) }
do {
    let result = try await body()
    if let exit = capability.exitState { try transition(to: exit) }
    return result
} catch { /* error state */ }
```

Every *state machine* behaviour it produces is correct, which is why the pin
test and every example MFE were green. What it does not have is a **seam**.
`BaseMFE` composes eight middlewares and three of them are lifecycle phases;
the Swift version has a function call with nothing between the transition and
the body. There is no place a `before` hook goes.

So "add hooks to the native lane" was never a additive change. Bolting a phase
call into the inlined version would have put it at *some* point — but not
demonstrably the same point the web lane runs it, and the ordering is the
contract (ADR-002 fixes when each phase fires relative to the guard, the
transitions and the error boundary). Two lanes running hooks in different
orders while both citing ADR-002 is worse than one lane not running them.

## Decision

### 1. The capability pipeline is composed middleware, in TypeScript's order

`MFEBase` gains the `Middleware` type and a `runPipeline` that mirrors
`packages/runtime/src/capability-pipeline.ts`, and `execute` becomes the same
eight-element composition `executeCapability` builds:

```
stateGuard(preStates)
stateTransition(enterState)
errorBoundary(capability, errorState)
lifecyclePhase(capability, .before)
lifecyclePhase(capability, .main)
[assertCapabilityImplemented + the do* hook]
lifecyclePhase(capability, .after)
stateTransition(exitState)
```

The error boundary sits **after** the guard and the enter-transition, exactly as
in TypeScript and for the documented reason: an invalid-state or
invalid-transition error must propagate without running the capability's error
phase or error state.

This is rendered from the same `PLATFORM_CAPABILITY_SPECS` the rest of the
contract comes from, so per-capability pre-states and enter/exit/error states
stay single-sourced (ADR-080).

### 2. The hook engine is ADR-002's, rendered

`executeLifecycle` → `executeHookEntry` → `executeHook` → `invokeHandler`, with
the guarantees ADR-002 names, none of them re-decided here:

- **Handler arrays** run sequentially (REQ-045).
- **`contained: true`** swallows a handler's failure after reporting it
  (REQ-042).
- **Main-phase failures propagate**; before/after/error phases continue to the
  next handler (REQ-042, REQ-045).
- **Every failure reports**, through the injected telemetry (REQ-043).
- **The ADR-001 re-entrancy guard** is a stack keyed by capability+phase, and it
  **skips rather than throws** — the re-entrant call is the bug, the outer call
  is usually work a user is waiting on.

`invokeHandler` is the substitution seam, and it stays the only one. ADR-079
deleted `deps.lifecycleExecutor` because anything injected around the phase loop
skipped containment, propagation and telemetry silently. The native lane
therefore has no analogue of it, and the handler map is consulted *inside*
`executeHook`.

### 3. Handler resolution is where the two lanes legitimately differ

`BaseMFE.invokeCustomHandler` resolves a handler by **dynamic method lookup**:
`(this as Record<string, unknown>)[name]`, then `.call(this, context)`. Swift
has no equivalent for a plain class — there is no member lookup by string
without `@objc` and the Objective-C runtime, which is exactly the dependency
ADR-096 established the native lane does not take.

So in Swift the **handler map is the mechanism, not an override of one**:

| | TypeScript | Swift |
|---|---|---|
| `platform.x` | `deps.platformHandlers['x']`, else `PLATFORM_HANDLER_LIBRARY` | `deps.platformHandlers["x"]`, else throw |
| custom | `deps.customHandlers[name]`, then by last segment, then a method on the subclass | `deps.customHandlers[name]`, then by last segment, then throw |

The fallback that disappears in both rows is a *resolution* strategy, not a
guarantee: containment, propagation, telemetry and ordering are all upstream of
it in `executeHook` and cross intact. A subclass registers its handlers instead
of relying on the runtime finding its methods, which is more explicit and is
what Swift can actually enforce.

There is no native `PLATFORM_HANDLER_LIBRARY`. Rendering ~a dozen TypeScript
handler bodies into Swift is a separate scope with no manifest to drive it, so
`platform.*` resolves only from the injected map and otherwise throws a message
naming the handler and how to supply it.

### 4. `MFEDependencies` exists, and carries only what this lane consumes

`BaseMFEDependencies` has eight members. The native lane renders **four**:
`platformHandlers`, `customHandlers`, `telemetry`, `errorHandler`. The other
four are deliberately absent, per ADR-092 §5's rule that a contract declares
only what is consumed:

- `wsClient` — no native control-plane transport (ADR-096 §Boundaries).
- `bffUrl` — endpoint resolution is `inputs["bffUrl"]` → `BFF_URL` →
  `identity.bffEndpoint`, and the manifest composition already happened at
  generation time (ADR-053 as rendered in ADR-096 §7).
- `manifestParser` — the manifest is not parsed at runtime here; the SPM plugin
  renders it into `ManifestMetadata` at `swift build` time.
- `stateValidator` — the transition table is a frozen static (ADR-042/080), and
  `transition(to:)` already consults it.

`assertState` and `transition(to:)` now notify `deps.errorHandler` before
throwing, which they did not before — TypeScript's do, and a lane with no error
reporting at all was the larger gap.

### 5. The manifest's `lifecycle:` blocks reach Swift the way everything else does

`mfe-manifest.json` — the CLI's generator-owned projection — gains a
`lifecycle` array per capability, and `manifest-metadata-gen` renders it into
`ManifestMetadata.hooks` at `swift build` time. No new mechanism: this is
ADR-095's "the manifest is read by two build systems and neither holds a copy of
the truth", applied to one more field.

`findCapabilityConfig` is therefore a lookup in a static table rather than a
walk over a parsed manifest, which is why `deps.manifestParser` has no analogue.

## Boundaries

- **No native platform handler library.** `platform.*` needs an injected
  handler. The web lane's `PLATFORM_HANDLER_LIBRARY` is ~a dozen function
  bodies with no manifest driving them; porting them is its own scope.
- **A custom handler must be registered, not discovered.** Swift cannot look a
  method up by name, so a manifest naming `handler: onLoadBegin` requires
  `customHandlers["onLoadBegin"]` to be supplied. The thrown message says so
  with the exact key. This is the one place a manifest that works on the web
  needs a line of Swift to work natively, and `mfe:validate` does not check it —
  the handler map is runtime state, not a file on disk.
- **Telemetry is an injected protocol with no implementation.** `MFETelemetry`
  is declared and called on every hook failure; nothing ships a conformer.
  Hook failures are invisible unless a host supplies one, which is still an
  improvement on having nowhere to send them.
- **The two lanes spell a capability differently, and the lookup must not care.**
  `MFECapability.load.rawValue` is `"load"` — the platform contract's spelling —
  while a manifest writes `Load:` and the projection preserves it, because
  `describe` reports what the manifest declared. `BaseMFE.findCapabilityConfig`
  lowercases both sides; `findCapabilityHooks` does too. It did not at first,
  and the consequence is the one worth recording: **every manifest hook was
  inert** while 141 text assertions and a clean `swift build` both passed. A
  reviewer found it by writing a throwaway XCTest against the committed package
  and watching zero handlers run.

  That is also why the generated `LifecycleTests.swift` now *runs* the hooks
  rather than reading for them. The `swift` CI job executes it, so this class of
  defect — the engine rendered correctly and wired to nothing — fails a gate
  instead of a review.
- **The rendering tests are not a type check.** `native-hooks.test.ts` asserts
  the order of the pipeline and the presence of each guarantee; it cannot see a
  type error. This is the largest body of generated Swift logic yet added, which
  is what finally made the `swift` CI job worth building — `swift build` +
  `swift test` on Linux, covering every file this ADR touches, since none of
  them is behind `#if canImport(SwiftUI)`.

## Consequences

Better: the native lane runs the same hook engine the web lane does, in the same
order, from the same manifest. And the middleware rework removed the thing that
made the gap invisible — the pipeline is now eight named steps rather than a
`do`/`catch`, so the next person comparing the lanes is reading two lists.

Worse, and accepted knowingly:

- **The generated `MFEBase.swift` roughly tripled.** It is the single largest
  generated file in the Swift lane, and every MFE carries a copy. That is
  inherent to rendering a base class per package rather than shipping a runtime
  dependency, which ADR-096 already chose; this makes the cost visible.
- **Two resolution paths diverge from TypeScript** (§3). The guarantees do not,
  but a developer moving a manifest from web to native will hit the registration
  requirement and it is not caught at design time.
- **`deps.errorHandler` now fires on state errors in the native lane and not in
  the tests' expectations of the old behaviour.** Nothing depended on the
  silence, but it is a behaviour change to a file marked generator-owned, which
  regeneration applies without asking (ADR-082) — correctly, since no
  developer-owned file changes shape.

## References

- ADR-001 — the re-entrancy guard on lifecycle execution; rendered here as the capability+phase stack that skips rather than throws.
- ADR-002 — the before/main/after/error hook model with containment, mandatory handlers and main-phase propagation; this renders that engine, it does not re-decide it.
- ADR-040 — lifecycle hook handler sources in the DSL manifest, which is what `ManifestMetadata.hooks` projects.
- ADR-076 — platform handlers as plain exported functions resolved by name; the native lane keeps the flat-map shape and has no library behind it.
- ADR-079 — `invokeHandler` is the only substitution seam, because a seam around the phase loop bypasses every guarantee; the native lane inherits that constraint.
- ADR-096 — the native lifecycle contract, which recorded hooks as a boundary and is what this closes.

---
id: 0096
title: >-
  The Swift MFE is a third concrete subclass of the platform base class — the contract crosses to
  native intact, the federation machinery does not
status: Implemented
date: 2026-09-15
deciders: [sean]
area: Runtime / native / platform contract
enforcement: code
tags: [native, swift, runtime, platform-contract, codegen]
relates-to: [12, 34, 36, 40, 41, 42, 53, 70, 80, 95, 97, 98]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/framework-swift/src/codegen.ts
  - packages/framework-swift/templates/Sources/Platform/MFELifecycle.swift.ejs
  - packages/framework-swift/templates/Sources/Platform/MFEBase.swift.ejs
  - packages/framework-swift/templates/Sources/Platform/NativeMFEBase.swift.ejs
  - packages/framework-swift/templates/Sources/Platform/GeneratedMFE.swift.ejs
  - packages/framework-swift/templates/Sources/Platform/BFFClient.swift.ejs
  - packages/framework-swift/templates/Sources/Platform/BFFDataProvider.swift.ejs
  - packages/codegen/src/validate.ts
verified-by:
  - packages/framework-swift/src/__tests__/native-contract-pin.test.ts
  - packages/framework-swift/src/__tests__/swift-contributor.test.ts
  - packages/framework-swift/src/__tests__/base-mfe-surface.test.ts
summary: >-
  The generated `<Module>MFE` sits beside `RemoteMFE` and `AngularRemoteMFE` as a third concrete
  subclass of the platform base class — but under a SIBLING of `BaseRemoteMFE`, not under it,
  because that class is Module Federation machinery rather than contract. The six lifecycle
  states, the transition table and the ten capabilities cross to Swift intact and are RENDERED
  from `packages/contracts/src/platform-contract.ts` rather than hand-written;
  `getSharedDependencies()` deliberately does not cross; and `load` is `Bundle.load()`, which is
  what the contract's own wording for it always meant.
rationale-summary: >-
  The tempting reading — that `load` is vacuous on iOS because a native module is linked at build
  time — mistakes acquisition for the capability. On the web lane the `remoteEntry.js` fetch
  already happens BEFORE `doLoad()` is reachable, since the shell must fetch the bundle to obtain
  the class at all, so acquisition was never one of the ten in either lane; the lanes differ only
  in when it happens, and `load` means the same thing in both.
long-form: true
---

## Context

ADR-095 decides where a second build attaches. This one decides what the Swift
build actually *is*, and the answer is load-bearing for PDR-002: either the
platform contract is genuinely delivery-mechanism-independent or it is a web
contract with aspirations.

The TypeScript hierarchy is three levels, not two:

```
BaseMFE                        packages/runtime/src/base-mfe.ts        (abstract)
│  owns ALL orchestration — assertState, transitionState, executeLifecycle,
│  executeCapability, the stateGuard / stateTransition / lifecyclePhase /
│  errorBoundary middleware, handler dispatch
│  exposes the ten capabilities as public template methods
│  declares the do*() hooks those delegate to
│
└─ BaseRemoteMFE               packages/runtime/src/base-remote-mfe.ts (abstract)
   │  implements the nine do*() hooks
   │  holds `container: ModuleFederationContainer`, fetchContainer(remoteEntry)
   │  quarantines framework knowledge behind three abstract members:
   │    getSharedDependencies() · mountComponent() · unmount()
   │
   ├─ RemoteMFE                 (React / rspack)
   └─ AngularRemoteMFE          (Angular / webpack)
```

`BaseRemoteMFE`'s own header calls itself "framework-neutral", and it is. But it
is not *delivery-mechanism*-neutral: `fetchContainer(remoteEntry)`, a Module
Federation container, a shared scope, a DOM node to mount into. None of that
exists in a Swift Package.

## Decision

### 1. The native lane attaches as a sibling of `BaseRemoteMFE`, not under it

```
MFEBase                 rendering of BaseMFE — contract + orchestration
  └─ NativeMFEBase      sibling of BaseRemoteMFE — Bundle.load() acquisition
       └─ <Module>MFE   the generated concrete class
```

`<Module>MFE` is therefore a sibling of `RemoteMFE` and `AngularRemoteMFE`:
three concrete subclasses of one base, one per delivery mechanism. This is the
shape ADR-034 already established when it made `AngularRemoteMFE` a *sibling,
not a subclass* of `RemoteMFE`.

Attaching Swift under `BaseRemoteMFE` would have forced a remote-entry fiction —
a `fetchContainer` that fetches nothing and a shared scope with nothing to share.

### 2. `load` is `Bundle.load()`, and it is not vacuous

Swift modules are acquired by the linker: statically by SPM, or by dyld at launch
for a bundled framework. iOS forbids `dlopen`ing downloaded code, so there is no
runtime remote-entry fetch and the native lane emits no analogue of one.

The tempting conclusion is that `load` therefore does nothing on iOS. That
mistakes **acquisition** for the **capability**. Two observations settle it:

1. The contract's own description of `load` is *"Initialization — connect, warm
   caches, validate config."* It never said "fetch the bundle."
2. On the web lane the `remoteEntry.js` fetch happens **before** `doLoad()` is
   reachable at all, because the shell must fetch the bundle to obtain the class
   it then calls `load()` on.

So acquisition was never one of the ten capabilities in *either* lane. The lanes
differ only in when it happens — HTTP at runtime, linker at build time — and
`load` means the same thing in both. Concretely, `doLoad` resolves the module's
`Bundle`, loads its image, validates the static capability table against the
manifest identity, and transitions `uninitialized → loading → ready`.
`Bundle.load()` is Foundation's real module-loading operation.

(Earlier drafts of this ADR, the PR body and the generated README described that
as *"resolve `principalClass`"*. The emitted code never does — it is
`Bundle(for:)`, `isLoaded`, `load()`. The description was of a design that was
not written.)

### 3. The contract is rendered from `platform-contract.ts`, never hand-written

`MFE_LIFECYCLE_STATES`, `MFE_LIFECYCLE_TRANSITIONS` and
`PLATFORM_CAPABILITIES` — with each capability's `preStates`, `enterState`,
`exitState` and `errorState` — are read from `@seans-mfe/contracts` at codegen
time and emitted into Swift. A hand-kept Swift copy would drift the first time a
state was added, and nothing would catch it. This is ADR-080's rule applied one
language further out.

### 4. `getSharedDependencies()` deliberately has no native analogue

A Module Federation shared scope deduplicates singletons across separately-fetched
bundles at runtime. SPM resolves versions at build time and the linker emits one
copy: there is nothing to negotiate. `NativeMFEBase` declares no such member
rather than stubbing one that returns an empty map.

This asymmetry is the sharpest evidence for the platform's thesis, so it is
recorded rather than smoothed over: **the contract crosses to native intact; the
federation machinery does not, because it was never part of the contract.**

The two members that *do* cross are `mountComponent` → `mount(_:)` and
`unmount(containerId:)` → `unmount(_:)`; `fetchContainer(remoteEntry)` becomes
`resolveBundle()`.

### 5. `public final` + `open`, and a class rather than a protocol

`BaseMFE` documents that subclasses implement `do*()` and never override the
public capability methods. TypeScript cannot enforce that — nothing stops a
subclass overriding `load()` and skipping every state guard and telemetry
checkpoint. Swift can: every capability entry point is `public final`, every hook
is `open`. The rendering is therefore *stricter* than the original.

A protocol with a default-implementation extension is the more idiomatic Swift
reflex and is wrong here. Protocol extensions dispatch statically: a conforming
type that declares its own `load()` silently shadows the extension's, and every
guard is bypassed with no diagnostic. That is precisely the failure `final`
exists to prevent.

### 6. The capability table is re-derived at `swift build` time

An SPM build-tool plugin reads `swift/mfe-manifest.json` — the CLI's JSON
projection of the YAML manifest — and regenerates `ManifestMetadata.swift` into
the build directory on every build. JSON rather than YAML so the plugin needs no
dependency beyond `Foundation.JSONDecoder`.

The effect: the manifest is read by two build systems, Node's and Swift's, and
neither holds a copy of the truth. The projection is committed and
generator-owned; the derived Swift is neither.

### 7. A BFF gets a generated client, a generated provider, and a real `doQuery`

> `MFEContext` was extended for this: it carries `jwt` and `headers`, and
> `inputs` became `[String: JSONValue]` rather than `[String: String]`.
> `Context.inputs` is `Record<string, unknown>` in TypeScript, and a
> string-keyed-string map cannot carry a GraphQL variable that is a number, a
> bool or an object — which is most of them. Without `jwt` there was nowhere to
> read the bearer token the web lane's `doQuery` forwards.

When the manifest declares a `data:` section the platform already generates a
GraphQL BFF (ADR-012) and, in the web lane, a **generator-owned**
`src/platform/bff/bff.ts` — a generic `query<T>(document, variables, headers)`
over that endpoint, with HTTP failures and GraphQL errors mapped to typed
errors. It does not generate the queries themselves.

**There are two directions here, and an earlier draft of this ADR conflated
them.** It claimed the native lane "mirrors that split exactly." It does not,
because the web lane has no per-capability document at all. What the web lane
actually does is in `packages/codegen/templates/base-mfe-angular/mfe.ts.ejs`:
the generated `doQuery` reads the document out of `context.payload.document` —
supplied by the **caller at runtime** — and hands it to `bffQuery`. The
generated connector takes the document as a *parameter* and never names a
symbol a developer must define.

So the native lane carries both directions, and says which is which:

| Direction | Who names the document | Web | Native |
|---|---|---|---|
| **In** — a host asks this MFE to run a query | the caller, at runtime | generated `doQuery` reads `context.payload.document` | generated `doQuery` reads `context.inputs["document"]` |
| **Out** — this MFE fetches its own data | this package | *no equivalent* | `BFF<Module>DataProvider` → `<Cap>Query.document` |

The first row is a faithful port and closes a stub: `NativeMFEBase.doQuery`
returned `QueryResult(data: nil, errors: [])`. It is now a **concrete default on
`MFEBase`**, because that is the layer TypeScript puts it at — `BaseMFE.doQuery`
is the one hook that is not abstract (ADR-053 for the endpoint order, ADR-070
for the uniform no-data contract). It is emitted with or without a `data:`
section: an MFE with no BFF answers `data: nil` rather than dialing a
non-existent endpoint, which is what makes the capability uniform across every
MFE. No subclass overrides it.

Endpoint resolution is ADR-053's, minus two steps that have no native meaning:
`context.inputs["bffUrl"]` → `BFF_URL` → `identity.bffEndpoint`. There is no
dependency container to hold a `deps.bffUrl`, and the manifest composition
TypeScript does at runtime (`manifest.endpoint` + `data.serve.endpoint`) already
happened at generation time — `identity.bffEndpoint` *is* that composition.

The second row is **new**, and the honest justification is not a precedent but a
difference in what fills the seam. On the web a shell supplies the document
because there is a shell to supply it. A native `<Module>DataProvider` is the
seam the **host app** fills, and the point of generating `BFF<Module>DataProvider`
is that the host no longer has to — which is only possible if the documents live
in the package. Hence:

| What | Where | Owner |
|---|---|---|
| Generic GraphQL client | `Platform/BFFClient.swift` | generator |
| The provider protocol | `Platform/DataProvider.swift` | generator |
| Its BFF-backed implementation | `Platform/BFFDataProvider.swift` | generator |
| One capability's document | `Features/<Cap>Query.swift` | **developer** |

`BFF<Module>DataProvider` implements every protocol method as
`try await client.query(<Cap>Query.document)`, and `<Module>MFE` defaults its
`provider:` parameter to it, so a host that wants the generated answer gets it
and a test can still inject a fake. The document stays the developer's because
codegen cannot know it: the BFF's schema is composed by GraphQL Mesh from
`data.sources` at build time, so the field names come from the team's OpenAPI
specs. The seeded document is a valid but useless `query <Cap> { __typename }`
with a TODO and the playground URL.

**That ownership split has a cost, and it is paid with a validation rule.**
`BFFDataProvider.swift` is generator-owned and calls `<Cap>Query.document` by
name — the same generator-to-developer symbol coupling that made the
`CapabilityViewRegistry` / `CapabilityViews.swift` monolith a build break
(ADR-095 §7). Per-capability files fix the *addition* case: a new capability
gets a new document that regeneration writes because it does not exist yet. The
*deletion* case is backstopped by `native-capability-query` in `mfe:validate`,
the companion to `native-capability-view`, which names the missing file and the
generated caller. Sharper than the view rule, because a Swift compiler would
catch this one — it is not behind `#if canImport(SwiftUI)` — but nothing in CI
runs a Swift compiler, and `cannot find 'PayStatusQuery' in scope` names a
symbol and no fix.

The endpoint is baked from the manifest into `BFFClient.defaultEndpoint` and
overridable at runtime by `BFF_URL`, the same precedence the web connector uses
and for the same reason: an MFE and its BFF are one deployable unit on one
origin, so a relative path would resolve against the host app.

A manifest with no `data:` section generates no BFF, so none of these files is
emitted, `doQuery` keeps `NativeMFEBase`'s stub, and `<Module>DataProvider`
remains a bare protocol for the host to implement.

## Boundaries

- **CI compiles the emitted Swift on Linux, and only the non-UI half.** This
  section previously said nothing compiled it at all, which was true until the
  `swift` job in `.github/workflows/test.yml` (`npm run check:swift-build`)
  started running `swift build` + `swift test` against the committed package in
  the official `swift:6.0` container. That covers `MFEBase`, `NativeMFEBase`,
  `MFELifecycle`, `Types`, the BFF client and provider — essentially all the
  generated logic — and it exercises the SPM build-tool plugin, which no
  Node-side gate can reach. The SwiftUI files are behind
  `#if canImport(SwiftUI)`, false on Linux, so the views are *skipped* rather
  than compiled and still need a Mac.

  The gate was overdue, and its absence had a measured cost: two type errors
  reached `main`-bound commits and were found by reading rather than by a
  gate — `@escaping` inside a typealias (legal only in parameter position) and
  a checked `Sendable` conformance on a struct holding an existential `Error`.
  `native-contract-pin.test.ts` asserts the *rendering* and cannot see either.
- **Most of that pin suite is circular, and an earlier draft of this ADR said
  otherwise.** It claimed the suite "fails the moment the TS contract gains a
  state the Swift rendering does not carry." A reviewer checked, and it does
  not: the template renders from the same `MFE_LIFECYCLE_STATES` /
  `PLATFORM_CAPABILITIES` objects the expectations read, so both sides move
  together. Adding a seventh state was measured to leave the suite green and to
  *grow* it, because `it.each([...STATES])` generates a case per state. Those
  assertions catch **template** drift — a hardcoded state, a mis-rendered
  transition target, one half of a capability pair dropped — and nothing else.

  Two assertions were added that are not circular and carry the real weight: a
  **frozen literal** of the six states and ten capabilities the Swift lane was
  written against, so a contract change fails and has to be carried across
  deliberately; and a check that **every type `MFEBase` returns is declared in
  `Types.swift`**, which compares two independently generated artifacts. The
  second is the one that catches the actual breakage — a capability whose
  `resultType` has no `SWIFT_RESULTS` entry renders `-> SnapshotResult` against
  a type nothing declares. Measured with an 11th capability added: every other
  assertion in the file stayed green while the emitted package could not have
  compiled.
- **Linux portability: the earlier reasoning here was wrong.** This section
  previously said Linux was "considered and dropped" because
  `Bundle.principalClass` needs the Objective-C runtime. That rested on a method
  the emitted code never calls, and a reviewer disproved the conclusion by
  building it: the Swift 6.0.3 Linux toolchain compiles the generated package
  and runs its tests (`swift build` ~12s, `LifecycleTests` 5/5) on
  `x86_64-unknown-linux-gnu`, because the three SwiftUI files are behind
  `#if canImport(SwiftUI)`.

  What that covers is the non-UI surface — `MFEBase`, `MFELifecycle`, `Types`,
  `NativeMFEBase`, which is everything the contract pin reasons about. The
  SwiftUI-gated files are *skipped*, not compiled, so a Linux build does not
  prove the views are valid. A Linux `swift build && swift test` CI job is
  therefore feasible and would close the "nothing compiles the emitted Swift"
  gap for the non-UI surface; it is not in this ADR's scope, and the UI surface
  would still need a Mac.
- **One transport, two error policies — and the split is deliberate.**
  `MFEBase.doQuery` and `BFFClient` both POST through `GraphQLPost.send`: one
  URLRequest construction, one `Content-Type`, one `200..<300` check, one
  `URLSession.shared`. What is NOT shared is what happens to a *partial*
  response (`data` and `errors` both present, a normal GraphQL outcome):
  `doQuery` returns both because the `query` capability answers with an
  envelope, and `query<T>` throws because a caller decoding into a type should
  not silently receive half a response. TypeScript splits them the same way —
  `base-mfe.ts:780` returns `{ data, errors }`, `bff.ts` throws.

  They each had their own transport until this was consolidated, justified as
  mirroring TypeScript. That justification was wrong: the web lane duplicates
  because `BaseMFE` ships in a published package and cannot import the `bff.ts`
  generated into an MFE later — a package boundary this lane does not have,
  since both files are generated into the same module in the same commit.

  The reason it matters is that **no gate could see it**. `check:mfe-drift`
  compares generated bytes to the template, so both files stay "correct" while
  free to diverge, and nothing exercised either path — `doQuery` hardcoded
  `URLSession.shared`, so the `query` capability could not be tested at all.
  `MFEDependencies.transport` is the seam that fixes that (TypeScript needs no
  analogue: its tests stub the global `fetch`, and Swift has no global to stub),
  and the generated `LifecycleTests` now runs both policies over the same stubbed
  bytes so the difference is asserted rather than incidental.
- **No *typed* GraphQL client is generated.** §7 generates the connector and the
  provider that calls it, but the documents and the response types are the
  developer's: `<Cap>Outputs` is emitted as an empty `Codable` struct and the
  seeded document selects `__typename`. Typed query structs would need schema
  introspection at codegen time, which is a separate scope — the BFF's schema
  does not exist until Mesh composes it.
- **Nothing here is proven against a running BFF.** The provider is asserted at
  the text level: that it implements the protocol, that each method decodes into
  a type `Types.swift` declares, and that the client surfaces GraphQL errors
  ahead of partial data. Whether a real request round-trips is a Mac-and-running-
  BFF check, and it is on the same side of the line as compilation.
- **Manifest lifecycle hooks are dispatched natively as of ADR-098.** This ADR
  recorded them as a boundary; carrying them across also required replacing the
  inlined `execute` with the composed middleware pipeline, because the inlined
  version had no seam a phase could attach to. Both are ADR-098's, not this
  one's. What remains missing there: no native `PLATFORM_HANDLER_LIBRARY`, and a
  custom handler must be *registered* rather than discovered, because Swift
  cannot look a method up by name on a plain class.
- **Four of the eight injected dependencies are still absent, by design.**
  `MFEDependencies` renders `platformHandlers`, `customHandlers`, `telemetry`
  and `errorHandler`. `wsClient`, `bffUrl`, `manifestParser` and
  `stateValidator` have no native consumer (ADR-098 §4). Telemetry is a
  *protocol* with no conformer shipped, so hook failures are still invisible
  unless a host supplies one.
- **Two capabilities throw rather than answer.** `emit` and
  `updateControlPlaneState` have no native transport — there is no telemetry
  service and no analogue of `attachControlPlane(wsClient:)`. They previously
  returned `accepted: true`, which reported success for work that never
  happened; they now throw `MFENotImplementedError` naming the missing
  transport. A capability that fails honestly is worth more than one that lies.
- **These gaps were invisible to every gate.** `native-contract-pin.test.ts`
  asserts one `public final func` and one `open func do…` per capability, which
  is exactly the surface that *was* rendered. `base-mfe-surface.test.ts` now
  reads `base-mfe.ts` off disk and fails when any member of `BaseMFE` is in
  neither the rendered nor the knowingly-absent column — it found
  `_lifecycleStack`, which a by-hand audit had missed. Ten of those members
  moved from absent to rendered in ADR-098.

## Consequences

Better: PDR-002 has its first real test. The same six states, the same ten
capabilities and the same transition table now exist in two languages with one
source, held together by a pin test rather than by discipline. And the exercise
found something genuine — that `BaseRemoteMFE` mixes contract with federation
machinery, which was invisible while there was only one delivery mechanism.

Worse, and accepted knowingly:

- **A contract whose UI half no gate compiles.** The pin test is strong on the
  contract's *shape* and blind to whether the result is valid Swift. The `swift`
  CI job now compiles the platform layer on Linux; the SwiftUI views are behind
  `#if canImport(SwiftUI)` and are still verified by hand on a Mac.
- **`ManifestMetadata` is referenced before it exists.** `Types.swift` reads
  symbols the SPM plugin generates at build time. Correct under `swift build`,
  confusing when reading the package in isolation.
- **Ownership no longer fails loudly, because it no longer needs to.** Earlier
  drafts of this section described a build break as the design: adding a
  capability updated the generator-owned registry, and the developer-owned
  views file — one file holding every view — had no entry for it. That was a
  workaround for a contributor seam that could not emit per-capability files,
  presented as intent, and it was wrong twice over. The break did not occur on
  Linux at all (the registry's reference sits inside `#if canImport(SwiftUI)`),
  and a compile error is not ADR-082's mechanism, which is a diagnostic naming
  a file and a fix.

  Views are now one file per capability (ADR-095 §7), so a capability added to
  the manifest gets its own new file that regeneration writes — the web lane's
  behaviour. Two design-time rules in `packages/codegen/src/validate.ts` cover
  what is left: `native-capability-view` for a view someone deleted, and
  `native-views-legacy-file` for the pre-split monolith, which regeneration
  cannot delete because it is developer-owned.

- **Two base classes to keep in step.** `MFEBase` and `BaseMFE` are the same
  contract expressed twice. The pin test covers the contract surface; it does not
  cover orchestration *behaviour*, so the two pipelines can still diverge in how
  they sequence a hook.

## References

- ADR-095 — a manifest may declare secondary build targets contributed to the file plan; this decides what the Swift target contains.
- ADR-034 — pluggable bundler + framework via codegen variants; it made `AngularRemoteMFE` a sibling rather than a subclass, the same shape used here.
- ADR-036 — framework plugins and the abstract `BaseFrameworkPlugin` with concrete implementations; it deferred the native lifecycle contract to its own ADR, which is this one.
- ADR-041 — the ten platform capabilities that this renders into Swift.
- ADR-042 — the MFE lifecycle state machine and its guarded transitions, rendered here as `MFELifecycleTransitions`.
- ADR-080 — the ten platform capabilities and the MFE lifecycle machine are defined once in `@seans-mfe/contracts`; this renders that single definition into a second language.
- ADR-040 — lifecycle hook handler sources, which ADR-098 carries into the native lane.
- ADR-098 — manifest lifecycle hooks cross to Swift, and the capability pipeline becomes composable middleware so they have somewhere to attach; it closes the hook boundary this ADR opened.
- ADR-053 — BFF endpoint resolution order, which the native `doQuery` follows minus the two steps that have no native meaning.
- ADR-070 — the uniform no-data query contract: an MFE with no `data:` section answers null rather than dialing. Rendered here on `MFEBase`, as in TypeScript.
- ADR-012 — the GraphQL BFF generated from a manifest's `data:` section; §7 connects the Swift target to it and mirrors the ownership split of the web lane's generated `bff.ts`.
- ADR-082 — the platform reports its own breaking changes in code it does not own, and never rewrites that code; the Swift build break is that posture.

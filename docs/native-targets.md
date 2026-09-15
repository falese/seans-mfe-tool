# Native targets — one manifest, two builds

*The plain-language companion to [ADR-095](architecture-decisions/ADR-095-secondary-build-targets.md)
and [ADR-096](architecture-decisions/ADR-096-native-lifecycle-contract.md).*

## The idea

An MFE's manifest declares *capabilities* — what the thing can do. How those
capabilities get delivered is a separate question, and until now the answer was
always the same: a Module Federation remote, fetched over HTTP.

A **target** is one answer to that question. A manifest can name more than one.

### Saying "this MFE targets web and mobile"

```yaml
targets:
  web:
    framework: react
    bundler: rspack
  swift: {}
```

Both builds come from the same capabilities. `remote:generate` emits the Module
Federation remote under `src/` and a Swift Package under `swift/`.

### A target can implement a subset

Not every capability belongs on every delivery mechanism:

```yaml
targets:
  web:
    framework: react
    bundler: rspack
  swift:
    capabilities: [CrewRoster]   # the dense PayStatus table stays web-only
```

Omit `capabilities` and the target takes all of them. A capability no native
target implements is a warning from `mfe:validate`, not an error — it is still
built for the web.

### Or, on an MFE that already exists

`framework` and `bundler` at the top level are the older spelling of
`targets.web`, they are not deprecated, and every example manifest still uses
them. So adding a native build to an existing MFE is two lines:

```yaml
framework: react      # unchanged
bundler: rspack       # unchanged

targets:
  swift: {}           # + the native iOS build
```

The two spellings must **agree** where both are present — a manifest setting
`framework: react` and `targets.web.framework: angular` is rejected, naming both
values, rather than quietly building one of them.

```
mfe-manifest.yaml
├── src/            → Module Federation remote  (rspack, fetched at runtime)
├── src/platform/bff/ → GraphQL BFF            (already a second build)
└── swift/          → Swift Package            (SPM, linked at build time)
```

Note the middle row: the BFF has been a second build inside the same MFE since
ADR-094. Swift is the third artifact, not the second.

## Try it

```sh
# A new MFE with both builds
seans-mfe-tool remote:init my-feature --swift
cd my-feature && seans-mfe-tool remote:generate

# Or add the native build to an MFE that already exists
cd examples/meridian-station/meridian-crew-services
seans-mfe-tool remote:generate --swift
```

The flag is additive. It writes a `targets.swift` block and changes nothing
else — whichever spelling already describes your web build keeps describing it.

## What you get, and who owns it

| Path | Owner |
|---|---|
| `swift/Sources/MFE/Features/<Cap>View.swift` | **You.** One per capability. Seeded once, then never rewritten. |
| `swift/Sources/MFE/Features/<Cap>Query.swift` | **You.** One per capability, when the manifest declares a `data:` section. Seeded once. |
| `swift/Package.swift`, `swift/README.md` | **You.** Seeded once. |
| `swift/Sources/MFE/Platform/**` | The generator. Re-stamped every run. |
| `swift/mfe-manifest.json` | The generator. Input to the SPM plugin. |

This is the same split the web lane already uses — `src/platform/**` is the
generator's, `src/features/**` is yours — so a Swift author's edits survive
regeneration for the same reason a React author's do.

**When you add a capability**, you get a new `<Cap>View.swift` (and a new
`<Cap>Query.swift`, if you have a BFF) seeded with a stub, and the package keeps
building — the same thing the web lane does with
`src/features/<Cap>/<Cap>.tsx`. `overwrite: false` means *seed once*, not
*never write*, so a file that does not exist yet is created.

Three checks cover what regeneration cannot fix on its own, all reported by
`mfe:validate`: `native-capability-view` if a view was deleted,
`native-capability-query` if a query document was deleted out from under the
generated provider, and `native-views-legacy-file` if a pre-split
`CapabilityViews.swift` is still around from before views were split per
capability.

## If the manifest declares a data source, the native build talks to the BFF

A manifest with a `data:` section already generates a GraphQL BFF beside the web
remote (ADR-012). The Swift target connects to that BFF, and the connector is
**generated**:

| What | Where | Owner |
|---|---|---|
| Generic GraphQL client over the BFF endpoint | `Platform/BFFClient.swift` | generator |
| The provider protocol, one method per capability | `Platform/DataProvider.swift` | generator |
| An implementation of it that calls the client | `Platform/BFFDataProvider.swift` | generator |
| The GraphQL document for one capability | `Features/<Cap>Query.swift` | **you** |

```swift
// Platform/BFFDataProvider.swift — generated, and regenerated
public struct BFFMeridianCrewServicesDataProvider: MeridianCrewServicesDataProvider {
    public func crewRoster() async throws -> CrewRosterOutputs {
        try await client.query(CrewRosterQuery.document)
    }
}
```

The wiring is mechanical, so the platform writes it and keeps writing it: add a
capability, regenerate, and the provider gains a method. `<Module>MFE` defaults
its `provider:` parameter to `BFF<Module>DataProvider`, so a host gets the
generated answer for free and a test can still inject a fake.

The **document** is yours because codegen cannot know it — your BFF's schema is
composed by GraphQL Mesh from `data.sources` at build time, so the field names
come from your OpenAPI specs.

**Two directions, and only one of them exists on the web.** The web lane has no
per-capability document at all: its generated `doQuery` reads the document from
`context.payload.document`, supplied by the caller, and passes it to the
generated `bff.ts`. The native lane does both:

| Direction | Who names the document | How |
|---|---|---|
| **In** — a host asks this MFE to run a query | the caller, at runtime | `MFEBase.doQuery` reads `context.inputs["document"]` |
| **Out** — this MFE fetches its own data | this package | `BFF<Module>DataProvider` → `<Cap>Query.document` → `BFFClient.query` |

The first is a straight port: `BaseMFE.doQuery` is the one hook TypeScript does
not leave abstract, so the Swift default lives on `MFEBase` too. It is emitted
whether or not you have a BFF — no `data:` section means it answers `data: nil`
rather than dialing a non-existent endpoint (ADR-070), so `query` behaves the
same on every MFE. Endpoint order is `context.inputs["bffUrl"]` → `BFF_URL` →
the manifest's, baked in at generation.

The second is new, and it exists because a native `DataProvider` is the seam the
**host app** fills — generating it means the host no longer has to, which is only
possible if the documents live in the package.

```swift
// In: the caller names the document
let result = try await mfe.query(MFEContext(
    inputs: ["document": .string("query { crew { id } }")],
    jwt: token
))

// Out: this package's own document, decoded into a declared type
let roster = try await provider.crewRoster()
```

`MFEContext.inputs` is `[String: JSONValue]`, not `[String: String]`, so a
GraphQL variable can be a number, a bool or an object. `jwt` and `headers` are
forwarded to the BFF.

Because `BFFDataProvider.swift` is generated and calls `<Cap>Query.document` by
name, deleting a document breaks generated code. `mfe:validate` reports that as
`native-capability-query`, naming the missing file and the caller.

The endpoint is baked in from the manifest and overridden at runtime by
`BFF_URL`:

```swift
BFFClient.defaultEndpoint            // http://localhost:5005/graphql
BFFClient()                          // BFF_URL if set, else the baked default
BFFClient(endpoint: someOtherURL)    // or pass one
```

An absolute URL rather than a path because the MFE and its BFF are one
deployable unit on one origin — a relative path would resolve against the host
app instead.

No `data:` section means no BFF, so none of these three files is emitted and
`<Module>DataProvider` stays a bare protocol for the host to implement.

## How it relates to the web build

The generated `<Module>MFE` is a **third concrete subclass of the platform base
class**, beside `RemoteMFE` (React/rspack) and `AngularRemoteMFE`
(Angular/webpack):

```
BaseMFE / MFEBase          the contract — 6 states, 10 capabilities, orchestration
├── BaseRemoteMFE          Module Federation acquisition
│   ├── RemoteMFE                React / rspack
│   └── AngularRemoteMFE         Angular / webpack
└── NativeMFEBase          Bundle.load() acquisition
    └── <Module>MFE              Swift / SPM
```

`NativeMFEBase` is a **sibling** of `BaseRemoteMFE`, not a subclass of it.
`BaseRemoteMFE` reads as framework-neutral and is — but it is not
*delivery-mechanism*-neutral: `fetchContainer(remoteEntry)`, a shared scope, a
DOM node to mount into. None of that exists in a Swift Package.

### `load` is not a no-op on iOS

The obvious objection is that a native module is linked at build time, so
there is nothing left for `load` to do. That mistakes *acquisition* for the
*capability*. Two things settle it:

1. The contract describes `load` as **"Initialization — connect, warm caches,
   validate config."** It never said "fetch the bundle."
2. On the web, the `remoteEntry.js` fetch happens **before** `doLoad()` is
   reachable — the shell has to fetch the bundle to get the class it then calls
   `load()` on.

So acquisition was never one of the ten capabilities in *either* lane. What
differs is only *when* it happens: HTTP at runtime, linker at build time. In
Swift, `load` resolves the module's `Bundle`, loads its image, validates the
capability table, and moves `uninitialized → loading → ready` — which is
Foundation's real module-loading operation, not a stub.

### One thing deliberately does *not* cross

`BaseRemoteMFE` quarantines framework knowledge behind three members. Two have
native analogues; one does not.

| Web | Native |
|---|---|
| `fetchContainer(remoteEntry)` | `resolveBundle()` → `Bundle.load()` |
| `mountComponent(id, el)` | `mount(_:)` |
| `unmount(containerId)` | `unmount(_:)` |
| `getSharedDependencies()` | **nothing** |

A Module Federation shared scope deduplicates singletons across separately
fetched bundles at runtime. SPM resolves versions at build time and the linker
emits one copy — there is nothing to negotiate, so `NativeMFEBase` declares no
such member rather than stubbing one.

That asymmetry is the point rather than an embarrassment: **the contract
crosses to native intact; the federation machinery does not, because it was
never part of the contract.**

## The manifest is read by two build systems

`swift build` runs an SPM build-tool plugin that regenerates the capability
table from `swift/mfe-manifest.json` — the CLI's JSON projection of the YAML
manifest. So the manifest stays the single source *inside Xcode* too, not only
inside the CLI, and neither build system holds a copy of the capability list.

JSON rather than YAML because `Foundation.JSONDecoder` needs no dependency, and
a build plugin that drags in a YAML parser is one nobody will keep.

## Known limits

- **No gate compiles the emitted Swift.** There is no Swift toolchain in CI —
  though a reviewer showed the package *does* build on Linux (Swift 6.0.3,
  `swift build` ~12s, `LifecycleTests` 5/5), because the SwiftUI files are
  behind `#if canImport(SwiftUI)`. A Linux job would close this for the non-UI
  surface; the views would still need a Mac.
  `packages/framework-swift/src/__tests__/native-contract-pin.test.ts` asserts the
  *rendering* against `packages/contracts/src/platform-contract.ts`, but it is a
  text assertion, not a type check. Compilation is verified by hand on a Mac.
- **Most of that pin suite is circular.** The template renders from the same
  contract objects the expectations read, so a contract change moves both sides
  and stays green — verified by adding a seventh state. Those assertions catch
  *template* drift only. Two assertions are not circular and carry the weight: a
  frozen literal of the states and capabilities the Swift lane was built for,
  and a check that every type `MFEBase` returns is declared in `Types.swift`.
- **The generated BFF client is not *typed*.** `<Cap>Outputs` is an empty
  `Codable` struct and the seeded document selects `__typename`; you declare the
  fields on both sides. Typed query structs would need schema introspection at
  codegen time, and the schema does not exist until Mesh composes it.
- **No gate exercises a real BFF request.** The provider is checked at the text
  level — that it implements the protocol, that every method decodes into a type
  `Types.swift` declares, that the client raises GraphQL errors ahead of partial
  data. An actual round trip is a Mac-and-running-BFF check.
- **Manifest lifecycle hooks are not dispatched in Swift yet.** The guard,
  transition and error pipeline is rendered; ADR-040 handler sources are a
  web-lane feature so far. `MFEBase.execute` also inlines the guard/transition/
  error steps rather than composing them as middleware, so there is no
  interception point for hooks to attach to — adding them means reworking that
  first. ADR-096 §Boundaries lists the eight missing members by name.
- **`emit` and `updateControlPlaneState` throw.** There is no telemetry service
  and no native analogue of `attachControlPlane(wsClient:)`, so both throw
  `MFENotImplementedError` naming the missing transport. They used to return
  `accepted: true`, which claimed work that never happened.
- **No telemetry.** None of `BaseMFEDependencies`' eight injected dependencies
  has a native counterpart; `MFEBase.init` takes an identity and nothing else.
- **"Mobile" means iOS.** `swift` is the only native target the platform ships a
  generator for. A manifest may declare any target id — unknown ids are
  preserved and warn rather than failing — but nothing will build them.

## Adding a different target

A target is an ordinary **framework plugin** — a `BaseFrameworkPlugin`, like
`framework-react` — with two additions (ADR-097):

- `targetId`, the `targets:` key that selects it. `'web'`, the default, means
  the primary build chosen by the manifest's `framework` field.
- `registerCodegen()`, which hands the generator a template root your package
  owns plus the `FileSpec`s to resolve against it
  ([ADR-094 §2](architecture-decisions/ADR-094-the-generator-is-a-library.md)),
  each spec gated on your manifest section.

`packages/framework-swift/` is the worked example:
`packages/framework-swift/src/plugin.ts` for the build lifecycle,
`packages/framework-swift/src/codegen.ts` for the files.

Two things to know before you start:

- A **`CodegenVariant`** cannot carry a secondary target — `findVariant`
  resolves one per MFE, so a variant is a *different* build, never a *second*
  one. Use a `FileContributor`, which is what `registerCodegen()` registers.
- Omit `defaultPort`, `startDevServer` and `getDockerStrategy` if your target is
  not served over HTTP. They are optional; absent is better than a stub, and
  `build:dev` / `build:docker` / `remote:init` narrow on them explicitly.

Registration is driven by the manifest, so there is no import list to keep in
step — `loadTargetPlugins()` finds your plugin from the `targets:` key and calls
its hook.

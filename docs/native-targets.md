# Native targets — one manifest, two builds

*The plain-language companion to [ADR-095](architecture-decisions/ADR-095-secondary-build-targets.md)
and [ADR-096](architecture-decisions/ADR-096-native-lifecycle-contract.md).*

## The idea

An MFE's manifest declares *capabilities* — what the thing can do. How those
capabilities get delivered is a separate question, and until now the answer was
always the same: a Module Federation remote, fetched over HTTP.

A **secondary target** is a second answer to that question, from the same
manifest. Add four lines:

```yaml
targets:
  swift: {}
```

…and `remote:generate` emits a Swift Package under `swift/` beside the web
build. Same capabilities, same lifecycle contract, two independently buildable
artifacts.

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
else — `framework` and `bundler` still describe the web build.

## What you get, and who owns it

| Path | Owner |
|---|---|
| `swift/Sources/MFE/Features/**` | **You.** Never rewritten. |
| `swift/Package.swift`, `swift/README.md` | **You.** Seeded once. |
| `swift/Sources/MFE/Platform/**` | The generator. Re-stamped every run. |
| `swift/mfe-manifest.json` | The generator. Input to the SPM plugin. |

This is the same split the web lane already uses — `src/platform/**` is the
generator's, `src/features/**` is yours — so a Swift author's edits survive
regeneration for the same reason a React author's do.

**When you add a capability**, the generator-owned
`Platform/CapabilityViewRegistry.swift` gains an entry and the Swift build
fails until you write the matching view. That build failure *is* the migration
notice ([ADR-082](architecture-decisions/ADR-082-platform-migrations-warn-never-rewrite.md)): the
platform reports the change in code it does not own, and never rewrites it.

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

- **No gate compiles the emitted Swift.** There is no Swift toolchain in CI.
  `packages/framework-swift/src/__tests__/native-contract-pin.test.ts` asserts the
  *rendering* against `packages/contracts/src/platform-contract.ts` — every
  state, every transition edge, both halves of every capability pair, the
  `final` modifiers — but it is a text assertion, not a type check. Compilation
  is verified by hand on a Mac.
- **No GraphQL client is generated.** The data seam is a protocol the host
  implements; typed query structs would need schema introspection at codegen
  time.
- **Manifest lifecycle hooks are not dispatched in Swift yet.** The guard,
  transition and error pipeline is rendered; ADR-040 handler sources are a
  web-lane feature so far.

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

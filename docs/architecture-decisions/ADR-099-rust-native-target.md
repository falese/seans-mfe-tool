---
id: 0099
title: >-
  A manifest may declare a Rust target — a runtime-agnostic Cargo library crate carrying the
  platform contract, with no UI, no HTTP client and no build-time manifest step
status: Implemented
date: 2026-09-24
deciders: [sean]
area: Codegen / targets / native
enforcement: code
tags: [codegen, plugins, native, rust, targets, lifecycle]
relates-to: [1, 2, 53, 70, 79, 80, 82, 95, 96, 97, 98]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/framework-rust/src/plugin.ts
  - packages/framework-rust/src/codegen.ts
  - packages/framework-rust/templates/src/platform/mfe_base.rs.ejs
  - packages/framework-rust/templates/src/platform/native_mfe_base.rs.ejs
  - packages/codegen/src/rust-naming.ts
  - packages/codegen/src/validate.ts
  - packages/dsl/src/schema.ts
  - src/targets/enable.ts
  - scripts/check-rust-build.sh
verified-by:
  - packages/framework-rust/src/__tests__/rust-contributor.test.ts
  - packages/framework-rust/src/__tests__/rust-contract-pin.test.ts
  - packages/framework-rust/src/__tests__/plugin.test.ts
  - packages/codegen/src/__tests__/rust-capability-query.test.ts
  - packages/framework-rust/templates/tests/lifecycle.rs.ejs
  - check:rust-build
summary: >-
  `targets.rust` emits a Cargo library crate under `rust/`, beside the web remote, from the same
  manifest (ADR-095). The plugin is `@seans-mfe/framework-rust` (`rust-cargo`, `targetId: 'rust'`)
  carrying both halves per ADR-097. The crate renders the platform contract from
  `@seans-mfe/contracts` the way the Swift lane does (ADR-096 §3) and runs ADR-098's hook engine,
  but it is shaped by three subtractions — no UI layer, no HTTP client, and no build-time manifest
  re-derivation — each because Rust has no single right answer the platform could pick for a host.
rationale-summary: >-
  The mechanism was already decided: ADR-095 made a second build a FileContributor and ADR-097
  made its owner a framework plugin, so this lane changes no line of the generator. What needed
  deciding was what the artifact IS. A native library crate is the direct counterpart of the
  Swift package; a WASM component would change how the web shell loads remotes, and a Rust BFF
  would replace a different seam. Those remain open and are named below rather than implied.
long-form: true
---

## Context

ADR-095 opened `targets:` to any id and ADR-097 made a target one plugin
carrying its build lifecycle and codegen. The Swift lane (ADR-096, ADR-098) is
the only implementation, which leaves PDR-002's claim of a language-neutral
contract tested against exactly one non-web language — and one whose runtime
(Foundation, `URLSession`, SwiftUI) supplied an obvious default for every seam.

"A Rust target" could mean three different artifacts, and they are not
variations of one another:

| Artifact | What changes | Seam |
|---|---|---|
| Native library crate | a second build, linked into a Rust host | a new `FileContributor` (ADR-095) |
| WASM component | how the **web shell** loads a remote | the runtime's delivery path, not codegen |
| Rust BFF | the server generated from `data:` | replaces the BFF contributor |

This ADR takes the first — the direct counterpart of the Swift package — and
says nothing about the other two beyond naming them.

## Decision

### 1. `targets.rust` emits a Cargo library crate under `rust/`

Selected by the manifest's `targets.rust` block, gated the way the BFF is gated
on `data:`. The plugin is `RustCargoPlugin` (`id: 'rust-cargo'`,
`framework: 'rust'`, `bundler: 'cargo'`, `targetId: 'rust'`), registered in
`BUILTIN_TARGETS` and resolved by `loadTargetPlugins()` (ADR-097). It declares
no `defaultPort`, `startDevServer` or `getDockerStrategy`: a linked library has
no HTTP surface. `unified-generator.ts` is untouched.

`TargetsSchema` declares `rust` with three fields — `crateName` (a Cargo
package name; omitted ⇒ the manifest name), `edition` (`2021` | `2024`), and
`capabilities` (the ADR-095 subset). A secondary target still declares how to
build, never what the MFE is.

### 2. The contract is rendered, and the rendering is structural

States, transitions and the ten capabilities with their pre/enter/exit/error
states are read from `@seans-mfe/contracts` at generation time (ADR-080,
ADR-096 §3). The class hierarchy becomes:

```text
MfeBase<H: MfeHooks>        rendering of BaseMFE — the ten capabilities + orchestration
  H: NativeMfe (blanket)    the native do_* hooks — sibling of BaseRemoteMFE
     <Prefix>Native         generated; supplies only mount()
<Prefix>Mfe = MfeBase<<Prefix>Native>
```

Rust has no inheritance, which turns out to be the stronger form of the rule
ADR-096 §5 wanted from `final`: the ten capabilities are inherent methods on
`MfeBase<H>`, the `do_*` hooks are methods on a separate `MfeHooks` trait, and
an implementation of the second cannot reach the first to skip a guard. As in
TypeScript, `do_query` is the one hook with a default (ADR-053, ADR-070).

### 3. The pipeline is the eight steps in order, written in sequence

ADR-098 §1's order holds exactly: state guard, enter transition, error boundary
wrapping before / main / the `do_*` hook / after / exit transition. It is
written as eight sequential steps in `MfeCore::execute` rather than a composed
middleware list, because async closures that borrow across `.await` do not
compose in Rust without boxing every step. ADR-098's objection was to an
inlined pipeline with *no seam for the phases*; this one has every phase, in
the same place, and `rust-contract-pin.test.ts` pins the order. The hook
engine — handler arrays, containment, main-phase propagation, telemetry on
every failure, the ADR-001 re-entrancy guard that skips rather than throws, and
case-insensitive capability lookup — is ADR-098 §2's, unchanged. Handler
resolution is ADR-098 §3's: the injected map is the mechanism, and the crate
generates a no-op stub for every handler the manifest names.

### 4. Three subtractions from the Swift lane

Each is a place where the Swift lane had a platform default and Rust does not:

- **No UI.** There is no Rust UI framework the platform could choose for a
  host — Tauri, egui, a TUI and a server are all plausible. So there are no
  views: `mount` accepts a declared capability and rejects anything else, and
  the host renders through `provider()`. The per-capability developer-owned
  surface is the query document.
- **No HTTP client, and no async runtime.** `std` has no HTTP client, and
  choosing reqwest or hyper would choose tokio for every host with it. The
  query path goes through an injected `MfeTransport` trait; without one, `query`
  answers with an error naming `MfeDependencies.transport`. Futures are
  executor-agnostic, and a std-only `block_on` ships for synchronous hosts and
  the generated tests. Dependencies are `serde` and `serde_json` only.
- **No build-time manifest step.** The Swift lane re-derives
  `ManifestMetadata` through an SPM build-tool plugin on every `swift build`.
  A Cargo `build.rs` doing the same would put a JSON parser in every host's
  build graph to reproduce a file `check:mfe-drift:check` already proves
  matches the manifest. So `platform/manifest_metadata.rs` is rendered at
  generation time and is generator-owned, and no `mfe-manifest.json`
  projection is emitted.

### 5. Ownership follows the web lane's split, with two deliberate exceptions

`src/platform/**`, `src/features/mod.rs` and `tests/lifecycle.rs` are
generator-owned; `Cargo.toml`, `README.md`, `src/lib.rs` and each
`src/features/<cap>_query.rs` are developer-owned. `lib.rs` is the developer's
because it only declares `platform` and `features`, which always exist, and a
developer must be able to add modules. `features/mod.rs` is the generator's so
a capability added to the manifest is declared the moment its document is
seeded.

That leaves one generator→developer coupling, the same one ADR-096 §7 accepted
for Swift: the generated `bff_data_provider.rs` reads
`crate::features::<cap>_query::DOCUMENT`. `mfe:validate` backstops it with
`rust-capability-query`, which names the missing file and the fix. The
capability-to-module rule (`snakeCase`) lives in `@seans-mfe/codegen` so the
generator and the rule cannot disagree about the file name.

### 6. Generator-owned code is out of rustfmt's reach

`src/lib.rs` marks `pub mod platform;` with `#[rustfmt::skip]`, and
`tests/lifecycle.rs` wraps its body in a `#[rustfmt::skip]` module. Otherwise a
developer running `cargo fmt` rewrites generator-owned files, and
`check:mfe-drift` reports drift nobody authored. Reproducing rustfmt's
width heuristics in EJS was the alternative, and it would have broken on the
first long capability name.

### 7. The crate is compiled, tested, linted and format-checked in CI

`npm run check:rust-build` runs `cargo build` and `cargo test` with warnings as
errors, `cargo clippy`, and `cargo fmt --check` against every committed
`examples/**/rust/` crate; the `rust` CI job runs it with `--require`, then
builds and tests again on Rust 1.75 because the generated `Cargo.toml` declares
`rust-version = "1.75"` (`1.85` for edition 2024). `cargo test` runs the
generated `tests/lifecycle.rs`, which *executes* the state machine, the
manifest hooks and both query error policies. The Swift lane added its gate
after two type errors got through; this one ships with the lane.

## Boundaries

- **Not WASM, and not a Rust BFF.** Both are open. WASM delivery needs a
  decision about how the web shell mounts a non-JS remote; a Rust BFF needs one
  about replacing the Mesh-composed GraphQL server. Neither follows from this.
- **No dynamic loading.** Rust has no stable ABI, so a crate is linked into its
  host at build time. `load` validates the capability table and moves to
  `ready` — no acquisition step at all, where Swift at least has
  `Bundle.load()`. ADR-096 §2's argument (acquisition was never one of the ten)
  is what makes that honest rather than vacuous.
- **`emit` and `updateControlPlaneState` fail rather than answer**, exactly as
  in the Swift lane: there is no native telemetry or control-plane transport.
- **No native platform handler library** (ADR-098 §Boundaries, unchanged).
- **No typed GraphQL.** Documents and `<Cap>Outputs` are the developer's; the
  schema does not exist until Mesh composes it.
- **The BFF endpoint is baked only when there is a BFF.** The render model
  composes an endpoint for every manifest; the Rust lane passes it through
  only when `data:` is declared, so `query` on an MFE without one answers
  ADR-070's no-data result instead of dialing an endpoint that was never
  generated. The Swift lane's projection passes it through unconditionally —
  observed while writing this, not changed here.
- **The MSRV is a promise the gate checks, not one it can keep.** A serde
  release can raise the floor with no change in this repository; the CI step
  fails when it does, and the fix is to raise `rust-version`, not to pin serde.

## Consequences

Better: PDR-002 has a second non-web language, and the first whose standard
library supplied no default for a UI, a transport or an executor — so each of
those seams had to be named rather than filled. The contract crossed intact;
what did not cross is, again, delivery machinery.

Worse, and accepted:

- **One more copy of the orchestration per MFE.** `mfe_base.rs` is the largest
  generated file, as `MFEBase.swift` is in the Swift lane — the cost of
  rendering a base per package rather than publishing a runtime crate. A
  published `seans-mfe-runtime` crate is the alternative, and would need its
  own versioning story against the TypeScript runtime.
- **A host must write a transport.** Ten lines for reqwest (the generated
  README has them), but a step the Swift lane does not require.
- **No view layer means `render` proves less.** It validates the capability id
  and records the mount; what the host draws is the host's.

## References

- ADR-001 — the lifecycle re-entrancy guard, rendered as a capability+phase stack that skips.
- ADR-002 — the before/main/after/error hook model the crate's engine renders.
- ADR-053 — BFF endpoint resolution order, as `do_query` applies it.
- ADR-070 — the uniform no-data answer from `query` when there is no endpoint.
- ADR-079 — `invoke_handler` as the only substitution seam.
- ADR-080 — the platform contract has one source; the crate renders from it.
- ADR-082 — platform migrations for developer-owned files; a new target adds files and migrates none.
- ADR-095 — secondary build targets as FileContributors; this is the second one.
- ADR-096 — the native lifecycle contract; this renders it into a second language.
- ADR-097 — one plugin carries a target's build lifecycle and codegen.
- ADR-098 — native lifecycle hooks and the pipeline order this crate keeps.

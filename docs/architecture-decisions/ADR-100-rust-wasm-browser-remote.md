---
id: 0100
title: >-
  The Rust target's browser build is a Module Federation remote exposing the ADR-056 imperative
  handle — a WebAssembly MFE needs no shell, runtime or control-plane change
status: Implemented
date: 2026-09-24
deciders: [sean]
area: Codegen / targets / delivery
enforcement: code
tags: [codegen, native, rust, wasm, delivery, module-federation, presentation]
relates-to: [55, 56, 82, 95, 96, 99]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/framework-rust/src/codegen.ts
  - packages/framework-rust/src/plugin.ts
  - packages/framework-rust/templates/web/www/remoteEntry.js.ejs
  - packages/framework-rust/templates/web/src/platform/mod.rs.ejs
  - packages/dsl/src/schema.ts
  - packages/codegen/src/validate.ts
  - scripts/check-rust-wasm.sh
  - scripts/check-rust-wasm-mount.mjs
verified-by:
  - packages/framework-rust/src/__tests__/rust-contributor.test.ts
  - packages/codegen/src/__tests__/rust-capability-query.test.ts
  - packages/dsl/src/__tests__/schema.rust-target.test.ts
  - check:rust-wasm
summary: >-
  `targets.rust.wasm: true` adds a second crate, `rust/web/`, compiled to WebAssembly and shipped
  with a hand-written `remoteEntry.js` that registers a Module Federation container under its own
  scope and exposes `./App` as the ADR-056 imperative handle. The shell's existing
  `moduleFederationAdaptor` loads and mounts it exactly as it mounts a React or Angular remote, so
  a Rust-rendered capability shares a page with React ones and nothing in the runtime, the shell
  or the control plane changes. Each capability draws through a developer-owned web-sys `render`.
rationale-summary: >-
  The adaptor never needed to know a remote's framework — ADR-055/056 made the imperative handle
  the universal port — so the only thing a WebAssembly MFE lacked was a container that speaks it.
  Writing that container by hand is thirty lines; a new `wasm` contentType adaptor would have
  changed the package every generated MFE imports and required every shell to upgrade to use it.
long-form: true
---

## Context

ADR-099 generated a Rust library crate for native hosts and named WebAssembly
delivery as open. The question it left was how a Rust-rendered capability
reaches the **browser shell**, next to React remotes.

Reading the shell's loading path settled most of it. `moduleFederationAdaptor`
in `packages/runtime/src/layout-adaptors.ts` does four things: inject the
placement's `remoteEntryUrl` as a script, read the container from
`globalThis[scope]`, call `init(shareScope)` then `get(module)`, and mount the
exposed `handles.imperative` — `mount(element, { capability, props }) →
unmount`, which may be async (ADR-056). At no point does it ask what language
or framework produced the remote. That neutrality is the point of ADR-056's
"imperative floor".

## Decision

### 1. The browser build is a remote, not a new kind of content

A WebAssembly MFE is delivered as a Module Federation remote whose exposed
`./App` is an `ImperativeMountHandle` (`kind: 'imperative-dom'`,
`framework: 'rust-wasm'`). Registration uses the existing fields —
`remoteEntryUrl`, `moduleFederation.scope`, `moduleFederation.module: './App'`
— so the registry, daemon and shell are unchanged.

A `wasm` contentType adaptor was the alternative. It would change
`packages/runtime/src`, which every generated MFE imports (ADR-082 scope), and
a shell would need upgrading before it could mount one. The remote route needs
neither, and it is the route ADR-055 anticipated when it made adaptors
per-delivery-mechanism: the delivery mechanism here *is* Module Federation.

### 2. The container is hand-written, not bundled

`rust/web/www/remoteEntry.js` is a generator-owned script of about thirty lines
that assigns `globalThis[scope] = { init, get }`. `get('./App')` returns the
handle; the handle's first `mount` dynamically imports the wasm-bindgen
`--target web` output from `pkg/` beside it. No rspack or webpack runs, so the
Rust lane has no Node build. `init` accepts the share scope and ignores it:
the .wasm links its own dependencies (ADR-096 §4).

The scope is `<lib>_wasm`, deliberately not the React remote's `<lib>`: a
container is a page global keyed by scope, and both builds of one MFE must be
able to share a page.

### 3. It is a feature of the Rust target, in a second crate

`targets.rust.wasm: true` (default `false`) adds `rust/web/`, a `cdylib` crate
depending on the native crate by path. A second crate rather than a feature
flag on the first, because the native `rust/Cargo.toml` is developer-owned:
regeneration could never add `wasm-bindgen` and `web-sys` to an existing one.
Enabling the browser build therefore adds files and changes none.

### 4. The contract runs in the browser

The generated `platform::mount` export runs `load` when the instance is not
ready, then `render` for the capability — state guard, transitions and
manifest hooks included (ADR-098) — and only then calls the capability's
developer-owned `features::<cap>::render(element, props)`. One instance per
page, as in the web lane. The native crate becomes wasm32-safe for this:
`SystemTime::now()` and `Instant::now()` panic on `wasm32-unknown-unknown`, so
`StateTransition.at` is `Option<SystemTime>` (`None` without a clock) and
`load`'s duration is measured only where there is one.

### 5. The UI is plain web-sys, and the developer's

Each capability's renderer is seeded once with `web-sys` DOM calls, so the
generator picks no Rust UI framework. A team can use Leptos, Yew or Dioxus
inside its own `render`; the platform only calls the function.
`rust-capability-view` in `mfe:validate` backstops a deleted renderer, as
`rust-capability-query` does for a query document (ADR-099 §5).

### 6. The claim is proven by the shell's own code

`check:rust-wasm` builds every `examples/**/rust/web` crate for wasm32 (clippy,
fmt, `build.sh`), then `check-rust-wasm-mount.mjs` loads the **compiled**
`dist/runtime/layout-adaptors.js` into Chromium through a small CommonJS
loader and mounts each capability through `moduleFederationAdaptor`. It checks
the renderer drew, two capabilities mount side by side, unmount empties the
slot, and an unknown capability is rejected. Breaking the remote's scope fails
it with the shell's own `Remote container … not found`. The `rust-wasm` CI job
runs it with `--require`, then builds on Rust 1.77, the web crate's declared
MSRV (wasm-bindgen 0.2.128 needs 1.77, not the native crate's 1.75).

## Boundaries

- **No data fetching in the browser yet.** The native `MfeTransport` trait
  requires `Send` futures, and browser `fetch` futures are not `Send`. The
  browser build starts with a provider that answers every capability's empty
  `Outputs`; a capability that needs data fetches it in its own `render`. A
  fetch-backed transport needs a decision about `Send` bounds on wasm32.
- **The fleet does not place it yet.** The composition compiler derives one
  registration per manifest, so `meridian-crew-services`'s WASM remote is not
  in `rules.json`. Placing both builds of one MFE raises a real routing
  question — which registration serves `PayStatus` when two can — that this
  ADR does not answer. Registering it by hand works today.
- **`wasm-bindgen` is pinned exactly** (`=0.2.128`), because its CLI must be
  the same version as the crate. `build.sh` checks and names the install
  command on a mismatch. Bumping it means bumping the CLI in CI too.
- **No native-component handle.** Only the imperative floor is exposed; a
  React host cannot render it in-tree (ADR-056's optional upgrade).

## Consequences

Better: a Rust-rendered capability can sit on a page next to React ones today,
through code the shell already runs, with no platform upgrade for anyone. And
it is a second, independent confirmation of ADR-056: the imperative handle
really is framework-neutral — it carried a language the runtime has never
heard of.

Worse, and accepted:

- **A hand-written container** means Module Federation features beyond
  `init`/`get` — shared-scope negotiation, version checks — are absent. None
  applies to a self-contained .wasm, but it is a second implementation of the
  container protocol to keep in step with the shell's loader.
- **Two toolchain pins** (wasm32 target, wasm-bindgen CLI) on anyone building
  the browser remote.
- **About 210 KB of wasm** for the example before any optimisation (`wasm-opt`
  is not run).

## References

- ADR-055 — the LayoutManager's slot composition and its per-content-type adaptors; the Module Federation adaptor is used unchanged.
- ADR-056 — the MFE presentation boundary and its imperative handle; the WASM remote exposes exactly that handle.
- ADR-082 — why a runtime adaptor was the costlier option: runtime changes reach generated code.
- ADR-095 — secondary build targets; the browser build is part of the Rust one.
- ADR-096 — the native contract; its §4 asymmetry is why `init` ignores the share scope.
- ADR-099 — the Rust target this extends.

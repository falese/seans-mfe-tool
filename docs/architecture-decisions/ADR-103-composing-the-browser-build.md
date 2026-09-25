---
id: 0103
title: >-
  A manifest's browser build registers as `<name>-wasm`, served by the MFE's own server under
  `/wasm/` — placements stay on the web build unless `from` names the browser build
status: Implemented
date: 2026-09-24
deciders: [sean]
area: Control plane / composition / targets
enforcement: code
tags: [control-plane, composition, wasm, rust, registration, bff, docker]
relates-to: [55, 56, 74, 83, 99, 100, 101]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/dsl/src/browser-build.ts
  - packages/dsl/src/control-plane-compiler.ts
  - packages/codegen/src/render-model.ts
  - packages/plugin-bff/templates/server.ts.ejs
  - packages/plugin-bff/templates/Dockerfile.ejs
  - packages/framework-rust/src/codegen.ts
verified-by:
  - packages/dsl/src/__tests__/browser-build.test.ts
  - packages/dsl/src/__tests__/control-plane-compiler.test.ts
  - packages/dsl/src/__tests__/control-plane-fleet-equivalence.test.ts
  - packages/plugin-bff/src/__tests__/browser-build-serving.test.ts
  - check:mfe-drift:check
summary: >-
  The composition compiler derives a second registration for a manifest with `targets.rust.wasm`:
  `<name>-wasm`, scope `<crate>_wasm`, remote entry `<endpoint>/wasm/remoteEntry.js`, the web
  build's platform capabilities, no slots. An unqualified placement still resolves to the web
  build, so no existing composition changes; `from: <name>-wasm` places the Rust build instead.
  The MFE's generated `server.ts` serves `rust/web/www` under `/wasm/`, its Dockerfile builds it in
  a `wasm-builder` stage, and the crate name and scope rules move to `@seans-mfe/dsl` so the
  compiler and the Rust codegen read one definition. Meridian's `PayStatus` is now placed from the
  Rust build.
rationale-summary: >-
  ADR-100 left the fleet unable to place a browser build: one registration per manifest, and the
  question "which registration serves `PayStatus` when two can" unanswered. Treating the second
  build as ambiguous would have forced a `from` onto every existing placement of every capability
  a Rust target also implements, for no gain — the web build is the manifest's primary build
  (ADR-095 §6), and a second build of the same MFE is a delivery choice, not a competing provider.
  So the default stays where it was and the choice is opt-in, with the existing `from` field
  rather than a new one. Serving from the MFE's own origin keeps it one deployable, the rule
  ADR-012's BFF already follows.
long-form: true
---

## Context

ADR-100 made the Rust target's browser build a Module Federation remote, and
ADR-101 made it a complete MFE: all ten capabilities, `query` over `fetch`.
Its §Boundaries recorded what was still missing:

> **The fleet does not place it yet.** The composition compiler derives one
> registration per manifest, so `meridian-crew-services`'s WASM remote is not
> in `rules.json`. Placing both builds of one MFE raises a real routing
> question — which registration serves `PayStatus` when two can — that this
> ADR does not answer. Registering it by hand works today.

Registering it by hand meant a second, hand-written `rules.json` and a static
server on a port nothing else knew. That is how the first demo ran, and it is
the kind of artifact ADR-083 exists to remove.

Three things had to be decided together, because each constrains the others:
what the second build is called, where it is served, and which build an
unqualified placement means.

## Decision

**A manifest with `targets.rust.wasm` has two registrations. The web build
keeps its name and remains what an unqualified placement means; the browser
build is `<name>-wasm`, and a placement uses it only when `from` names it.**

### 1. Naming and resolution

`compileControlPlane` derives, right after each such manifest's own
registration, a second one (`deriveBrowserRegistration`):

| Field | Browser build |
|---|---|
| `name` | `<name>-wasm` |
| `moduleFederation.scope` | `<crate>_wasm` — the scope the generated `remoteEntry.js` registers (ADR-100) |
| `moduleFederation.module` | `./App` |
| `remoteEntryUrl` | `<endpoint>/wasm/remoteEntry.js` |
| `capabilities`, `version`, `type`, `baseUrl`, `contentType` | the web build's |
| `providesSlots` | none — the Rust renderers host no children |

A placement with no `from` resolves exactly as before: the browser build is
not a candidate, so a capability both builds implement is not ambiguous.
`from: <name>-wasm` resolves to the browser build, and fails with
`unknown-capability` when `targets.rust.capabilities` leaves the capability
out.

### 2. Served by the MFE's own server

The generated `server.ts` (generator-owned, plugin-bff) mounts
`rust/web/www` at `/wasm` before its SPA fallback, which would otherwise
answer a missing `.wasm` with `index.html`. The seeded Dockerfile gains a
`wasm-builder` stage that runs `rust/web/build.sh` and copies `www/` into the
image; the wasm-bindgen CLI version is read from the crate's lockfile, not
restated. `.dockerignore` (generator-owned) keeps the host's Cargo output out
of the build context. All three are conditional on `targets.rust.wasm`: an MFE
without it generates byte-identical files.

### 3. One naming rule, below both sides

`rustCrateName` and `rustWasmScope` move to `@seans-mfe/dsl`
(`browser-build.ts`). The compiler reads them to write `rules.json`; the Rust
codegen reads them, through `@seans-mfe/codegen`, to write `remoteEntry.js`.
A disagreement between the two would be ADR-074's
`Module "./App" does not exist in container` — reported by neither side.

## Boundaries

- **No new schema field.** `from` already existed for disambiguation (ADR-083);
  a `target:` field was considered and rejected as a second way to say it.
- **The web build is the default because it is the primary build** (ADR-095
  §6), not because it is better. A fleet that wants the Rust build everywhere
  writes `from` on each placement; there is no fleet-wide switch.
- **Only the Rust target has a browser build.** The Swift target has none, so
  nothing here applies to it.
- **`/wasm/` is fixed**, not configurable per manifest. `BROWSER_BUILD_PATH`
  is the one place to change it.
- **Only the MFE's own server serves it.** An MFE with no `data:` section has
  no generated `server.ts`; its browser build is registered at the same URL,
  and serving it there is the deployer's job, as the web remote's is.

## Consequences

Better: the Rust build is composed from the committed `control-plane.yaml`
like every other capability, validated by `compose:validate --check`, and
deployed by the fleet's own images. Meridian's `meridian.open.crew` now puts
the React roster in `main` and the Rust `PayStatus` in `status` from one
state key.

Worse, and accepted:

- **A Rust toolchain in the image build** for any MFE with a browser build:
  `rust:1-slim` plus a one-off `cargo install wasm-bindgen-cli`, which adds
  minutes to the first build. Cargo's registry is a BuildKit cache mount, so
  later builds reuse the downloads.
- **Two registrations for one manifest**, so the registry's MFE count is no
  longer the fleet's manifest count. `compose:build` reports the registration
  count.
- **A generator-owned file changed for one example.** `server.ts` and
  `.dockerignore` are regenerated by `check:mfe-drift`; no developer-owned
  file names anything this changes, so no `PLATFORM_MIGRATIONS` entry is
  needed (ADR-082). The Dockerfile is developer-owned: existing MFEs that
  enable `targets.rust.wasm` add the stage by hand, as Meridian's did.

## References

- ADR-055 — the LayoutManager's slot composition and its per-content-type adaptors; the browser build mounts through the Module Federation one.
- ADR-056 — the MFE presentation boundary and its imperative handle, which the browser build's `./App` exposes.
- ADR-074 — registration fields are derived from the manifest; this derives a second set.
- ADR-083 — the composition document and its compiler, whose `from` this reuses.
- ADR-099 — the Rust target.
- ADR-100 — the browser build; its "fleet does not place it yet" boundary no longer holds.
- ADR-101 — the browser build implements all ten capabilities, including `query`, which its renderers use.

# meridian-crew-services-web — the browser build

Seeded once by `seans-mfe-tool`, then yours.

The crate one directory up, compiled to WebAssembly and served as a **Module
Federation remote** (ADR-100). The shell mounts it through the same imperative
handle it uses for React and Angular remotes, so a placement can put a
Rust-rendered capability on the page next to React ones.

## Build and serve

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128   # must match Cargo.toml's pin
bash build.sh
```

`build.sh` leaves a servable `www/`. If this MFE has a BFF, its generated
`server.ts` serves `www/` at `/wasm/` and the seeded Dockerfile builds it —
nothing else to run. Place it from the fleet's `control-plane.yaml` with
`from: meridian-crew-services-wasm` (ADR-103); the compiler registers it with scope
`meridian_crew_services_wasm`, module `./App`, and `<endpoint>/wasm/remoteEntry.js`. The
scope differs from the React build's (`meridian_crew_services`) so both can be on one
page, and a placement without `from` stays on the React build.

## What is yours

| Path | Owner |
|---|---|
| `src/features/<capability>.rs` — each capability's `render` | **You** |
| `Cargo.toml`, `src/lib.rs`, this README | **You**, seeded once |
| `src/platform/`, `src/features/mod.rs`, `www/remoteEntry.js`, `build.sh` | The generator |

`render` gets the slot element and the placement's props. It is plain
`web-sys`; use a UI framework inside it if you want one.

## What the browser build supplies

The same ten capabilities as the native crate, with the browser filling in
what a native host would inject (ADR-101):

- **`query`** and the generated data provider reach the BFF through `fetch`.
- **`updateControlPlaneState`** pushes state through the daemon channel the
  shell hands every slot (ADR-057) — the shell's adaptor calls
  `mfe.attachControlPlane` for you.
- **`emit`** forwards to a function you attach with `mfe.attachTelemetry(fn)`;
  until you do, it answers `emitted: false`.

The remote entry also exposes those capabilities as `mfe.load(context)`,
`mfe.health(context)`, … — the same surface a TypeScript MFE has. From inside
a capability's `render`, `crate::platform::mfe()` is this page's instance.

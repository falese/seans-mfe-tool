# meridian-crew-services — native Rust target

Seeded once by `seans-mfe-tool`, then yours.

This Cargo crate is a **second build of the same MFE**. It and the web
Module Federation remote beside it are generated from one
`mfe-manifest.yaml`: same capabilities, same lifecycle contract, two
independently buildable artifacts (ADR-095, ADR-099).

## Build

```sh
cargo build
cargo test
```

The crate depends on `serde` and `serde_json` and nothing else — no async
runtime and no HTTP client. Its futures run on whatever executor your host
already uses; `block_on` is included for synchronous hosts.

## Using it from a host

```rust,ignore
use std::sync::Arc;
use meridian_crew_services::*;

// The BFF-backed provider, over a transport you supply (see below).
let mfe = MeridianCrewServicesMfe::with_transport(Arc::new(MyTransport::new()), MfeDependencies::default());
mfe.load(MfeContext::new()).await?;
mfe.render(MfeContext::new().with_capability_id("CrewRoster")).await?;
```

### Supplying a transport

The standard library has no HTTP client, and picking one here would pick an
async runtime for you. So the `query` capability and the generated BFF client
POST through an `MfeTransport` you inject. With `reqwest`:

```rust,ignore
struct Reqwest(reqwest::Client);

impl MfeTransport for Reqwest {
    fn post(&self, request: HttpRequest) -> BoxFuture<'_, Result<HttpResponse, MfeError>> {
        Box::pin(async move {
            let mut builder = self.0.post(&request.url).body(request.body);
            for (name, value) in &request.headers {
                builder = builder.header(name, value);
            }
            let response = builder
                .send()
                .await
                .map_err(|e| MfeError::Transport { message: e.to_string(), status: None })?;
            let status = response.status().as_u16();
            let body = response
                .bytes()
                .await
                .map_err(|e| MfeError::Transport { message: e.to_string(), status: Some(status) })?;
            Ok(HttpResponse { status, body: body.to_vec() })
        })
    }
}
```

Without one, `query` answers with an error naming `MfeDependencies.transport`
rather than failing silently.

### Manifest lifecycle hooks

Rust cannot look a method up by name, so a manifest hook such as
`handler: onLoadBegin` resolves through `MfeDependencies.custom_handlers`
(ADR-098 §3). The generated crate registers a no-op stub for every handler the
manifest names; supply your own under the same key to replace it:

```rust,ignore
let mut deps = MfeDependencies::default();
deps.custom_handlers.insert("onLoadBegin".into(), handler(|ctx| async move {
    println!("loading {}", ctx.request_id);
    Ok(())
}));
```

## What is yours and what is not

| Path | Owner |
|---|---|
| `src/features/*_query.rs`, `src/lib.rs` | **You.** Seeded once, never rewritten. |
| `Cargo.toml`, this README | **You.** Seeded once. |
| `src/platform/**`, `src/features/mod.rs`, `tests/lifecycle.rs` | The generator. Re-stamped on every run. |

## How it relates to the web build

`MeridianCrewServicesMfe` is `MfeBase<MeridianCrewServicesNative>`: the ten platform
capabilities, orchestrated by `MfeBase` (the rendering of `BaseMFE`), over
native `do_*` hooks. It sits beside `RemoteMFE` (React), `AngularRemoteMFE`
(Angular) and the Swift lane's `<Module>MFE` as one more concrete MFE over the
same contract.

What does not cross is the federation machinery: there is no remote entry to
fetch (the crate is linked into its host at build time) and no shared scope to
negotiate (Cargo resolves one copy). `load` validates the capability table and
moves to `ready` — which is what the contract's *"connect, warm caches,
validate config"* always meant.

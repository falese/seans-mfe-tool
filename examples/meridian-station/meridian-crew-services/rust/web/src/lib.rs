//! meridian-crew-services in the browser — the WebAssembly build (ADR-100).
//!
//! Seeded once by seans-mfe-tool, then yours. `platform` is generator-owned
//! (the wasm-bindgen exports the shell's remote entry calls); `features` holds
//! one `render` per capability, and those are yours.

pub mod crew;
pub mod features;

// Generator-owned, so regeneration owns its layout rather than rustfmt:
// formatting it would read as drift to `check:mfe-drift`. Keep the attribute.
#[rustfmt::skip]
pub mod platform;

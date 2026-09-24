#!/usr/bin/env bash
#
# Build every generated Rust browser remote and mount it through the shell's
# own adaptor in a real browser (ADR-100).
#
# Per examples/**/rust/web crate:
#   cargo clippy --target wasm32-unknown-unknown -D warnings
#   cargo fmt --check
#   bash build.sh             — cargo build (wasm32) + wasm-bindgen → www/pkg
# then, once for all of them:
#   node scripts/check-rust-wasm-mount.mjs — Chromium loads the COMPILED
#   dist/runtime/layout-adaptors.js and mounts each capability through
#   moduleFederationAdaptor, the path the shell takes for any remote
#
# `check:rust-build` covers the native crate; this covers what only a wasm32
# build and a browser can: that the remote compiles for the browser at all,
# and that the shell can mount it without knowing it is Rust.
#
# Needs `npm run build` first (the probe loads dist/runtime). Skips with a
# notice when the wasm32 target, wasm-bindgen or a browser is missing;
# --require makes any of those a failure — CI does.
set -euo pipefail

REQUIRE=0
[[ "${1:-}" == "--require" ]] && REQUIRE=1

missing() {
  if [[ $REQUIRE -eq 1 ]]; then
    echo "check:rust-wasm: $1, and --require was passed." >&2
    exit 1
  fi
  echo "check:rust-wasm: SKIPPED — $1."
  exit 0
}

command -v cargo >/dev/null 2>&1 || missing "no cargo on PATH"
rustup target list --installed 2>/dev/null | grep -qx wasm32-unknown-unknown ||
  missing "the wasm32-unknown-unknown target is not installed (rustup target add wasm32-unknown-unknown)"
command -v wasm-bindgen >/dev/null 2>&1 || missing "no wasm-bindgen CLI on PATH (cargo install wasm-bindgen-cli --version 0.2.128)"

mapfile -t CRATES < <(find examples -type f -name Cargo.toml -path '*/rust/web/*' -not -path '*/target/*' | sort)
if [[ ${#CRATES[@]} -eq 0 ]]; then
  echo "check:rust-wasm: no generated rust/web crates found under examples/." >&2
  exit 1
fi

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-${TMPDIR:-/tmp}/seans-mfe-tool-rust-wasm-target}"

FAILED=0
for manifest in "${CRATES[@]}"; do
  dir="$(dirname "$manifest")"
  echo ""
  echo "=== $dir"
  if ! cargo clippy --manifest-path "$manifest" --target wasm32-unknown-unknown --all-targets -- -D warnings; then
    echo "check:rust-wasm: CLIPPY FAILED in $dir" >&2
    FAILED=1
    continue
  fi
  if ! cargo fmt --manifest-path "$manifest" --check; then
    echo "check:rust-wasm: FORMAT CHECK FAILED in $dir" >&2
    FAILED=1
  fi
  if ! bash "$dir/build.sh"; then
    echo "check:rust-wasm: BUILD FAILED in $dir" >&2
    FAILED=1
  fi
done
[[ $FAILED -eq 0 ]] || { echo "check:rust-wasm: FAILURES above." >&2; exit 1; }

MOUNT_ARGS=()
[[ $REQUIRE -eq 1 ]] && MOUNT_ARGS+=(--require)
node scripts/check-rust-wasm-mount.mjs "${MOUNT_ARGS[@]}"

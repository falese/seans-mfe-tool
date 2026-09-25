#!/usr/bin/env bash
#
# Compile, lint and test every generated Rust crate in examples/ (ADR-099).
#
# WHY THIS EXISTS. Every Node-side assertion about the Rust lane is a text
# assertion: it can see that the right symbols were rendered, not that they
# type-check. The Swift lane measured what that costs — two type errors reached
# commits before `check:swift-build` existed (ADR-096 §Boundaries). This is the
# Rust lane's gate from day one.
#
# WHAT IT RUNS, per crate:
#   cargo build            — the platform layer compiles, warnings are errors
#   cargo test             — the generated tests/lifecycle.rs RUNS the contract:
#                            state machine, hook engine, both query policies
#   cargo clippy -D warnings
#   cargo fmt --check      — generator-owned code is behind #[rustfmt::skip],
#                            so this proves developer-owned seeds are formatted
#                            and that `cargo fmt` cannot cause drift
#
# Unlike the Swift gate there is no UI half left uncovered: the crate ships no
# UI, so this compiles everything the generator emits.
#
# The crates built are the COMMITTED ones. `check:mfe-drift:check` proves those
# match what the generator would emit, so building them is building generator
# output.
#
# Skips with a notice when there is no toolchain. Pass --require to make a
# missing toolchain (or a missing clippy/rustfmt component) a failure — CI does.
set -euo pipefail

REQUIRE=0
[[ "${1:-}" == "--require" ]] && REQUIRE=1

if ! command -v cargo >/dev/null 2>&1; then
  if [[ $REQUIRE -eq 1 ]]; then
    echo "check:rust-build: no cargo on PATH, and --require was passed." >&2
    exit 1
  fi
  echo "check:rust-build: SKIPPED — no Rust toolchain on PATH."
  echo "  Install one with https://rustup.rs, or let CI run it."
  exit 0
fi

echo "check:rust-build: $(cargo --version)"

HAVE_CLIPPY=1
HAVE_FMT=1
cargo clippy --version >/dev/null 2>&1 || HAVE_CLIPPY=0
cargo fmt --version >/dev/null 2>&1 || HAVE_FMT=0
if [[ $REQUIRE -eq 1 && ( $HAVE_CLIPPY -eq 0 || $HAVE_FMT -eq 0 ) ]]; then
  echo "check:rust-build: clippy and rustfmt are required with --require (rustup component add clippy rustfmt)." >&2
  exit 1
fi
[[ $HAVE_CLIPPY -eq 0 ]] && echo "check:rust-build: clippy not installed — lint step SKIPPED."
[[ $HAVE_FMT -eq 0 ]] && echo "check:rust-build: rustfmt not installed — format step SKIPPED."

# rust/web is the browser build (ADR-100), checked for wasm32 by check:rust-wasm.
mapfile -t CRATES < <(find examples -type f -name Cargo.toml -path '*/rust/*' -not -path '*/rust/web/*' -not -path '*/target/*' | sort)

if [[ ${#CRATES[@]} -eq 0 ]]; then
  echo "check:rust-build: no generated Rust crates found under examples/." >&2
  # A repo that ships a Rust target and then stops generating one should fail
  # here rather than pass vacuously.
  exit 1
fi

# One shared target dir: every crate has the same two dependencies, so they
# are compiled once rather than once per crate. Outside the repo, so no build
# output lands beside the committed sources.
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-${TMPDIR:-/tmp}/seans-mfe-tool-rust-target}"
export RUSTFLAGS="${RUSTFLAGS:-} -D warnings"

FAILED=0
for manifest in "${CRATES[@]}"; do
  dir="$(dirname "$manifest")"
  echo ""
  echo "=== $dir"

  if ! cargo build --manifest-path "$manifest"; then
    echo "check:rust-build: BUILD FAILED in $dir" >&2
    FAILED=1
    continue
  fi

  if ! cargo test --manifest-path "$manifest"; then
    echo "check:rust-build: TESTS FAILED in $dir" >&2
    FAILED=1
  fi

  if [[ $HAVE_CLIPPY -eq 1 ]] && ! cargo clippy --manifest-path "$manifest" --all-targets; then
    echo "check:rust-build: CLIPPY FAILED in $dir" >&2
    FAILED=1
  fi

  if [[ $HAVE_FMT -eq 1 ]] && ! cargo fmt --manifest-path "$manifest" --check; then
    echo "check:rust-build: FORMAT CHECK FAILED in $dir" >&2
    FAILED=1
  fi
done

echo ""
if [[ $FAILED -ne 0 ]]; then
  echo "check:rust-build: ${#CRATES[@]} crate(s) checked — FAILURES above." >&2
  exit 1
fi
echo "check:rust-build: ${#CRATES[@]} crate(s) built, tested, linted and format-checked."

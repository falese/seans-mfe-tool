#!/usr/bin/env bash
#
# Compile and test every generated Swift package in examples/ (ADR-096, ADR-098).
#
# WHY THIS EXISTS. Until this gate, nothing compiled the emitted Swift. The pin
# and contributor suites assert the RENDERING — that the right symbols appear in
# the right order — which is a text assertion, not a type check. A typo in a
# template landed green, and two did: `@escaping` inside a typealias (only legal
# in parameter position) and a checked `Sendable` conformance on a struct holding
# an existential `Error`.
#
# WHAT IT DOES NOT COVER. The SwiftUI files sit behind `#if canImport(SwiftUI)`,
# which is false on Linux, so the views are SKIPPED rather than compiled. This
# gate proves the platform layer — MFEBase, NativeMFEBase, MFELifecycle, Types,
# the BFF client and provider — and that is where essentially all the generated
# logic is. The views still need a Mac.
#
# The packages built are the COMMITTED ones. `check:mfe-drift:check` already
# proves those match what the generator would emit for every generator-owned
# file, so building them is building generator output; the developer-owned
# files (Package.swift, the views, the query documents) are real and compile too.
#
# Skips with a notice when there is no toolchain, so a contributor without Swift
# is not blocked. Pass --require to make a missing toolchain a failure — CI does.
set -euo pipefail

REQUIRE=0
[[ "${1:-}" == "--require" ]] && REQUIRE=1

if ! command -v swift >/dev/null 2>&1; then
  if [[ $REQUIRE -eq 1 ]]; then
    echo "check:swift-build: no Swift toolchain on PATH, and --require was passed." >&2
    exit 1
  fi
  echo "check:swift-build: SKIPPED — no Swift toolchain on PATH."
  echo "  Install one from https://swift.org/download, or let CI run it."
  exit 0
fi

echo "check:swift-build: $(swift --version 2>&1 | head -1)"

mapfile -t PACKAGES < <(find examples -type f -name Package.swift -path '*/swift/*' | sort)

if [[ ${#PACKAGES[@]} -eq 0 ]]; then
  echo "check:swift-build: no generated Swift packages found under examples/." >&2
  # A repo that ships a Swift target and then stops generating one should fail
  # here rather than pass vacuously.
  exit 1
fi

FAILED=0
for manifest in "${PACKAGES[@]}"; do
  dir="$(dirname "$manifest")"
  echo ""
  echo "=== $dir"

  # The SPM build-tool plugin regenerates ManifestMetadata.swift from
  # mfe-manifest.json on every build (ADR-095), so this exercises that too —
  # the half no Node-side gate can reach.
  if ! swift build --package-path "$dir"; then
    echo "check:swift-build: BUILD FAILED in $dir" >&2
    FAILED=1
    continue
  fi

  if ! swift test --package-path "$dir"; then
    echo "check:swift-build: TESTS FAILED in $dir" >&2
    FAILED=1
  fi
done

echo ""
if [[ $FAILED -ne 0 ]]; then
  echo "check:swift-build: ${#PACKAGES[@]} package(s) checked — FAILURES above." >&2
  exit 1
fi
echo "check:swift-build: ${#PACKAGES[@]} package(s) built and tested."

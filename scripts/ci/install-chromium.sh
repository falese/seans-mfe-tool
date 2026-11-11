#!/usr/bin/env bash
# Install Chromium for Playwright, riding out an apt outage on the runner.
#
# `playwright install --with-deps` downloads the browser from Playwright's CDN
# and fetches system packages with apt. On PR #480 the runners' DNS could not
# resolve the Ubuntu mirror for over half an hour (`Temporary failure resolving
# 'azure.archive.ubuntu.com'`), failing every browser job before a test ran.
#
# 1. Try the full install, retrying with a pause.
# 2. If apt is still unreachable, install the browser alone and check that it
#    launches. On a GitHub runner the libraries Chromium needs are already on
#    the image; what --with-deps adds is fonts, and no job compares
#    screenshots. A browser that cannot install or launch still fails the job.
#
# Every workflow calls this instead of the bare command
# (scripts/__tests__/ci-chromium-install.test.ts holds them to it).
#
#   CHROMIUM_INSTALL_ATTEMPTS  full-install attempts before falling back (default 3)
#   CHROMIUM_INSTALL_DELAY     seconds before the first retry, doubling (default 30)
#   CHROMIUM_VERIFY            command that proves Chromium launches (default: launch it)
set -uo pipefail

attempts="${CHROMIUM_INSTALL_ATTEMPTS:-3}"
delay="${CHROMIUM_INSTALL_DELAY:-30}"
verify="${CHROMIUM_VERIFY:-node -e \"require('@playwright/test').chromium.launch().then((b) => b.close())\"}"

for ((i = 1; i <= attempts; i++)); do
  if npx playwright install --with-deps chromium; then
    exit 0
  fi
  if ((i < attempts)); then
    echo "::warning::Chromium install with system packages failed (attempt $i of $attempts); retrying in ${delay}s"
    sleep "$delay"
    delay=$((delay * 2))
  fi
done

echo "::warning::apt stayed unreachable after $attempts attempts; installing Chromium without its system packages"
if ! npx playwright install chromium; then
  echo "::error::Chromium could not be installed"
  exit 1
fi
if ! bash -c "$verify"; then
  echo "::error::Chromium installed without its system packages but does not launch"
  exit 1
fi
echo "Chromium installed without its system packages, and launches."

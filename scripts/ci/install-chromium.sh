#!/usr/bin/env bash
# Install Chromium and its system packages for Playwright, retrying.
#
# `playwright install --with-deps` fetches system packages with apt. A runner
# whose DNS briefly fails (`Temporary failure resolving 'azure.archive.ubuntu.com'`)
# turns that into a red job before any test runs — three jobs on PR #480 at once.
# Retrying with a pause rides out the blip; a failure that persists still fails
# the job, loudly. Every workflow calls this instead of the bare command
# (scripts/__tests__/ci-chromium-install.test.ts holds them to it).
#
#   CHROMIUM_INSTALL_ATTEMPTS  attempts before giving up (default 3)
#   CHROMIUM_INSTALL_DELAY     seconds before the first retry, doubling (default 30)
set -uo pipefail

attempts="${CHROMIUM_INSTALL_ATTEMPTS:-3}"
delay="${CHROMIUM_INSTALL_DELAY:-30}"

for ((i = 1; i <= attempts; i++)); do
  if npx playwright install --with-deps chromium; then
    exit 0
  fi
  if ((i < attempts)); then
    echo "::warning::Chromium install failed (attempt $i of $attempts); retrying in ${delay}s"
    sleep "$delay"
    delay=$((delay * 2))
  fi
done

echo "::error::Chromium install failed after $attempts attempts"
exit 1

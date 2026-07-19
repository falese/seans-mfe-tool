#!/usr/bin/env bash
# Composes the Meridian console into the empty shell: sends the root state
# change; the registry's root rule resolves the console, which renders the
# domain menu and provides main/status plus the keyed berth strip (ADR-058).
set -euo pipefail
exec "$(dirname "$0")/send-action.sh" meridian.root

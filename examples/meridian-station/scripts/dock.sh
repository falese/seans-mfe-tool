#!/usr/bin/env bash
# Fires the keyed-slot demo for one berth: the registry resolves the
# docking-control BerthTile into meridian-console/berth.<id> (ADR-069).
# Usage: dock.sh <b1..b6>
set -euo pipefail
BERTH=${1:?usage: dock.sh <b1..b6>}
exec "$(dirname "$0")/send-action.sh" "meridian.berth.${BERTH}"

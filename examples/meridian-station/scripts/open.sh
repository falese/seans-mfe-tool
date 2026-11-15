#!/usr/bin/env bash
# Opens a station domain in the console's main region.
# Usage: open.sh <docking|life-support|cargo|crew|concourse|arrivals>
set -euo pipefail
DOMAIN=${1:?usage: open.sh <docking|life-support|cargo|crew|concourse|arrivals>}
exec "$(dirname "$0")/send-action.sh" "meridian.open.${DOMAIN}"

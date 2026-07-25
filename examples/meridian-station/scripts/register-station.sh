#!/usr/bin/env bash
# Registers the Meridian Station MFEs with the control-plane registry
# (ADR-054/055) from control-plane/rules.json.
#
# The rules used to live here as inline JSON inside `curl -d '{...}'` blocks,
# which meant nothing could read them — and so nothing could check them. A rule
# aimed at a renamed or misspelled slot registered happily and then parked
# forever at runtime (ADR-066 waits for a slot that never arrives).
#
# As a committed artifact they are reviewable in a diff and checkable in CI:
#
#   seans-mfe-tool slots:validate --rules control-plane/rules.json --manifests .
#
# validates every resolve.props.slot against the fleet's declared providesSlots
# before anything is deployed (ADR-073).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATION="$(dirname "$HERE")"
RULES="${RULES:-$STATION/control-plane/rules.json}"
REGISTRY=${REGISTRY:-http://localhost:4500}

if [ ! -f "$RULES" ]; then
  echo "rules file not found: $RULES" >&2
  exit 1
fi

count="$(jq 'length' "$RULES")"
for i in $(seq 0 $((count - 1))); do
  doc="$(jq -c ".[$i]" "$RULES")"
  name="$(printf '%s' "$doc" | jq -r '.registration.name')"
  routes="$(printf '%s' "$doc" | jq -r '.routes | length')"
  capabilities="$(printf '%s' "$doc" | jq -r '[.routes[].resolve.capability] | unique | join(", ")')"

  curl -fsS -X POST "$REGISTRY/mfes" \
    -H "Content-Type: application/json" \
    -d "$doc" > /dev/null

  echo " registered $name ($routes route(s): $capabilities)"
done

echo "MFEs registered. Compose the console into the shell with:"
echo "  ./scripts/console.sh"

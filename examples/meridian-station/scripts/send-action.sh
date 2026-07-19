#!/usr/bin/env bash
# Sends one control-plane action (stateKey) through the Meridian daemon —
# the same wire shape the shell's LayoutManager emits (ADR-054/057).
# Usage: send-action.sh <stateKey>
set -euo pipefail
STATE_KEY=${1:?usage: send-action.sh <stateKey>}
DAEMON=${DAEMON:-http://localhost:4504}
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ID="${STATE_KEY//./-}-$(date +%s)"
MSG=$(printf '{"direction":"ACTION","kind":"ACTION","payload":{"id":"%s","componentId":"shell","actionType":"STATE_UPDATE","stateKey":"%s","data":{},"timestamp":"%s","context":{"sessionId":"demo","application":"web"}},"metadata":{"correlationId":"%s","acknowledged":false,"error":null}}' "$ID" "$STATE_KEY" "$NOW" "$ID")
curl -fsS -X POST "$DAEMON/graphql" -H 'Content-Type: application/json' \
  --data "$(printf '{"query":"mutation($m:String!){sendMessage(message:$m)}","variables":{"m":%s}}' "$(printf '%s' "$MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"
echo " -> action sent (${STATE_KEY})"

#!/usr/bin/env bash
# Boots the whole Meridian Station stack locally, no docker: three APIs,
# control plane, six MFE servers, shell. Idempotent — kills whatever holds
# each port first. Build the repo (npm run build) and each MFE's dist
# before running; see STATION-DEMO.md for the full runbook.
#
# The BFF upstreams address APIs by compose service name (the specs'
# servers: entries), so local runs need those names to resolve to
# localhost — add once:
#   echo "127.0.0.1 harbormaster-api stellar-ledger-api station-os-api" | sudo tee -a /etc/hosts
set -uo pipefail
STATION="$(cd "$(dirname "$0")/.." && pwd)"
LOGS=${LOGS:-/tmp/meridian-logs}
mkdir -p "$LOGS"

free_port() {
  local pid
  pid=$(fuser "$1"/tcp 2>/dev/null | tr -d ' ')
  [ -n "$pid" ] && kill "$pid" 2>/dev/null && sleep 0.5
  return 0
}

echo "── APIs ────────────────────────────────────────────────"
for entry in "harbormaster-api:5101" "stellar-ledger-api:5102" "station-os-api:5103"; do
  api=${entry%%:*}; port=${entry##*:}
  free_port "$port"
  ( cd "$STATION/apis/$api" && PORT=$port NODE_ENV=development SEED_DATA=true \
      nohup node src/index.js > "$LOGS/$api.log" 2>&1 & )
  echo "  $api → :$port"
done

echo "── Control plane ───────────────────────────────────────"
free_port 4500
( cd "$STATION" && PORT=4500 nohup node control-plane/registry/simple-registry.js > "$LOGS/registry.log" 2>&1 & )
sleep 2
free_port 4504
( cd "$STATION" && DAEMON_PORT=4504 REGISTRY_HOST=localhost REGISTRY_PORT=4500 \
    nohup node control-plane/daemon/simple-daemon.js > "$LOGS/daemon.log" 2>&1 & )
echo "  registry → :4500 · daemon → :4504"

echo "── MFEs ────────────────────────────────────────────────"
free_port 5001
( cd "$STATION/meridian-console" && nohup npx serve dist -p 5001 --cors > "$LOGS/console.log" 2>&1 & )
echo "  meridian-console → :5001 (static)"
for entry in "meridian-docking-control:5002" "meridian-life-support:5003" \
             "meridian-cargo-ops:5004" "meridian-crew-services:5005" "meridian-concourse:5006"; do
  mfe=${entry%%:*}; port=${entry##*:}
  free_port "$port"
  ( cd "$STATION/$mfe" && PORT=$port nohup npx ts-node server.ts > "$LOGS/$mfe.log" 2>&1 & )
  echo "  $mfe → :$port (static + /graphql)"
done

echo "── Shell ───────────────────────────────────────────────"
free_port 5000
( cd "$STATION/shell" && nohup npx rspack serve > "$LOGS/shell.log" 2>&1 & )
echo "  meridian-shell → :5000"

echo
echo "Waiting for everything to come up…"
sleep 12
for port in 5101 5102 5103 5001 5002 5003 5004 5005 5006 5000; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/" 2>/dev/null)
  printf "  :%s %s\n" "$port" "$code"
done

echo
echo "Next: ./scripts/register-station.sh && ./scripts/console.sh — then open http://localhost:5000"

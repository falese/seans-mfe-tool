#!/usr/bin/env bash
# Builds every Meridian Station image sequentially (disk-bounded, matching
# abc-kids' build-games.sh). SKIP_CLI=1 skips rebuilding the CLI image when
# it is already current. COMPOSE_BAKE=false keeps classic sequential builds.
set -euo pipefail
STATION="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$STATION/../.." && pwd)"
export COMPOSE_BAKE=false

if [ "${SKIP_CLI:-0}" != "1" ]; then
  echo "── Building seans-mfe-tool-cli:latest (repo root) ──"
  (cd "$ROOT" && npm run build && npm run docker:build:cli)
fi

SERVICES=(
  registry daemon
  harbormaster-api stellar-ledger-api station-os-api
  meridian-console
  meridian-docking-control meridian-life-support meridian-cargo-ops
  meridian-crew-services meridian-concourse
  shell
)

for service in "${SERVICES[@]}"; do
  echo "── Building $service ──"
  docker compose -f "$STATION/docker-compose.yaml" build "$service"
done

echo
echo "All images built. Bring the station up with:"
echo "  docker compose -f examples/meridian-station/docker-compose.yaml up -d"
echo "  ./scripts/register-station.sh && ./scripts/console.sh"
echo "  open http://localhost:5000"

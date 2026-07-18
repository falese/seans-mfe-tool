#!/usr/bin/env bash
# Registers the Meridian Station MFEs with the control-plane registry
# (ADR-054/055). Phase 2 scope: the console (root rule). Domain MFEs are
# appended as their phases land; Phase 5 turns this into generated output
# of scripts/generate.mjs.
set -euo pipefail
REGISTRY=${REGISTRY:-http://localhost:4500}

# meridian-console — the operator home and slot provider (ADR-058).
# The root rule injects the domain catalog and the berth list; the console
# provides main/status plus keyed berth.{id} slots (ADR-069) and fires one
# meridian.berth.<id> action per berth on mount.
curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d '{
  "registration": {
    "name": "meridian-console",
    "version": "1.0.0",
    "type": "remote",
    "baseUrl": "http://localhost:5001",
    "capabilities": ["load", "render"],
    "contentType": "module-federation",
    "remoteEntryUrl": "http://localhost:5001/remoteEntry.js",
    "moduleFederation": { "scope": "meridian_console", "module": "./App" }
  },
  "routes": [
    {
      "when": { "stateKey": "meridian.root" },
      "resolve": {
        "capability": "StationConsole",
        "props": {
          "slot": "root",
          "berths": ["b1", "b2", "b3", "b4", "b5", "b6"],
          "domains": [
            { "id": "docking",      "title": "Docking Control", "emoji": "🛰️", "color": "#3b6ff5", "blurb": "Berths, traffic, assignments" },
            { "id": "life-support", "title": "Life Support",    "emoji": "🫁", "color": "#2e9e6b", "blurb": "Telemetry, environment, alerts" },
            { "id": "cargo",        "title": "Cargo Operations","emoji": "📦", "color": "#c77b21", "blurb": "Manifests, hazards, valuations" },
            { "id": "crew",         "title": "Crew Services",   "emoji": "🧑‍🚀", "color": "#8455d6", "blurb": "Roster, certifications, pay" },
            { "id": "concourse",    "title": "Concourse",       "emoji": "🍜", "color": "#d64570", "blurb": "Vendors, stalls, settlements" }
          ]
        }
      }
    }
  ]
}' && echo " registered meridian-console (StationConsole — root rule)"

echo "Console registered. Compose it into the shell with:"
echo "  ./scripts/console.sh"

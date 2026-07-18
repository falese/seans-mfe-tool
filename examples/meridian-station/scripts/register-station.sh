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

# meridian-docking-control — Angular ops MFE with a 2-source BFF
# (Harbormaster + StellarLedger). One meridian.open.docking action fires
# TWO rules: DockingBoard into main and TrafficLog into status. The six
# keyed berth routes each resolve BerthTile into its own
# meridian-console/berth.<id> address with props.berthId (ADR-069).
curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d '{
  "registration": {
    "name": "meridian-docking-control",
    "version": "1.0.0",
    "type": "remote",
    "baseUrl": "http://localhost:5002",
    "capabilities": ["load", "render"],
    "contentType": "module-federation",
    "remoteEntryUrl": "http://localhost:5002/remoteEntry.js",
    "moduleFederation": { "scope": "meridian_docking_control", "module": "./Component" }
  },
  "routes": [
    { "when": { "stateKey": "meridian.open.docking" },
      "resolve": { "capability": "DockingBoard", "props": { "slot": "meridian-console/main" } } },
    { "when": { "stateKey": "meridian.open.docking" },
      "resolve": { "capability": "TrafficLog", "props": { "slot": "meridian-console/status" } } },
    { "when": { "stateKey": "meridian.berth.b1" },
      "resolve": { "capability": "BerthTile", "props": { "slot": "meridian-console/berth.b1", "berthId": "b1" } } },
    { "when": { "stateKey": "meridian.berth.b2" },
      "resolve": { "capability": "BerthTile", "props": { "slot": "meridian-console/berth.b2", "berthId": "b2" } } },
    { "when": { "stateKey": "meridian.berth.b3" },
      "resolve": { "capability": "BerthTile", "props": { "slot": "meridian-console/berth.b3", "berthId": "b3" } } },
    { "when": { "stateKey": "meridian.berth.b4" },
      "resolve": { "capability": "BerthTile", "props": { "slot": "meridian-console/berth.b4", "berthId": "b4" } } },
    { "when": { "stateKey": "meridian.berth.b5" },
      "resolve": { "capability": "BerthTile", "props": { "slot": "meridian-console/berth.b5", "berthId": "b5" } } },
    { "when": { "stateKey": "meridian.berth.b6" },
      "resolve": { "capability": "BerthTile", "props": { "slot": "meridian-console/berth.b6", "berthId": "b6" } } }
  ]
}' && echo " registered meridian-docking-control (DockingBoard/TrafficLog/BerthTile — Angular)"

echo "MFEs registered. Compose the console into the shell with:"
echo "  ./scripts/console.sh"

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
            { "id": "docking-simulation", "title": "Docking Simulator", "emoji": "🎮", "color": "#ff6b9d", "blurb": "First-person 3D docking gameplay" },
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

# meridian-life-support — Angular, single-source BFF (StationOS only).
curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d '{
  "registration": {
    "name": "meridian-life-support",
    "version": "1.0.0",
    "type": "remote",
    "baseUrl": "http://localhost:5003",
    "capabilities": ["load", "render"],
    "contentType": "module-federation",
    "remoteEntryUrl": "http://localhost:5003/remoteEntry.js",
    "moduleFederation": { "scope": "meridian_life_support", "module": "./Component" }
  },
  "routes": [
    { "when": { "stateKey": "meridian.open.life-support" },
      "resolve": { "capability": "TelemetryDashboard", "props": { "slot": "meridian-console/main" } } },
    { "when": { "stateKey": "meridian.open.life-support" },
      "resolve": { "capability": "AlertsFeed", "props": { "slot": "meridian-console/status" } } },
    { "when": { "stateKey": "meridian.status.life-support" },
      "resolve": { "capability": "ModuleStatus", "props": { "slot": "meridian-console/status" } } }
  ]
}' && echo " registered meridian-life-support (TelemetryDashboard/AlertsFeed/ModuleStatus — Angular)"

# meridian-cargo-ops — Angular, two-source BFF; the flagship split-document
# manifest view (valuation gaps included).
curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d '{
  "registration": {
    "name": "meridian-cargo-ops",
    "version": "1.0.0",
    "type": "remote",
    "baseUrl": "http://localhost:5004",
    "capabilities": ["load", "render"],
    "contentType": "module-federation",
    "remoteEntryUrl": "http://localhost:5004/remoteEntry.js",
    "moduleFederation": { "scope": "meridian_cargo_ops", "module": "./Component" }
  },
  "routes": [
    { "when": { "stateKey": "meridian.open.cargo" },
      "resolve": { "capability": "CargoManifest", "props": { "slot": "meridian-console/main" } } },
    { "when": { "stateKey": "meridian.open.cargo" },
      "resolve": { "capability": "HazardSummary", "props": { "slot": "meridian-console/status" } } }
  ]
}' && echo " registered meridian-cargo-ops (CargoManifest/HazardSummary — Angular)"

# meridian-crew-services — React, two-source BFF (StationOS + StellarLedger),
# scaffolded through the MCP server (see DX-REPORT.md Phase 4).
curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d '{
  "registration": {
    "name": "meridian-crew-services",
    "version": "1.0.0",
    "type": "remote",
    "baseUrl": "http://localhost:5005",
    "capabilities": ["load", "render"],
    "contentType": "module-federation",
    "remoteEntryUrl": "http://localhost:5005/remoteEntry.js",
    "moduleFederation": { "scope": "meridian_crew_services", "module": "./App" }
  },
  "routes": [
    { "when": { "stateKey": "meridian.open.crew" },
      "resolve": { "capability": "CrewRoster", "props": { "slot": "meridian-console/main" } } },
    { "when": { "stateKey": "meridian.open.crew" },
      "resolve": { "capability": "PayStatus", "props": { "slot": "meridian-console/status" } } }
  ]
}' && echo " registered meridian-crew-services (CrewRoster/PayStatus — React, MCP-scaffolded)"

# meridian-concourse — React, THREE-source BFF; also MCP-scaffolded.
curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d '{
  "registration": {
    "name": "meridian-concourse",
    "version": "1.0.0",
    "type": "remote",
    "baseUrl": "http://localhost:5006",
    "capabilities": ["load", "render"],
    "contentType": "module-federation",
    "remoteEntryUrl": "http://localhost:5006/remoteEntry.js",
    "moduleFederation": { "scope": "meridian_concourse", "module": "./App" }
  },
  "routes": [
    { "when": { "stateKey": "meridian.open.concourse" },
      "resolve": { "capability": "MarketDirectory", "props": { "slot": "meridian-console/main" } } }
  ]
}' && echo " registered meridian-concourse (MarketDirectory — React, MCP-scaffolded)"

# meridian-docking-simulation — React, two-source BFF (Harbormaster + StationOS),
# first-person 3D docking gameplay with Babylon.js and arcade physics.
curl -fsS -X POST "$REGISTRY/mfes" -H "Content-Type: application/json" -d '{
  "registration": {
    "name": "meridian-docking-simulation",
    "version": "1.0.0",
    "type": "remote",
    "baseUrl": "http://localhost:5007",
    "capabilities": ["load", "render"],
    "contentType": "module-federation",
    "remoteEntryUrl": "http://localhost:5007/remoteEntry.js",
    "moduleFederation": { "scope": "meridian_docking_simulation", "module": "./App" }
  },
  "routes": [
    { "when": { "stateKey": "meridian.open.docking-simulation" },
      "resolve": { "capability": "DockingSimulation", "props": { "slot": "meridian-console/main" } } }
  ]
}' && echo " registered meridian-docking-simulation (DockingSimulation — React, Babylon.js 3D)"

echo "MFEs registered. Compose the console into the shell with:"
echo "  ./scripts/console.sh"

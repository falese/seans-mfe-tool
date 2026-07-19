# Meridian Station — demo runbook

Two ways to run the station: **docker compose** (the canonical topology) or
the **local dev stack** (no docker; what CI-less environments and this repo's
own verification used). Both end at the same place: a generic shell at
http://localhost:5000 composed entirely by the control plane.

## A. Docker compose (canonical)

```bash
# 1. Repo root — build the CLI image (bakes dist/runtime for every MFE build)
npm ci && npm run build && npm run docker:build:cli

# 2. Build every station image (sequential, disk-bounded)
cd examples/meridian-station
./scripts/build-station.sh          # SKIP_CLI=1 to skip step 1's image

# 3. Up
docker compose up -d

# 4. Register the fleet + compose the console (in-memory registry —
#    re-run BOTH after any registry restart)
./scripts/register-station.sh
./scripts/console.sh

# 5. Open http://localhost:5000
```

> Note: the image builds follow the battle-tested abc-kids patterns but were
> authored in an environment without a docker daemon — if a build breaks,
> compare against `examples/abc-kids/{flappy,multiplication-quiz,hockey}/Dockerfile`
> first. The identical topology is verified live by the local path below.

## B. Local dev stack (no docker)

```bash
# 0. One-time: compose service names must resolve locally (the BFF upstreams
#    use the specs' servers: entries)
echo "127.0.0.1 harbormaster-api stellar-ledger-api station-os-api" | sudo tee -a /etc/hosts

# 1. Repo root — build the CLI + runtime
npm ci && npm run build

# 2. Per MFE: install deps and build (the runtime must be a REAL directory,
#    not a file: symlink — Angular resolution escapes the project otherwise)
cd examples/meridian-station/<mfe>
npm install --legacy-peer-deps --no-audit --no-fund
rm -rf node_modules/@seans-mfe-tool/runtime
cp -r ../../../dist/runtime node_modules/@seans-mfe-tool/runtime
npx rspack build            # React MFEs (console, crew-services, concourse, shell)
npx ng build --configuration production   # Angular MFEs

# 3. Boot everything (APIs seed themselves; logs land in /tmp/meridian-logs)
./scripts/dev-up.sh

# 4. Register + compose
./scripts/register-station.sh
./scripts/console.sh

# 5. Open http://localhost:5000
```

## Driving the station

```bash
./scripts/open.sh docking        # DockingBoard → main AND TrafficLog → status (one action, two rules)
./scripts/open.sh life-support   # TelemetryDashboard + AlertsFeed
./scripts/open.sh cargo          # the flagship split-document CargoManifest + HazardSummary
./scripts/open.sh crew           # CrewRoster + PayStatus (MCP-built MFE)
./scripts/open.sh concourse      # MarketDirectory — three conventions, one screen
./scripts/dock.sh b3             # re-fire one keyed berth tile (ADR-069)
```

The berth strip needs no driving: the console fires `meridian.berth.b1..b6`
on mount and six independent control-plane round trips fill it.

### What correct looks like

- Header: `Meridian Station · control plane: connected` (green dot).
- Berth strip: b1/b2/b5 DOCKED with vessel + `₢ … due`, b3 DOCKED with no
  dues, b4/b6 `berth available` — matching the Docking Board exactly.
- Docking Board: b1 shows `₢ 8,500.00 DISPUTED` (live two-source join).
- Cargo Manifest: line `DCK-004027/2` reads *"valuation pending — finance"* —
  the deliberate gap, not a bug.
- Daemon log chain per action: `DAE-220 ACTION_RECEIVED → DAE-250
  RESOLUTION_RECEIVED → DAE-253 EXPERIENCE_RELAYED`.

First places to look when it isn't: the daemon log (`/tmp/meridian-logs/daemon.log`
or `docker compose logs daemon`); then the MFE's own `/graphql` (e.g.
`curl -s localhost:5002/graphql -H 'content-type: application/json'
-d '{"query":"{ listBerths { berthId } }"}'`); then re-run
`register-station.sh` (the registry forgets everything on restart).

## The mock↔live switch (ADR-052)

Every BFF answers fixtures when asked — same query, same shape, no upstream:

```bash
curl -s localhost:5002/graphql -H 'content-type: application/json' \
  -H 'x-bff-mode: mock' -d '{"query":"{ listBerths { berthId } }"}'
```

Drop the header for live seeded data. `DEMO_MODE=true` on an MFE's server
flips the default.

## Smoke suite

With the stack up and registered:

```bash
cd examples/meridian-station
npm install
npx playwright test          # CHROMIUM_PATH=/path/to/chromium to reuse a preinstalled browser
```

Six tests drive the exact demo path above and assert the live cross-source
data (the DISPUTED tariff, the valuation gap, the CRW payroll join).

## Regeneration invariant

```bash
node scripts/generate.mjs --check   # re-runs remote:generate everywhere + derive-seeds;
                                    # fails if generated artifacts drifted from the manifests
```

## Teardown

```bash
docker compose down            # compose path
pkill -f meridian; pkill -f simple-registry; pkill -f simple-daemon   # dev path (or just close the shell)
```

Registry state is in-memory: every fresh start needs `register-station.sh`
then `console.sh` again.

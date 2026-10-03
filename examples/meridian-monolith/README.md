# meridian-monolith

Meridian Station rebuilt as **one React SPA**, written the way a real team would
have written it. It is the reference subject for agent-driven decomposition
(PDR-011, epic [#410](https://github.com/falese/seans-mfe-tool/issues/410), this
example: [#412](https://github.com/falese/seans-mfe-tool/issues/412)).

The right decomposition is already known: it is
[`meridian-station`](../meridian-station/), seven MFEs on the same three
backends. So a decomposition agent's proposal can be **scored** against
[`answer-key.yaml`](./answer-key.yaml) instead of judged.

> **Do not tidy this app up.** The mess is the point. Mixed folder
> conventions, a god store, one API client for every backend, cross-domain
> reads, a duplicated route table and a poor test suite are what a real
> monolith looks like. Fixing them removes the signal the agent is tested on.

## What is deliberately wrong

- **Structure:** folders by type (`components/`), by domain (`pages/cargo/`,
  `components/crew/`) and pages that inline their component
  (`LifeSupportPage`, `ConcoursePage`). Folder names are not reliable
  boundaries.
- **Data:** one `api/client.ts` normalizes all three backends; a global
  `store/AppContext.tsx` loads docking and life-support data for the whole
  app; cargo and concourse read docking data from that store.
- **Coupling:** the console's nav shows a life-support alert count.
- **Routing:** `App.tsx` keeps two route tables (main and status rail) that
  must agree.
- **Latent bug:** `GET /dockings` returns 10 of 12 rows by default, so two
  dockings never show. meridian-station has the same bug; parity preserves it.
- **Tests:** low and uneven coverage, snapshots, implementation-coupled
  tests, brittle selectors, a skipped test, commented-out tests, a flaky
  timing test, a file excluded from Jest that asserts behavior the app no
  longer has, and two happy-path e2e specs with fixed sleeps. Line coverage
  is 29%, and even that overstates it. See `tests` and `untested_behaviors`
  in the answer key.

All of it is catalogued in [`answer-key.yaml`](./answer-key.yaml). **The
answer key is ground truth: never give it to the agent being scored.**

## Run it

It needs meridian-station's three backends on ports 5101–5103 (Harbormaster,
StellarLedger, StationOS). StellarLedger needs MongoDB.

```bash
# 1. Backends: from examples/meridian-station
docker compose up -d mongo harbormaster-api stellar-ledger-api station-os-api

# 2. The monolith
cd examples/meridian-monolith
npm install
npm start            # http://localhost:5090, proxies /api/{harbormaster,ledger,stationos}
```

Override backend locations with `HARBORMASTER_URL`, `LEDGER_URL`,
`STATION_OS_URL`.

If the API images fail to build (an npm crash inside the build container has
been seen behind a proxy), run the APIs natively instead:

```bash
cd examples/meridian-station/apis/<api> && npm ci --omit=dev
PORT=5101 SEED_DATA=true node src/index.js   # harbormaster-api; 5103 for station-os-api
PORT=5102 SEED_DATA=true MONGODB_URI=mongodb://<mongo-host>:27017/stellar-ledger node src/index.js
```

## Tests

```bash
npm test               # unit tests (one is flaky by design)
npm run test:coverage  # the "before" coverage numbers in the answer key
npm run e2e            # needs the app on :5090; set CHROMIUM_PATH if Playwright's browser is missing
```

## Routes

| Path | Main | Status rail | meridian-station state key |
|---|---|---|---|
| `/` | — | ModuleStatus | `meridian.root` |
| `/docking` | DockingBoard | TrafficLog | `meridian.open.docking` |
| `/simulator` | DockingSimulation | — | `meridian.open.docking-simulation` |
| `/life-support` | TelemetryDashboard | AlertsFeed | `meridian.open.life-support` |
| `/cargo` | CargoManifest | HazardSummary | `meridian.open.cargo` |
| `/crew` | CrewRoster | PayStatus | `meridian.open.crew` |
| `/concourse` | MarketDirectory | — | `meridian.open.concourse` |

The berth strip (one BerthTile per berth) is on every page.

## Notes

- React 18 is pinned on purpose. The fiber bridge in `decompose:capture`
  (#413) maps DOM regions to source files through `_debugSource`, which
  React 19 removed. The Babel config keeps it in development builds.
- Repo-level Jest and ESLint exclude `examples/**`, so this suite never runs
  in the repository's own gates.

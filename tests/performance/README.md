# Phase 1.4 — performance tests

Dependency-free Node load scenarios that codify the performance budgets from the
production-readiness roadmap.

## What this is

Each `*.perf.js` file:

1. Boots a tiny self-contained Node HTTP server (`tests/performance/server.js`)
   on an ephemeral port.
2. Hits a target endpoint with a fixed number of total requests under a fixed
   number of concurrent virtual users using a shared keep-alive HTTP agent.
3. Computes `min / p50 / p95 / p99 / max / mean` latency and `rps`.
4. Asserts the relevant budget and exits non-zero on failure.

No external dependencies (no k6, no Artillery, no autocannon) — keeps the suite
fast to install in CI and reproducible across environments.

## Budgets

| Scenario | File | Endpoint | Budget |
| --- | --- | --- | --- |
| MFE initial load under concurrent users | `mfe-load.perf.js` | `GET /` | p95 < **2000 ms** |
| Capability invocation latency | `capability-invocation.perf.js` | `GET /api/capability/{query\|report}` | p95 < **500 ms** |
| BFF query performance | `bff-query.perf.js` | `POST /bff/query` | p95 < **200 ms** |
| Memory usage under load | `memory-under-load.perf.js` | `GET /api/capability/*` (server in child proc) | max RSS < **100 MiB** |

These map 1:1 to the roadmap budgets (MFE initial load < 2s, capability < 500ms,
BFF < 200ms, memory per MFE < 100MB).

## Running

```bash
# Run the whole suite
npm run test:perf

# Run a single scenario directly
node tests/performance/mfe-load.perf.js
node tests/performance/capability-invocation.perf.js
node tests/performance/bff-query.perf.js
node tests/performance/memory-under-load.perf.js
```

## Tuning

Each scenario reads tunables from environment variables:

| Variable | Default (mfe-load) | Notes |
| --- | --- | --- |
| `PERF_USERS` | 20 (varies per scenario) | concurrent virtual users |
| `PERF_REQUESTS` | 500 (varies per scenario) | total requests issued |
| `PERF_BUDGET_P95_MS` | scenario-specific | override the latency budget |
| `PERF_BUDGET_MAX_RSS_MB` | 100 (memory only) | override the memory budget |

Defaults are deliberately conservative so the suite finishes in <10s on shared
CI runners while still being meaningful.

## CI

The `perf` job runs in `.github/workflows/test.yml` on Node 20.x only. It's
deliberately separate from the unit/integration/e2e jobs so a latency blip
doesn't gate code review, and it uploads its own logs as an artifact for
post-mortem inspection.

## Why a fixture server and not the real CLI?

The CLI scaffolds MFEs but doesn't ship a running runtime. The fixture server
implements the same HTTP shape the generated stack (MFE shell + capability
endpoint + BFF) exposes, so the same budgets transfer 1:1 when these scenarios
are pointed at a real built MFE in the future. Until then, the fixture serves
as the executable spec of the runtime contract under load.

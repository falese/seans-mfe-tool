/**
 * Phase 1.4 — MFE load time under concurrent users.
 *
 * Hits GET / (the MFE HTML shell) under load. Budget from the roadmap:
 *   "MFE initial load: < 2s"
 * Interpreted as p95 < 2000 ms under sustained concurrent load.
 *
 * Defaults are tuned to finish in <5s on CI while still being meaningful:
 *   - 20 virtual users
 *   - 500 total requests
 * Override via env: PERF_USERS, PERF_REQUESTS, PERF_BUDGET_P95_MS.
 */

'use strict';

const { start } = require('./server');
const { runLoad, formatStats, ensure } = require('./lib/load');

const USERS = parseInt(process.env.PERF_USERS || '20', 10);
const REQUESTS = parseInt(process.env.PERF_REQUESTS || '500', 10);
const BUDGET_P95_MS = parseInt(process.env.PERF_BUDGET_P95_MS || '2000', 10);

async function main() {
  const { url, stop } = await start({ port: 0 });
  try {
    const { stats, errors, rps } = await runLoad({
      totalRequests: REQUESTS,
      concurrency: USERS,
      factory: () => ({ url: `${url}/`, method: 'GET' }),
    });

    // eslint-disable-next-line no-console
    console.log(`[perf] MFE initial load — budget p95 < ${BUDGET_P95_MS}ms`);
    // eslint-disable-next-line no-console
    console.log(formatStats('GET /', stats, { rps }));

    ensure(errors.length === 0, `request errors: ${errors.length} (first: ${JSON.stringify(errors[0])})`);
    ensure(
      stats.p95 < BUDGET_P95_MS,
      `MFE load p95=${stats.p95.toFixed(1)}ms exceeds budget ${BUDGET_P95_MS}ms ` +
        `(users=${USERS}, total=${REQUESTS})`
    );

    // eslint-disable-next-line no-console
    console.log('[perf] OK — MFE load budget met');
  } finally {
    await stop();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[perf] scenario crashed', err && err.stack ? err.stack : err);
  process.exit(2);
});

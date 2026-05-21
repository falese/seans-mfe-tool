/**
 * Phase 1.4 — capability invocation latency.
 *
 * Hits GET /api/capability/{query|report} under load. Budget from the roadmap:
 *   "Capability invocation: < 500ms"
 * Interpreted as p95 < 500 ms under sustained concurrent load.
 *
 * Override via env: PERF_USERS, PERF_REQUESTS, PERF_BUDGET_P95_MS.
 */

'use strict';

const { start } = require('./server');
const { runLoad, formatStats, ensure } = require('./lib/load');

const USERS = parseInt(process.env.PERF_USERS || '50', 10);
const REQUESTS = parseInt(process.env.PERF_REQUESTS || '1000', 10);
const BUDGET_P95_MS = parseInt(process.env.PERF_BUDGET_P95_MS || '500', 10);

const CAPABILITIES = ['query', 'report'];

async function main() {
  const { url, stop } = await start({ port: 0 });
  try {
    const { stats, errors, rps } = await runLoad({
      totalRequests: REQUESTS,
      concurrency: USERS,
      factory: (i) => ({
        url: `${url}/api/capability/${CAPABILITIES[i % CAPABILITIES.length]}`,
        method: 'GET',
      }),
    });

    // eslint-disable-next-line no-console
    console.log(`[perf] capability invocation — budget p95 < ${BUDGET_P95_MS}ms`);
    // eslint-disable-next-line no-console
    console.log(formatStats('GET /api/capability/*', stats, { rps }));

    ensure(errors.length === 0, `request errors: ${errors.length} (first: ${JSON.stringify(errors[0])})`);
    ensure(
      stats.p95 < BUDGET_P95_MS,
      `capability p95=${stats.p95.toFixed(1)}ms exceeds budget ${BUDGET_P95_MS}ms ` +
        `(users=${USERS}, total=${REQUESTS})`
    );

    // eslint-disable-next-line no-console
    console.log('[perf] OK — capability invocation budget met');
  } finally {
    await stop();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[perf] scenario crashed', err && err.stack ? err.stack : err);
  process.exit(2);
});

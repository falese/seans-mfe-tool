/**
 * Phase 1.4 — BFF query performance.
 *
 * POSTs a graphql-like payload to /bff/query under load. Budget from the
 * roadmap:
 *   "BFF query response: < 200ms"
 * Interpreted as p95 < 200 ms under sustained concurrent load.
 *
 * Override via env: PERF_USERS, PERF_REQUESTS, PERF_BUDGET_P95_MS.
 */

'use strict';

const { start } = require('./server');
const { runLoad, formatStats, ensure } = require('./lib/load');

const USERS = parseInt(process.env.PERF_USERS || '50', 10);
const REQUESTS = parseInt(process.env.PERF_REQUESTS || '1000', 10);
const BUDGET_P95_MS = parseInt(process.env.PERF_BUDGET_P95_MS || '200', 10);

const QUERY_BODY = JSON.stringify({
  operationName: 'GetRows',
  query: 'query GetRows($limit: Int!) { rows(limit: $limit) { id } }',
  variables: { limit: 10 },
});

async function main() {
  const { url, stop } = await start({ port: 0 });
  try {
    const { stats, errors, rps } = await runLoad({
      totalRequests: REQUESTS,
      concurrency: USERS,
      factory: () => ({
        url: `${url}/bff/query`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(QUERY_BODY).toString(),
        },
        body: QUERY_BODY,
      }),
    });

    // eslint-disable-next-line no-console
    console.log(`[perf] BFF query — budget p95 < ${BUDGET_P95_MS}ms`);
    // eslint-disable-next-line no-console
    console.log(formatStats('POST /bff/query', stats, { rps }));

    ensure(errors.length === 0, `request errors: ${errors.length} (first: ${JSON.stringify(errors[0])})`);
    ensure(
      stats.p95 < BUDGET_P95_MS,
      `BFF p95=${stats.p95.toFixed(1)}ms exceeds budget ${BUDGET_P95_MS}ms ` +
        `(users=${USERS}, total=${REQUESTS})`
    );

    // eslint-disable-next-line no-console
    console.log('[perf] OK — BFF query budget met');
  } finally {
    await stop();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[perf] scenario crashed', err && err.stack ? err.stack : err);
  process.exit(2);
});

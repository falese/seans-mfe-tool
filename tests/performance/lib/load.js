/**
 * Phase 1.4 — load helper.
 *
 * Tiny dependency-free load generator + latency aggregator. Used by every
 * tests/performance/*.perf.js scenario so they all measure the same thing
 * the same way.
 *
 * Design notes:
 *   - Uses keep-alive sockets via a shared http.Agent — without this, every
 *     request pays connection-setup cost and percentiles balloon.
 *   - Concurrency is enforced by a pool of worker promises, NOT by firing
 *     all N requests at once (which would just queue inside the agent).
 *   - performance.now() gives sub-millisecond resolution; the stats math
 *     uses Float64 throughout.
 *   - Budgets are asserted from each scenario, not here, so the helper has
 *     no opinion about pass/fail thresholds.
 */

'use strict';

const http = require('http');
const { performance } = require('perf_hooks');

const sharedAgent = new http.Agent({ keepAlive: true, maxSockets: 256 });

function pct(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.floor((p / 100) * sortedAsc.length))
  );
  return sortedAsc[idx];
}

function summarize(samplesMs) {
  if (samplesMs.length === 0) {
    return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  const sorted = samplesMs.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    mean: sum / sorted.length,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Issue a single request and return its latency in ms.
 * Resolves to { latencyMs, statusCode, bytes }.
 */
function timedRequest({ url, method = 'GET', headers = {}, body }) {
  const parsed = new URL(url);
  const options = {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method,
    headers,
    agent: sharedAgent,
  };
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(options, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
      });
      res.on('end', () => {
        resolve({
          latencyMs: performance.now() - start,
          statusCode: res.statusCode,
          bytes,
        });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/**
 * Hammer a request factory `totalRequests` times with `concurrency` parallel
 * in-flight requests. `factory()` must return a fresh options object per call
 * so each request gets its own URL/body if needed.
 *
 * Returns { stats, errors, totalDurationMs, rps }.
 */
async function runLoad({ totalRequests, concurrency, factory, acceptStatus = (c) => c >= 200 && c < 400 }) {
  const samples = [];
  const errors = [];
  let cursor = 0;
  const wallStart = performance.now();

  async function worker() {
    while (true) {
      const myIndex = cursor++;
      if (myIndex >= totalRequests) return;
      try {
        const r = await timedRequest(factory(myIndex));
        if (!acceptStatus(r.statusCode)) {
          errors.push({ index: myIndex, kind: 'status', statusCode: r.statusCode });
        }
        samples.push(r.latencyMs);
      } catch (err) {
        errors.push({ index: myIndex, kind: 'exception', message: err && err.message });
      }
    }
  }

  const pool = [];
  for (let i = 0; i < concurrency; i++) pool.push(worker());
  await Promise.all(pool);

  const totalDurationMs = performance.now() - wallStart;
  const stats = summarize(samples);
  return {
    stats,
    errors,
    totalDurationMs,
    rps: totalDurationMs > 0 ? (samples.length / totalDurationMs) * 1000 : 0,
  };
}

function formatStats(label, stats, extra = {}) {
  const lines = [
    `  ${label.padEnd(28)} count=${stats.count}  rps=${(extra.rps || 0).toFixed(1)}`,
    `  ${' '.repeat(28)} latency(ms): min=${stats.min.toFixed(1)}  ` +
      `p50=${stats.p50.toFixed(1)}  p95=${stats.p95.toFixed(1)}  ` +
      `p99=${stats.p99.toFixed(1)}  max=${stats.max.toFixed(1)}  ` +
      `mean=${stats.mean.toFixed(1)}`,
  ];
  return lines.join('\n');
}

function ensure(condition, message) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error(`PERF BUDGET FAILED: ${message}`);
    process.exit(1);
  }
}

module.exports = {
  runLoad,
  timedRequest,
  summarize,
  formatStats,
  ensure,
};

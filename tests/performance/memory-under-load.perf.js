/**
 * Phase 1.4 — memory usage under load.
 *
 * Spawns the perf server as a CHILD PROCESS, hits it with sustained load
 * for ~3 seconds, and samples the child's RSS at fixed intervals. Budget
 * from the roadmap:
 *   "Memory per MFE: < 100MB"
 * Interpreted as: the server's max RSS during the load run stays below
 * 100 MiB. The MFE proper isn't a long-running process the CLI ships, so
 * this scenario uses the perf server as a stand-in for "the runtime under
 * sustained load doesn't leak".
 *
 * Override via env: PERF_USERS, PERF_REQUESTS, PERF_BUDGET_MAX_RSS_MB.
 */

'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { runLoad, formatStats, ensure } = require('./lib/load');

const USERS = parseInt(process.env.PERF_USERS || '40', 10);
const REQUESTS = parseInt(process.env.PERF_REQUESTS || '10000', 10);
const BUDGET_MAX_RSS_MB = parseInt(process.env.PERF_BUDGET_MAX_RSS_MB || '100', 10);
const SAMPLE_INTERVAL_MS = parseInt(process.env.PERF_RSS_SAMPLE_MS || '25', 10);

function waitForReady(url, timeoutMs = 5000) {
  const { timedRequest } = require('./lib/load');
  const deadline = Date.now() + timeoutMs;
  return (async function poll() {
    while (Date.now() < deadline) {
      try {
        const r = await timedRequest({ url: `${url}/healthz`, method: 'GET' });
        if (r.statusCode === 200) return;
      } catch (_) { /* keep polling */ }
      await new Promise((res) => setTimeout(res, 50));
    }
    throw new Error(`perf server did not become ready at ${url} within ${timeoutMs}ms`);
  })();
}

function getRssMb(pid) {
  // Linux/macOS only — read /proc on Linux, fall back to ps elsewhere.
  if (process.platform === 'linux') {
    try {
      const fs = require('fs');
      const statm = fs.readFileSync(`/proc/${pid}/statm`, 'utf8').trim().split(/\s+/);
      const pageSize = 4096; // assume 4 KiB pages on standard runners
      const rssPages = parseInt(statm[1], 10);
      if (Number.isFinite(rssPages)) return (rssPages * pageSize) / (1024 * 1024);
    } catch (_) { /* fall through */ }
  }
  try {
    const { execSync } = require('child_process');
    const out = execSync(`ps -o rss= -p ${pid}`, { encoding: 'utf8' }).trim();
    const rssKb = parseInt(out, 10);
    if (Number.isFinite(rssKb)) return rssKb / 1024;
  } catch (_) { /* give up */ }
  return null;
}

async function main() {
  const PORT = 4400 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PERF_PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const url = `http://127.0.0.1:${PORT}`;

  try {
    await waitForReady(url);

    const samples = [];
    // Sample immediately so we always have at least one data point even if
    // the load finishes faster than the interval.
    const initial = getRssMb(child.pid);
    if (initial !== null) samples.push(initial);
    const sampleInterval = setInterval(() => {
      const rss = getRssMb(child.pid);
      if (rss !== null) samples.push(rss);
    }, SAMPLE_INTERVAL_MS);

    let loadResult;
    try {
      loadResult = await runLoad({
        totalRequests: REQUESTS,
        concurrency: USERS,
        factory: (i) => ({
          url: `${url}/api/capability/${i % 2 === 0 ? 'query' : 'report'}`,
          method: 'GET',
        }),
      });
    } finally {
      clearInterval(sampleInterval);
    }

    const maxRss = samples.length ? Math.max(...samples) : null;
    const meanRss = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;

    // eslint-disable-next-line no-console
    console.log(`[perf] memory under load — budget max RSS < ${BUDGET_MAX_RSS_MB} MiB`);
    // eslint-disable-next-line no-console
    console.log(formatStats('GET /api/capability/*', loadResult.stats, { rps: loadResult.rps }));
    // eslint-disable-next-line no-console
    console.log(
      `  ${'RSS samples'.padEnd(28)} count=${samples.length}  max=${
        maxRss !== null ? maxRss.toFixed(1) : 'n/a'
      } MiB  mean=${meanRss !== null ? meanRss.toFixed(1) : 'n/a'} MiB`
    );

    ensure(
      loadResult.errors.length === 0,
      `request errors: ${loadResult.errors.length} (first: ${JSON.stringify(loadResult.errors[0])})`
    );
    ensure(maxRss !== null, 'could not sample child RSS on this platform');
    ensure(
      maxRss < BUDGET_MAX_RSS_MB,
      `max RSS=${maxRss.toFixed(1)} MiB exceeds budget ${BUDGET_MAX_RSS_MB} MiB`
    );

    // eslint-disable-next-line no-console
    console.log('[perf] OK — memory budget met');
  } finally {
    child.kill('SIGTERM');
    await new Promise((res) => child.on('exit', res));
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[perf] scenario crashed', err && err.stack ? err.stack : err);
  process.exit(2);
});

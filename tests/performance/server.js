/**
 * Phase 1.4 — perf test server.
 *
 * Tiny self-contained Node HTTP server used as the load target for the
 * performance suite. Self-contained means: zero external deps, no shared
 * fixture HTML (so this PR is independent of Phase 1.3's tests/e2e/), and
 * deterministic responses so latency numbers reflect real throughput rather
 * than upstream variability.
 *
 * Endpoints:
 *   GET /                       — minimal MFE HTML shell (mfe-load scenario)
 *   GET /api/capability/:name   — capability invocation (capability scenario)
 *   POST /bff/query             — graphql-like JSON BFF (bff-query scenario)
 *   GET /healthz                — readiness probe used by the orchestrator
 *
 * Usage:
 *   const { start } = require('./server');
 *   const server = await start({ port: 0 });   // 0 = ephemeral
 *   console.log(server.url);                   // e.g. http://127.0.0.1:54321
 *   await server.stop();
 */

'use strict';

const http = require('http');
const { URL } = require('url');

const MFE_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>perf MFE</title></head>
<body>
  <main id="root" data-mfe="perf-target" data-state="ready">
    <button data-capability="query"  type="button">query</button>
    <button data-capability="report" type="button">report</button>
  </main>
</body></html>`;

function readBody(req, limitBytes = 1 << 20 /* 1 MiB */) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function handler(req, res) {
  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;

  if (req.method === 'GET' && pathname === '/') {
    return send(
      res,
      200,
      { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      MFE_HTML
    );
  }

  if (req.method === 'GET' && pathname === '/healthz') {
    return send(
      res,
      200,
      { 'Content-Type': 'application/json' },
      JSON.stringify({ ok: true })
    );
  }

  if (req.method === 'GET' && pathname.startsWith('/api/capability/')) {
    const name = pathname.slice('/api/capability/'.length);
    // Deterministic payload — no upstream calls, no I/O.
    const payload =
      name === 'query'
        ? { capability: name, ok: true, result: { rows: 42 } }
        : { capability: name, ok: true, result: { file: 'report.csv' } };
    return send(
      res,
      200,
      { 'Content-Type': 'application/json' },
      JSON.stringify(payload)
    );
  }

  if (req.method === 'POST' && pathname === '/bff/query') {
    return readBody(req)
      .then((raw) => {
        let parsedQuery = {};
        if (raw) {
          try { parsedQuery = JSON.parse(raw); }
          catch (_) { /* tolerate malformed payloads in perf path */ }
        }
        const op = parsedQuery && parsedQuery.operationName ? parsedQuery.operationName : 'default';
        send(
          res,
          200,
          { 'Content-Type': 'application/json' },
          JSON.stringify({
            data: {
              operation: op,
              echo: typeof parsedQuery.variables === 'object' ? parsedQuery.variables : null,
              rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
            },
          })
        );
      })
      .catch(() =>
        send(res, 413, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'payload too large' }))
      );
  }

  send(res, 404, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'not found' }));
}

function start({ port = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        url,
        port: addr.port,
        stop: () =>
          new Promise((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

module.exports = { start };

if (require.main === module) {
  const port = parseInt(process.env.PERF_PORT || '4399', 10);
  start({ port }).then(({ url }) => {
    // eslint-disable-next-line no-console
    console.log(`[perf server] listening on ${url}`);
  });
}

/**
 * Serve dist/registry as a read-only npm registry (ADR-084 §3).
 *
 * npm asks for two things when installing: a packument at `/@scope%2fname`
 * (URL-encoded, which decodes back to the on-disk directory) and a tarball at
 * the absolute URL the packument names. Nothing else is needed to resolve a
 * semver range, so this is a plain static file server with one rule — decode
 * the path, and map a non-.tgz request to that package's index.json.
 *
 * Read-only on purpose: it serves installs and refuses publishes. It is a
 * delivery mechanism, not a local registry to develop against.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIRROR = path.resolve(__dirname, '..', 'dist', 'registry');

function createMirrorServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'mirror is read-only' }));
      return;
    }

    const decoded = decodeURIComponent((req.url || '/').split('?')[0]);
    const isTarball = decoded.endsWith('.tgz');
    const target = isTarball
      ? path.join(MIRROR, decoded)
      : path.join(MIRROR, decoded, 'index.json');

    // Never serve outside the mirror, whatever the request path claims.
    if (!path.resolve(target).startsWith(MIRROR)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    fs.readFile(target, (err, body) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found', path: decoded }));
        return;
      }
      res.writeHead(200, {
        'content-type': isTarball ? 'application/octet-stream' : 'application/json',
      });
      res.end(body);
    });
  });
}

module.exports = { createMirrorServer, MIRROR };

if (require.main === module) {
  const port = Number(process.env.SMT_MIRROR_PORT || 4873);
  createMirrorServer().listen(port, '127.0.0.1', () => {
    console.log(`registry mirror serving ${MIRROR} on http://127.0.0.1:${port}`);
  });
}

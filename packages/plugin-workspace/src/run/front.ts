/**
 * The workspace's front door (ADR-116 §7): one origin, on this machine only,
 * for the MFE's standalone page, its BFF, and the captured screenshots.
 *
 * The MFE's generated server holds a strict CSP (images from 'self' only), so
 * the page loads screenshots from its own origin. Only the screenshot route of
 * the workspace API is passed through: every change still goes BFF → API → CLI.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import type { AddressInfo } from 'net';

export interface FrontOptions {
  /** The MFE's built standalone page (rspack output). */
  dist: string;
  /** The MFE's BFF origin, e.g. http://127.0.0.1:5611 */
  bff: string;
  /** The workspace API origin, e.g. http://127.0.0.1:4610 */
  api: string;
  /** 0 picks a free port. */
  port: number;
}

export interface RunningFront {
  url: string;
  close(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function proxy(req: http.IncomingMessage, res: http.ServerResponse, origin: string): void {
  const target = new URL(req.url ?? '/', origin);
  const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (answer) => {
    res.writeHead(answer.statusCode ?? 502, answer.headers);
    answer.pipe(res);
  });
  upstream.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: `${origin} is not answering: ${err.message}` }));
  });
  req.pipe(upstream);
}

function serveStatic(dist: string, pathname: string, res: http.ServerResponse): void {
  const root = path.resolve(dist);
  let file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
  // Anything outside the page's directory, or not a file, gets the page: it is a single-page app.
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(root, 'index.html');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export function startFront(opts: FrontOptions): Promise<RunningFront> {
  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname === '/graphql') return proxy(req, res, opts.bff);
    if (pathname === '/api/screenshot' && req.method === 'GET') return proxy(req, res, opts.api);
    if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ message: `no route ${req.method} ${pathname}` }));
    }
    return serveStatic(opts.dist, pathname, res);
  });
  return new Promise((resolve) => {
    server.listen(opts.port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}

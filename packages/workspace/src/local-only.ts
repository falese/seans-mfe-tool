/**
 * Whether a request reached a loopback server from somewhere other than its
 * own page.
 *
 * Listening on 127.0.0.1 keeps other machines out. It does nothing about the
 * browser already on this one: any page the developer has open may send a
 * request to a loopback port, and a form-style POST goes out without the
 * browser asking first. The workspace's servers edit a repository, record
 * approvals in the developer's name and spend model credit, so each refuses
 * what its own page could not have sent.
 *
 * Three signals, each sufficient to refuse:
 *   - `Host` is not a loopback name. A DNS name an attacker controls can be
 *     re-pointed at 127.0.0.1; the request then arrives here carrying that name.
 *   - `Origin` is present and is neither this server's own origin nor one the
 *     caller allows. A browser sends it on every cross-origin request and on
 *     every POST. A server-side caller (the BFF reaching the API) sends none.
 *   - The browser's own `Sec-Fetch-Site: cross-site` label.
 */

import type { IncomingMessage } from 'http';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function hostname(host: string): string {
  // "[::1]:4611" keeps its brackets; "127.0.0.1:4611" loses the port.
  return host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
}

/** Why the request is refused, or undefined when it may proceed. */
export function crossSiteRefusal(req: IncomingMessage, allowedOrigins: readonly string[] = []): string | undefined {
  const host = req.headers.host;
  if (!host || !LOOPBACK.has(hostname(host))) {
    return `this server answers on this machine only, not for host ${host ?? '(none)'}`;
  }

  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return 'cross-site requests are refused';
  }

  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}` && !allowedOrigins.includes(origin)) {
    return `requests from origin ${origin} are refused`;
  }

  return undefined;
}

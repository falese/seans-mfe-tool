/**
 * Which backend a URL addresses (ADR-110, ADR-112).
 *
 * Two layouts are common, and a URL alone cannot tell them apart:
 *
 *   gateway   `/api/<backend>/<resource>` — a proxy in front of several
 *             backends (meridian-monolith: `/api/harbormaster/berths`)
 *   one API   `/api/<resource>` — the first segment is already a resource
 *             (RealWorld: `/api/tags`, `/api/articles/:slug`)
 *
 * So the layout is judged once, over every concrete URL an app calls
 * (`backendLayout`), and passed to everything that names a backend. A
 * resource at the top level — a URL with nothing after its first segment —
 * means there is no backend segment.
 */

export interface BackendLayout {
  gateway: boolean;
}

export interface BackendUrl {
  /** Origin for a URL off the app's origin; '' for an app-relative one. */
  origin: string;
  backend: string;
  /** The path up to and including the backend segment. */
  prefix: string;
  /** The path the backend serves, under its prefix. */
  path: string;
  query: string;
}

const GATEWAY: BackendLayout = { gateway: true };

function parse(url: string): { origin: string; parts: string[]; query: string } {
  // `{?}` (an unresolved part of a code template) is not a query string.
  const m = /^(https?:\/\/[^/]+)?([^?#]*)(?:\?([^#]*))?/.exec(url.replace(/\{\?\}/g, '⟨unresolved⟩')) as RegExpExecArray;
  return {
    origin: m[1] ?? '',
    parts: (m[2] ?? '').replace(/⟨unresolved⟩/g, '{?}').split('/').filter(Boolean),
    query: (m[3] ?? '').replace(/⟨unresolved⟩/g, '{?}'),
  };
}

/** One API or a gateway, judged over the concrete URLs an app calls. */
export function backendLayout(urls: string[]): BackendLayout {
  const under = urls
    .filter((u) => !u.includes('{'))
    .map((u) => parse(u).parts)
    .filter((parts) => parts[0] === 'api' && parts.length > 1);
  return { gateway: under.every((parts) => parts.length > 2) };
}

/** The first label of a host: `conduit.productionready.io` → `conduit`. */
const hostLabel = (origin: string) => origin.replace(/^https?:\/\//, '').split(/[.:]/)[0] || 'api';

/** Split a URL the app calls at its backend. */
export function splitBackendUrl(url: string, layout: BackendLayout = GATEWAY): BackendUrl {
  const { origin, parts, query } = parse(url);
  if (!layout.gateway && parts[0] === 'api') {
    return { origin, backend: origin ? hostLabel(origin) : 'api', prefix: '/api', path: `/${parts.slice(1).join('/')}`, query };
  }
  const at = parts[0] === 'api' && parts.length > 1 ? 1 : 0;
  return {
    origin,
    backend: (parts[at] ?? 'unknown').replace(/\{.*$/, '') || 'unknown',
    prefix: `/${parts.slice(0, at + 1).join('/')}`,
    path: `/${parts.slice(at + 1).join('/')}`,
    query,
  };
}

export const backendOf = (url: string, layout: BackendLayout = GATEWAY): string => splitBackendUrl(url, layout).backend;

/**
 * The files decompose:port writes into a ported MFE so its copied code reads
 * through the MFE's own BFF (ADR-127 §2–3):
 *
 *   src/monolith/__port__/bff-operations.ts  each endpoint the BFF fronts, as a GraphQL
 *                                             document; and every other endpoint's empty body
 *   src/monolith/__port__/bff-http.ts        `bffHttp` (axios-shaped) and `bffFetch`
 *
 * The shim calls the generated connector (`src/platform/bff/bff.ts`), so the
 * endpoint resolution and typed errors are the platform's (ADR-053, ADR-106).
 */

import type { BffOperation, EmptyResponse } from '@seans-mfe/decompose';

const MARK = 'Ported by decompose:port (ADR-127)';

export function operationsModule(ops: BffOperation[], empties: EmptyResponse[]): string {
  return `/**
 * ${MARK}: what this MFE's BFF fronts, one GraphQL document per endpoint, derived
 * from the specs the BFF is generated from; and the empty body of every other
 * endpoint of the proposal, which this MFE does not read. Regenerate with
 * decompose:port rather than editing.
 */
export interface Operation {
  method: string;
  path: string;
  field: string;
  document: string;
  variables: Array<{ name: string; in: 'path' | 'query'; type: 'String' | 'Int' | 'Float' | 'Boolean' }>;
  hoist?: { prop: string; field: string };
}

export const OPERATIONS: Operation[] = ${JSON.stringify(ops, null, 2)};

export const EMPTY: Array<{ method: string; path: string; value: unknown }> = ${JSON.stringify(empties, null, 2)};
`;
}

export function shimModule(hasOperations: boolean): string {
  const connector = hasOperations
    ? "import { query } from '../../platform/bff/bff';"
    : "// This MFE has no BFF: nothing it reads is fronted, so every read is empty.\nconst query = async <T>(): Promise<T> => ({}) as T;";
  return `/**
 * ${MARK}: the monolith's HTTP transport, rerouted to this MFE's BFF.
 *
 * \`bffHttp\` stands in for the monolith's axios instance and \`bffFetch\` for
 * fetch. A request for an endpoint the BFF fronts runs that endpoint's GraphQL
 * document and returns the REST body the monolith's code expects. A request for
 * one it does not front returns that endpoint's empty body and makes no call.
 * Writes are refused until mutations are inferred.
 */
import { BusinessError } from '@seans-mfe-tool/runtime';
${connector}
import { EMPTY, OPERATIONS, type Operation } from './bff-operations';

const segments = (p: string): string[] => p.split('/').filter(Boolean);

function fits(template: string, path: string): boolean {
  const t = segments(template);
  const c = segments(path);
  return t.length === c.length && t.every((s, i) => (s.startsWith('{') && s.endsWith('}')) || s === c[i]);
}

const parse = (url: string): URL => new URL(url, 'http://port.invalid');

function coerce(value: unknown, type: Operation['variables'][number]['type']): unknown {
  if (type === 'Int' || type === 'Float') return Number(value);
  if (type === 'Boolean') return value === true || value === 'true';
  return String(value);
}

function variablesOf(op: Operation, url: URL, params?: Record<string, unknown>): Record<string, unknown> {
  const template = segments(op.path);
  const actual = segments(url.pathname);
  const search: Record<string, unknown> = { ...Object.fromEntries(url.searchParams), ...(params ?? {}) };
  const out: Record<string, unknown> = {};
  for (const v of op.variables) {
    const raw = v.in === 'path' ? actual[template.indexOf(\`{\${v.name}}\`)] : search[v.name];
    if (raw !== undefined && raw !== null) out[v.name] = coerce(raw, v.type);
  }
  return out;
}

const isApi = (path: string): boolean =>
  OPERATIONS.some((o) => fits(o.path, path)) || EMPTY.some((e) => fits(e.path, path));

/** The REST body for a read, or undefined when the URL is no endpoint of the proposal. */
export async function read(method: string, url: string, params?: Record<string, unknown>): Promise<unknown> {
  const u = parse(url);
  const op = OPERATIONS.find((o) => o.method === method && fits(o.path, u.pathname));
  if (op) {
    const data = await query<{ r?: unknown; h?: unknown }>(op.document, variablesOf(op, u, params));
    if (!op.hoist) return data.r;
    return { ...((data.r as Record<string, unknown> | undefined) ?? {}), [op.hoist.prop]: data.h };
  }
  const empty = EMPTY.find((e) => e.method === method && fits(e.path, u.pathname));
  return empty ? JSON.parse(JSON.stringify(empty.value)) : undefined;
}

function refuse(method: string, url: string): never {
  throw new BusinessError(\`\${method} \${url}: a ported MFE reads through its BFF, and writes are not inferred yet\`, 'BFF_WRITE_NOT_PORTED');
}

async function get(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: unknown; status: number; statusText: string; headers: Record<string, string>; config: unknown }> {
  const data = await read('GET', url, config?.params);
  if (data === undefined) {
    throw new BusinessError(\`GET \${url} is not an endpoint this MFE's BFF knows\`, 'BFF_UNKNOWN_ENDPOINT');
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config: config ?? {} };
}

/** The monolith's axios instance, through the BFF. */
export const bffHttp = {
  defaults: { headers: { common: {} as Record<string, string> } },
  interceptors: { request: { use: (): number => 0 }, response: { use: (): number => 0 } },
  get,
  create: () => bffHttp,
  post: (url: string): never => refuse('POST', url),
  put: (url: string): never => refuse('PUT', url),
  patch: (url: string): never => refuse('PATCH', url),
  delete: (url: string): never => refuse('DELETE', url),
};

/** fetch, through the BFF for the proposal's endpoints; anything else is fetched as before. */
export async function bffFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  if (!isApi(parse(url).pathname)) return fetch(input, init);
  if (method !== 'GET') refuse(method, url);
  const data = await read('GET', url);
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
`;
}

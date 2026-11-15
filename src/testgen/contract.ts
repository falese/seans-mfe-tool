/**
 * Contract tests for a BFF (ADR-129 §5, ADR-113 §2): each operation of the
 * OpenAPI documents the BFF is generated from (ADR-112), paired with the
 * upstream response a capture recorded for it.
 *
 * Two halves use the same pairs. The provider half checks the recording
 * against the spec and the demo fixtures (ADR-052) against the recording; the
 * connector half runs the built Mesh with its upstream answered from the
 * recording and expects the recording back, under the REST names
 * (`bffOperations` aliases every field to them).
 *
 * Pure: specs and recordings in, operations out.
 */

import { bffOperations, graphqlName, type BackendLayout, type HoistRule, type OpenApiDocument, type SchemaObject } from '@seans-mfe/decompose';

export interface RecordedResponse {
  status: number;
  mimeType: string;
  body: unknown;
}

export interface ContractOperation {
  /** `METHOD /api/<backend>/<path>` — the endpoint, as the app calls it. */
  call: string;
  /** The recorded request URL the pair was taken from. */
  url: string;
  /** Where the upstream answers it: the spec's path, parameters filled, and the recorded query. */
  upstream: string;
  backend: string;
  field: string;
  document: string;
  variables: Record<string, unknown>;
  hoist?: { prop: string; field: string };
  /** The spec's 2xx JSON response schema, with every `$ref` inlined. */
  schema: SchemaObject;
  status: number;
  body: unknown;
  /** The recording as far as the spec declares it: what the connector must return, unchanged. */
  expected: unknown;
  /** Fields the backend sent that its spec does not declare (`$[].createdAt`): not exposed, and said so. */
  undeclared: string[];
}

export interface ContractPlan {
  operations: ContractOperation[];
  /** Spec operations no recording answers: untested, and said so. */
  unrecorded: string[];
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function inline(doc: OpenApiDocument, schema: SchemaObject | undefined, depth = 0): SchemaObject {
  if (!schema || depth > 20) return {};
  if (schema.$ref) {
    const name = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref)?.[1];
    return inline(doc, name ? doc.components?.schemas?.[name] : undefined, depth + 1);
  }
  const out: SchemaObject = { ...schema };
  if (schema.items) out.items = inline(doc, schema.items, depth + 1);
  if (schema.properties) out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, inline(doc, v, depth + 1)]));
  return out;
}

/** The 2xx JSON schema of the operation the BFF exposes as `field` (its id, camel-cased). */
function responseSchema(doc: OpenApiDocument, field: string): SchemaObject | undefined {
  for (const item of Object.values(doc.paths)) {
    for (const m of METHODS) {
      const op = item[m];
      if (!op?.operationId || graphqlName(op.operationId) !== field) continue;
      const status = Object.keys(op.responses).filter((s) => /^2\d\d$/.test(s)).sort()[0];
      const content = status ? op.responses[status]?.content : undefined;
      const json = content ? Object.keys(content).find((k) => k.includes('json')) : undefined;
      return json && content ? inline(doc, content[json].schema) : undefined;
    }
  }
  return undefined;
}

/**
 * A value as far as its schema declares it, and the paths of what it holds
 * beyond: an object keeps only its declared properties, an array is projected
 * item by item, anything else is kept whole.
 */
export function project(schema: SchemaObject | undefined, value: unknown, at = '$'): { value: unknown; undeclared: string[] } {
  if (Array.isArray(value)) {
    const items = value.map((v) => project(schema?.items, v, `${at}[]`));
    return { value: items.map((i) => i.value), undeclared: [...new Set(items.flatMap((i) => i.undeclared))] };
  }
  if (!schema?.properties || value === null || typeof value !== 'object' || schema['x-smt-mixed']) return { value, undeclared: [] };
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const undeclared: string[] = [];
  for (const k of Object.keys(obj).sort()) {
    const s = schema.properties[k];
    if (!s) {
      undeclared.push(`${at}.${k}`);
      continue;
    }
    const p = project(s, obj[k], `${at}.${k}`);
    out[k] = p.value;
    undeclared.push(...p.undeclared);
  }
  return { value: out, undeclared };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The recorded `METHOD url` keys an endpoint template answers, with its path parameters' values. */
function recordingsFor(method: string, template: string, responses: Record<string, RecordedResponse>): Array<{ key: string; url: string; path: Record<string, string> }> {
  const names: string[] = [];
  const pattern = new RegExp(
    `^${escape(method)} ${template
      .split(/(\{[^}]+\})/)
      .map((part) => {
        const m = /^\{([^}]+)\}$/.exec(part);
        if (!m) return escape(part);
        names.push(m[1]);
        return '([^/?]+)';
      })
      .join('')}(\\?.*)?$`
  );
  return Object.keys(responses)
    .sort()
    .flatMap((key) => {
      const m = pattern.exec(key);
      if (!m) return [];
      return [{ key, url: key.slice(method.length + 1), path: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) }];
    });
}

function cast(value: string, type: string): unknown {
  if (type === 'Int') return Number.parseInt(value, 10);
  if (type === 'Float') return Number(value);
  if (type === 'Boolean') return value === 'true';
  return value;
}

/**
 * The upstream requests a contract test needs answered, for an MFE whose
 * capture saw only its BFF (ADR-129 §5): each GET operation with no required
 * parameter, as the URL its spec's server answers it at and the key
 * `planContracts` looks it up by.
 */
export function upstreamRequests(specs: Record<string, OpenApiDocument>, layout: BackendLayout): Array<{ key: string; url: string }> {
  const out: Array<{ key: string; url: string }> = [];
  for (const backend of Object.keys(specs).sort()) {
    const spec = specs[backend];
    const server = spec.servers?.[0]?.url;
    if (!server) continue;
    for (const [specPath, item] of Object.entries(spec.paths)) {
      const op = item.get;
      if (!op?.operationId || specPath.includes('{') || (op.parameters ?? []).some((p) => p.required)) continue;
      const call = bffOperations({ ...spec, paths: { [specPath]: { get: op } } }, backend, layout)[0];
      if (call) out.push({ key: `GET ${call.path}`, url: `${server.replace(/\/+$/, '')}${specPath}` });
    }
  }
  return out;
}

/**
 * `hoists`, by backend, are the `hoistField` rules the BFF is configured with
 * (its manifest); a backend not named gets the ones a derived BFF would have.
 */
export function planContracts(
  specs: Record<string, OpenApiDocument>,
  responses: Record<string, RecordedResponse>,
  layout: BackendLayout,
  hoists: Record<string, HoistRule[]> = {}
): ContractPlan {
  const operations: ContractOperation[] = [];
  const unrecorded: string[] = [];
  for (const backend of Object.keys(specs).sort()) {
    const spec = specs[backend];
    for (const op of bffOperations(spec, backend, layout, hoists[backend])) {
      const call = `${op.method} ${op.path}`;
      // Reads only: replaying a write against a stub proves nothing about the write.
      const hit = op.method === 'GET' ? recordingsFor(op.method, op.path, responses).find((r) => responses[r.key].status < 300) : undefined;
      if (!hit) {
        unrecorded.push(call);
        continue;
      }
      const recordedUrl = new URL(hit.url, 'http://x');
      const query = recordedUrl.searchParams;
      // The spec path behind the app's: the call's path less its backend prefix, parameters filled.
      const prefix = layout.gateway ? `/api/${backend}` : '/api';
      const template = op.path.startsWith(prefix) ? op.path.slice(prefix.length) : op.path;
      const upstream = template.replace(/\{([^}]+)\}/g, (_m, name: string) => encodeURIComponent(hit.path[name] ?? '')) + recordedUrl.search;
      const variables: Record<string, unknown> = {};
      for (const v of op.variables) {
        const raw = v.in === 'path' ? hit.path[v.name] : query.get(v.name);
        if (raw !== undefined && raw !== null) variables[v.name] = cast(raw, v.type);
      }
      const recorded = responses[hit.key];
      const schema = responseSchema(spec, op.field) ?? {};
      const projected = project(schema, recorded.body);
      operations.push({
        call,
        url: hit.url,
        upstream,
        backend,
        field: op.field,
        document: op.document,
        variables,
        ...(op.hoist ? { hoist: op.hoist } : {}),
        schema,
        status: recorded.status,
        body: recorded.body,
        expected: projected.value,
        undeclared: projected.undeclared,
      });
    }
  }
  return { operations, unrecorded };
}

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

import { bffOperations, type BackendLayout, type OpenApiDocument, type SchemaObject } from '@seans-mfe/decompose';

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
  backend: string;
  field: string;
  document: string;
  variables: Record<string, unknown>;
  hoist?: { prop: string; field: string };
  /** The spec's 2xx JSON response schema, with every `$ref` inlined. */
  schema: SchemaObject;
  status: number;
  body: unknown;
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

function responseSchema(doc: OpenApiDocument, operationId: string): SchemaObject | undefined {
  for (const item of Object.values(doc.paths)) {
    for (const m of METHODS) {
      const op = item[m];
      if (op?.operationId !== operationId) continue;
      const status = Object.keys(op.responses).filter((s) => /^2\d\d$/.test(s)).sort()[0];
      const content = status ? op.responses[status]?.content : undefined;
      const json = content ? Object.keys(content).find((k) => k.includes('json')) : undefined;
      return json && content ? inline(doc, content[json].schema) : undefined;
    }
  }
  return undefined;
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

export function planContracts(specs: Record<string, OpenApiDocument>, responses: Record<string, RecordedResponse>, layout: BackendLayout): ContractPlan {
  const operations: ContractOperation[] = [];
  const unrecorded: string[] = [];
  for (const backend of Object.keys(specs).sort()) {
    const spec = specs[backend];
    for (const op of bffOperations(spec, backend, layout)) {
      const call = `${op.method} ${op.path}`;
      // Reads only: replaying a write against a stub proves nothing about the write.
      const hit = op.method === 'GET' ? recordingsFor(op.method, op.path, responses).find((r) => responses[r.key].status < 300) : undefined;
      if (!hit) {
        unrecorded.push(call);
        continue;
      }
      const query = new URL(hit.url, 'http://x').searchParams;
      const variables: Record<string, unknown> = {};
      for (const v of op.variables) {
        const raw = v.in === 'path' ? hit.path[v.name] : query.get(v.name);
        if (raw !== undefined && raw !== null) variables[v.name] = cast(raw, v.type);
      }
      const recorded = responses[hit.key];
      operations.push({
        call,
        url: hit.url,
        backend,
        field: op.field,
        document: op.document,
        variables,
        ...(op.hoist ? { hoist: op.hoist } : {}),
        schema: responseSchema(spec, op.field) ?? {},
        status: recorded.status,
        body: recorded.body,
      });
    }
  }
  return { operations, unrecorded };
}

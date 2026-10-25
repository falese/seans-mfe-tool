/**
 * An OpenAPI document per backend, inferred from what the app was seen to do
 * (ADR-112, #440).
 *
 * The derived BFFs consume OpenAPI `data.sources`, and a monolith's backends
 * rarely publish a spec. This reads the evidence bundle's recorded traffic —
 * paths, query parameters, status codes, response bodies — and the endpoint
 * templates `decompose:analyze` folded out of the client code, and writes one
 * OpenAPI 3 document per backend:
 *
 *   - paths are templated where code and traffic agree (`/berths/{berthId}`),
 *     and an id-like segment no code explains becomes `{id}`;
 *   - operations seen only in code are kept, marked as such — the client calls
 *     them, the capture just did not get there;
 *   - response schemas are merged from every body seen: the union of keys,
 *     required where every sample had the key;
 *   - every operation names the observations behind it (`x-smt-observed`) and
 *     where it came from (`x-smt-source`), and the document is marked
 *     `x-smt-inferred` — a reviewer can see what is guessed and from what (§2);
 *   - the envelope each list comes in (`{ result }`, `{ Data }`, bare) is
 *     recorded, since the BFF's `hoistField` unwraps it.
 *
 * The document is a lower bound: only what the app was seen to call. Where a
 * backend publishes a spec, that spec is used and `compareSpecs` reports how
 * the inferred one differs (§3).
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI } from 'openapi-types';
import { splitBackendUrl, type BackendLayout, type BackendUrl } from './backends';

export { splitBackendUrl };

export interface SchemaObject {
  type?: string;
  format?: string;
  nullable?: boolean;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  $ref?: string;
  'x-smt-mixed'?: string[];
  [key: string]: unknown;
}

export interface ParameterObject {
  name: string;
  in: 'path' | 'query';
  required: boolean;
  schema: SchemaObject;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  parameters?: ParameterObject[];
  requestBody?: { content: Record<string, { schema: SchemaObject }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: SchemaObject }> }>;
  'x-smt-observed'?: string[];
  'x-smt-source'?: Array<'code' | 'traffic'>;
  'x-smt-envelope'?: string;
  [key: string]: unknown;
}

export type PathItem = Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', OperationObject>>;

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description?: string; [key: string]: unknown };
  servers?: Array<{ url: string }>;
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, SchemaObject> };
  [key: string]: unknown;
}

/** An endpoint template the client code calls, as `decompose:analyze` reads it. */
export interface Endpoint {
  method: string;
  /** URL template; `{name}` is a parameter, `{?}` an unresolved part. */
  url: string;
}

/** A request as `requests.json` records it. */
export interface Observation {
  id: string;
  method: string;
  url: string;
  status?: number | null;
}

export interface RecordedBody {
  status: number;
  mimeType: string;
  body: unknown;
}

export interface InferInput {
  appUrl: string;
  requests: Observation[];
  /** `responses.json`: the first response per `METHOD url`. */
  responses: Record<string, RecordedBody>;
  /** Endpoint templates from the client code (`decompose:analyze`). */
  code: Endpoint[];
  /** One API or a gateway (`backendLayout`); a gateway when not given. */
  layout?: BackendLayout;
}

export interface InferredBackend {
  document: OpenApiDocument;
  /** operationId → the response body recorded for it: the BFF's demo fixtures (ADR-052). */
  mocks: Record<string, unknown>;
}

// ---- schemas -----------------------------------------------------------------

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function kindOf(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

const isObject = (v: unknown): v is Record<string, unknown> => kindOf(v) === 'object';

/** One schema that every sample satisfies. */
export function schemaOf(samples: unknown[]): SchemaObject {
  const kinds = new Set(samples.map(kindOf));
  const nullable = kinds.delete('null');
  if (kinds.has('integer') && kinds.has('number')) kinds.delete('integer');
  const withNull = (s: SchemaObject): SchemaObject => (nullable ? { ...s, nullable: true } : s);
  if (kinds.size === 0) return { nullable: true };
  if (kinds.size > 1) return withNull({ 'x-smt-mixed': [...kinds].sort() });
  const [kind] = [...kinds];
  const present = samples.filter((s) => s !== null && s !== undefined);
  switch (kind) {
    case 'string':
      return withNull(present.every((s) => ISO_DATE_TIME.test(s as string)) ? { type: 'string', format: 'date-time' } : { type: 'string' });
    case 'array': {
      const elements = present.flatMap((s) => s as unknown[]);
      return withNull({ type: 'array', items: elements.length > 0 ? schemaOf(elements) : {} });
    }
    case 'object': {
      const objects = present as Array<Record<string, unknown>>;
      const keys = [...new Set(objects.flatMap((o) => Object.keys(o)))].sort();
      const properties: Record<string, SchemaObject> = {};
      for (const k of keys) properties[k] = schemaOf(objects.filter((o) => k in o).map((o) => o[k]));
      const required = keys.filter((k) => objects.every((o) => k in o));
      return withNull(required.length > 0 ? { type: 'object', properties, required } : { type: 'object', properties });
    }
    default:
      return withNull({ type: kind });
  }
}

// ---- URLs --------------------------------------------------------------------

const segments = (p: string) => p.split('/').filter(Boolean);
const isParam = (seg: string) => /^\{[^}]*\}$/.test(seg);
const ID_LIKE = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,})$/i;

/** True when a concrete path fits a template. */
function fits(template: string, concrete: string): boolean {
  const t = segments(template);
  const c = segments(concrete);
  return t.length === c.length && t.every((s, i) => isParam(s) || s === c[i]);
}

/** A code template with every unresolved part (`{?}`) named. */
function nameUnresolved(path: string): string {
  let n = 0;
  return segments(path)
    .map((s) => (s.includes('{?}') ? `{param${(n += 1)}}` : s))
    .reduce((acc, s) => `${acc}/${s}`, '') || '/';
}

/** A path with every id-like segment templated. */
function templateIds(path: string): string {
  let n = 0;
  return (
    segments(path)
      .map((s) => {
        if (!ID_LIKE.test(s)) return s;
        n += 1;
        return n === 1 ? '{id}' : `{id${n}}`;
      })
      .reduce((acc, s) => `${acc}/${s}`, '') || '/'
  );
}

// ---- naming ------------------------------------------------------------------

const pascal = (s: string) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
const camel = (s: string) => {
  const p = pascal(s);
  return p ? p[0].toLowerCase() + p.slice(1) : p;
};

function operationIdFor(method: string, path: string, isList: boolean): string {
  const segs = segments(path);
  const literal = pascal(segs.filter((s) => !isParam(s)).join('_')) || 'Root';
  const last = segs[segs.length - 1];
  const m = method.toLowerCase();
  if (last && isParam(last)) return `${m}${literal}By${pascal(last.slice(1, -1))}`;
  if (m === 'get') return `${isList ? 'list' : 'get'}${literal}`;
  return `${m}${literal}`;
}

// ---- envelopes ---------------------------------------------------------------

/**
 * The field a list is wrapped in: 'bare' for a bare array, the key for
 * `{ key: [...], meta: {...} }`, or undefined. Everything beside the list must
 * be an object (paging, meta) — `{ id, tags: [...] }` is a record, not a page.
 */
function envelopeOfBody(body: unknown): string | undefined {
  if (Array.isArray(body)) return 'bare';
  if (!isObject(body)) return undefined;
  const keys = Object.keys(body);
  const lists = keys.filter((k) => Array.isArray(body[k]));
  const rest = keys.filter((k) => !lists.includes(k));
  return lists.length === 1 && rest.every((k) => body[k] === null || isObject(body[k])) ? lists[0] : undefined;
}

// ---- inference ---------------------------------------------------------------

interface OpDraft {
  method: string;
  path: string;
  observed: Observation[];
  bodies: unknown[];
  status: Set<number>;
  mime?: string;
  fromCode: boolean;
  query: Map<string, string[]>;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function typeOfValues(values: string[]): SchemaObject {
  if (values.length > 0 && values.every((v) => /^-?\d+$/.test(v))) return { type: 'integer' };
  if (values.length > 0 && values.every((v) => v === 'true' || v === 'false')) return { type: 'boolean' };
  return { type: 'string' };
}

export function inferSpecs(input: InferInput): Record<string, InferredBackend> {
  const appOrigin = (() => {
    try {
      return new URL(input.appUrl).origin;
    } catch {
      return '';
    }
  })();
  const backends = new Map<string, { server: string; ops: Map<string, OpDraft> }>();
  const backendFor = (u: BackendUrl) => {
    if (!backends.has(u.backend)) backends.set(u.backend, { server: `${u.origin || appOrigin}${u.prefix}`, ops: new Map() });
    return backends.get(u.backend) as { server: string; ops: Map<string, OpDraft> };
  };
  const draft = (b: { ops: Map<string, OpDraft> }, method: string, path: string) => {
    const key = `${method} ${path}`;
    if (!b.ops.has(key)) b.ops.set(key, { method, path, observed: [], bodies: [], status: new Set(), fromCode: false, query: new Map() });
    return b.ops.get(key) as OpDraft;
  };

  // Code first: its templates name the parameters traffic can only show values for.
  for (const e of input.code) {
    const u = splitBackendUrl(e.url, input.layout);
    if (u.prefix.includes('{')) continue;
    const op = draft(backendFor(u), e.method.toUpperCase(), nameUnresolved(u.path));
    op.fromCode = true;
    for (const pair of u.query.split('&').filter(Boolean)) {
      const [k] = pair.split('=');
      if (k && !k.includes('{') && !op.query.has(k)) op.query.set(k, []);
    }
  }

  for (const r of input.requests) {
    const u = splitBackendUrl(r.url, input.layout);
    const b = backendFor(u);
    const method = r.method.toUpperCase();
    const template = [...b.ops.values()].find((o) => o.fromCode && o.method === method && fits(o.path, u.path))?.path ?? templateIds(u.path);
    const op = draft(b, method, template);
    op.observed.push(r);
    const recorded = input.responses[`${method} ${r.url}`];
    if (recorded && !op.bodies.includes(recorded.body)) {
      op.status.add(recorded.status);
      op.mime ??= recorded.mimeType;
      if (recorded.status >= 200 && recorded.status < 300) op.bodies.push(recorded.body);
    } else if (r.status) {
      op.status.add(r.status);
    }
    for (const [k, v] of new URLSearchParams(u.query)) op.query.set(k, [...(op.query.get(k) ?? []), v]);
  }

  const out: Record<string, InferredBackend> = {};
  for (const name of [...backends.keys()].sort()) {
    const b = backends.get(name) as { server: string; ops: Map<string, OpDraft> };
    const paths: Record<string, PathItem> = {};
    const mocks: Record<string, unknown> = {};
    const taken = new Set<string>();
    const envelopes: string[] = [];
    const drafts = [...b.ops.values()].sort((x, y) => x.path.localeCompare(y.path) || x.method.localeCompare(y.method));
    for (const op of drafts) {
      const envelope = op.bodies.map(envelopeOfBody).find((e) => e !== undefined);
      let id = operationIdFor(op.method, op.path, envelope !== undefined);
      for (let n = 2; taken.has(id); n += 1) id = `${operationIdFor(op.method, op.path, envelope !== undefined)}${n}`;
      taken.add(id);

      const parameters: ParameterObject[] = [];
      segments(op.path).forEach((seg, i) => {
        if (!isParam(seg)) return;
        const values = op.observed.map((o) => segments(splitBackendUrl(o.url, input.layout).path)[i]).filter((v): v is string => v !== undefined);
        parameters.push({ name: seg.slice(1, -1), in: 'path', required: true, schema: typeOfValues(values) });
      });
      for (const k of [...op.query.keys()].sort()) {
        parameters.push({ name: k, in: 'query', required: false, schema: typeOfValues(op.query.get(k) ?? []) });
      }

      const mime = op.mime && !op.mime.includes('json') ? op.mime : 'application/json';
      const schema: SchemaObject = op.bodies.length > 0 ? (mime === 'application/json' ? schemaOf(op.bodies) : { type: 'string' }) : {};
      const statuses = [...op.status].filter((s) => s >= 200 && s < 300).sort();
      const responses: OperationObject['responses'] = {};
      for (const s of statuses.length > 0 ? statuses : [200]) {
        responses[String(s)] = {
          description: op.bodies.length > 0 ? `Observed response (${op.bodies.length} sample${op.bodies.length === 1 ? '' : 's'})` : 'Not observed — the shape is unknown',
          content: { [mime]: { schema } },
        };
      }

      const operation: OperationObject = {
        operationId: id,
        summary: `${op.method} ${op.path} — inferred`,
        ...(parameters.length > 0 ? { parameters } : {}),
        ...(op.method !== 'GET' && op.method !== 'DELETE' ? { requestBody: { content: { 'application/json': { schema: {} } } } } : {}),
        responses,
        'x-smt-observed': op.observed.map((o) => o.id),
        'x-smt-source': [...(op.fromCode ? (['code'] as const) : []), ...(op.observed.length > 0 ? (['traffic'] as const) : [])],
        ...(envelope ? { 'x-smt-envelope': envelope } : {}),
      };
      if (envelope) envelopes.push(envelope);
      const method = op.method.toLowerCase() as (typeof METHODS)[number];
      if (!METHODS.includes(method)) continue;
      paths[op.path] = { ...(paths[op.path] ?? {}), [method]: operation };
      if (op.bodies.length > 0 && op.method === 'GET') mocks[id] = op.bodies[0];
    }
    const counts = new Map<string, number>();
    for (const e of envelopes) counts.set(e, (counts.get(e) ?? 0) + 1);
    const envelope = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]?.[0];
    out[name] = {
      document: {
        openapi: '3.0.3',
        info: {
          title: `${name} (inferred)`,
          version: '0.0.0-inferred',
          description:
            `Inferred by decompose:propose from recorded traffic and client code (ADR-112). ` +
            'A lower bound: only what the app was seen or written to call. Replace it with the backend\'s own spec when one exists.',
          'x-smt-inferred': true,
          ...(envelope ? { 'x-smt-envelope': envelope } : {}),
        },
        servers: [{ url: b.server }],
        paths,
      },
      mocks: Object.fromEntries(Object.keys(mocks).sort().map((k) => [k, mocks[k]])),
    };
  }
  return out;
}

// ---- reading a document ------------------------------------------------------

function resolve(doc: OpenApiDocument, schema: SchemaObject | undefined, depth = 0): SchemaObject | undefined {
  if (!schema || depth > 20) return schema;
  if (schema.$ref) {
    const name = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref)?.[1];
    return resolve(doc, name ? doc.components?.schemas?.[name] : undefined, depth + 1);
  }
  return schema;
}

function okSchema(doc: OpenApiDocument, op: OperationObject): SchemaObject | undefined {
  const status = Object.keys(op.responses).filter((s) => /^2\d\d$/.test(s)).sort()[0];
  let response: (OperationObject['responses'][string] & { $ref?: string }) | undefined = status ? op.responses[status] : undefined;
  // A response may itself be a reference: `$ref: '#/components/responses/TagsResponse'` (#442).
  const ref = response?.$ref ? /^#\/components\/responses\/(.+)$/.exec(response.$ref)?.[1] : undefined;
  if (ref) response = (doc.components as { responses?: Record<string, OperationObject['responses'][string]> } | undefined)?.responses?.[ref];
  const content = response?.content;
  const json = content ? Object.keys(content).find((k) => k.includes('json')) : undefined;
  return json && content ? resolve(doc, content[json].schema) : undefined;
}

function operations(doc: OpenApiDocument): Array<{ method: string; path: string; op: OperationObject }> {
  const out: Array<{ method: string; path: string; op: OperationObject }> = [];
  for (const path of Object.keys(doc.paths)) {
    for (const m of METHODS) {
      const op = doc.paths[path][m];
      if (op) out.push({ method: m.toUpperCase(), path, op });
    }
  }
  return out;
}

/**
 * The document cut down to the operations a domain calls (`METHOD url`, as
 * `Domain.endpoints`), counting only endpoints of `backend` when given. None
 * named → all of it.
 */
export function restrictSpec(doc: OpenApiDocument, endpoints: string[], backend?: string, layout?: BackendLayout): OpenApiDocument {
  const mine = endpoints
    .map((e) => {
      const [method, url] = e.split(' ');
      const u = splitBackendUrl(url ?? '', layout);
      return { method, backend: u.backend, path: nameUnresolved(u.path) };
    })
    .filter((e) => e.method && (!backend || e.backend === backend));
  const keep = operations(doc).filter(({ method, path }) => mine.some((e) => e.method === method && (fits(path, e.path) || fits(e.path, path))));
  if (keep.length === 0) return doc;
  const paths: Record<string, PathItem> = {};
  for (const { method, path, op } of keep) paths[path] = { ...(paths[path] ?? {}), [method.toLowerCase()]: op };
  return { ...doc, paths };
}

export interface HoistRule {
  typeName: 'Query';
  pathConfig: [string, string];
  newFieldName: string;
}

/** `hoistField` rules that unwrap each GET list wrapped in an envelope (`{ result: [...] }` → `charges`). */
export function hoistsOf(doc: OpenApiDocument): HoistRule[] {
  const out: HoistRule[] = [];
  const names = new Set<string>();
  for (const { method, path, op } of operations(doc)) {
    if (method !== 'GET' || !op.operationId) continue;
    const schema = okSchema(doc, op);
    if (!schema || schema.type !== 'object' || !schema.properties) continue;
    const props = Object.keys(schema.properties);
    const types = props.map((k) => resolve(doc, schema.properties?.[k]));
    const lists = props.filter((_, i) => types[i]?.type === 'array');
    // A page, not a record: everything beside the list is an object (paging, meta).
    if (lists.length !== 1 || !types.every((t) => t?.type === 'array' || t?.type === 'object' || (t?.nullable && !t.type))) continue;
    const literal = segments(path).filter((s) => !isParam(s));
    let name = camel(literal.join('_')) || camel(op.operationId);
    if (names.has(name)) name = camel(op.operationId);
    names.add(name);
    out.push({ typeName: 'Query', pathConfig: [op.operationId, lists[0]], newFieldName: name });
  }
  return out;
}

// ---- comparing to a published spec -------------------------------------------

export interface SpecComparison {
  operations: {
    matched: Array<{ inferred: string; real: string; key: string }>;
    inferredOnly: string[];
    realOnly: string[];
  };
  fields: { matched: number; inferredOnly: string[]; realOnly: string[]; typeMismatches: string[] };
}

const shape = (method: string, path: string) => `${method} ${path.replace(/\{[^}]*\}/g, '{}')}`;

function leaves(doc: OpenApiDocument, schema: SchemaObject | undefined, at = '', depth = 0, out = new Map<string, string>()): Map<string, string> {
  const s = resolve(doc, schema);
  if (!s || depth > 8) return out;
  const isType = (t: string) => s.type === t || (Array.isArray(s.type as unknown) && (s.type as unknown as string[]).includes(t));
  if (isType('object') && s.properties) {
    for (const k of Object.keys(s.properties)) leaves(doc, s.properties[k], at ? `${at}.${k}` : k, depth + 1, out);
    return out;
  }
  if (isType('array')) return leaves(doc, s.items, `${at}[]`, depth + 1, out);
  // OpenAPI 3.1 writes a nullable type as `[string, 'null']`; nullability is not the type.
  const raw: unknown = s.type;
  const types = (Array.isArray(raw) ? raw : [raw]).filter((t): t is string => typeof t === 'string' && t !== 'null');
  const type = types.length === 1 ? types[0] : types.length === 0 ? 'any' : types.sort().join('|');
  if (at) out.set(at, type === 'integer' ? 'number' : type);
  return out;
}

/** How an inferred document differs from the backend's published one (ADR-112 §3). */
export function compareSpecs(inferred: OpenApiDocument, real: OpenApiDocument): SpecComparison {
  const realOps = new Map(operations(real).map((o) => [shape(o.method, o.path), o]));
  const matched: SpecComparison['operations']['matched'] = [];
  const inferredOnly: string[] = [];
  const fields: SpecComparison['fields'] = { matched: 0, inferredOnly: [], realOnly: [], typeMismatches: [] };
  const seen = new Set<string>();
  for (const o of operations(inferred)) {
    const key = shape(o.method, o.path);
    const r = realOps.get(key);
    if (!r) {
      inferredOnly.push(`${o.method} ${o.path}`);
      continue;
    }
    seen.add(key);
    const a = o.op.operationId ?? key;
    const b = r.op.operationId ?? key;
    matched.push({ inferred: a, real: b, key });
    const mine = leaves(inferred, okSchema(inferred, o.op));
    const theirs = leaves(real, okSchema(real, r.op));
    for (const [f, t] of mine) {
      if (!theirs.has(f)) fields.inferredOnly.push(`${a}: ${f}`);
      else {
        fields.matched += 1;
        const u = theirs.get(f);
        if (t !== 'any' && u !== 'any' && t !== u) fields.typeMismatches.push(`${a}: ${f} is ${t}, published as ${u}`);
      }
    }
    for (const f of theirs.keys()) if (!mine.has(f)) fields.realOnly.push(`${b}: ${f}`);
  }
  return {
    operations: {
      matched,
      inferredOnly,
      realOnly: [...realOps.entries()].filter(([k]) => !seen.has(k)).map(([, o]) => `${o.method} ${o.path}`),
    },
    fields,
  };
}

// ---- choosing and checking -----------------------------------------------------

export interface SpecReport {
  backend: string;
  source: 'inferred' | 'published';
  operations: number;
  /** How the inferred document differs from the published one, when both exist. */
  comparison?: SpecComparison;
}

/**
 * One spec per backend: the published one where there is one, else the
 * inferred (ADR-112 §3). A published spec's operationIds differ from the
 * inferred ones, so the recorded responses are re-keyed through the pairing.
 */
export function chooseSpecs(
  inferred: Record<string, InferredBackend>,
  published: Record<string, OpenApiDocument>
): { backends: { specs: Record<string, OpenApiDocument>; mocks: Record<string, Record<string, unknown>> }; report: SpecReport[] } {
  const specs: Record<string, OpenApiDocument> = {};
  const mocks: Record<string, Record<string, unknown>> = {};
  const report: SpecReport[] = [];
  for (const backend of [...new Set([...Object.keys(inferred), ...Object.keys(published)])].sort()) {
    const mine = inferred[backend];
    const theirs = published[backend];
    if (!theirs) {
      specs[backend] = mine.document;
      mocks[backend] = mine.mocks;
      report.push({ backend, source: 'inferred', operations: operations(mine.document).length });
      continue;
    }
    specs[backend] = theirs;
    const comparison = mine ? compareSpecs(mine.document, theirs) : undefined;
    const rekeyed: Record<string, unknown> = {};
    for (const m of comparison?.operations.matched ?? []) if (mine && m.inferred in mine.mocks) rekeyed[m.real] = mine.mocks[m.inferred];
    mocks[backend] = rekeyed;
    report.push({ backend, source: 'published', operations: operations(theirs).length, ...(comparison ? { comparison } : {}) });
  }
  return { backends: { specs, mocks }, report };
}

/** Errors from validating `doc` as OpenAPI; empty when it is valid. */
export async function validateOpenApi(doc: OpenApiDocument): Promise<string[]> {
  try {
    // The parser dereferences in place; validate a copy.
    await SwaggerParser.validate(JSON.parse(JSON.stringify(doc)) as OpenAPI.Document);
    return [];
  } catch (err) {
    return [err instanceof Error ? err.message.split('\n')[0] : String(err)];
  }
}

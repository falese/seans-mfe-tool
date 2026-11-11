/**
 * How a ported MFE reads through its BFF (ADR-127 §2), derived from the
 * OpenAPI documents its BFF is generated from (ADR-112).
 *
 * The monolith's client code asks for `GET /api/<backend>/<path>` and expects
 * the REST body back. The BFF is GraphQL Mesh over the same documents: each
 * operation is a root field named by its `operationId`, field names are
 * camel-cased by the naming-convention transform, and an envelope's list is
 * hoisted to its own root field (`hoistsOf`). So each endpoint becomes one
 * GraphQL document whose aliases restore the REST property names, plus how to
 * put a hoisted list back. The answer is the REST body, and the client code
 * above the transport stays unchanged.
 *
 * Pure: no file system. The port writes these as data into the MFE; verify uses
 * `backendCallsOf` to read a candidate's GraphQL traffic as backend calls.
 */

import { hoistsOf, type OpenApiDocument, type OperationObject, type SchemaObject } from './openapi';
import type { BackendLayout } from './backends';

export interface BffOperation {
  method: string;
  /** The app-relative path template the client calls: `/api/harbormaster/dockings`, `/api/x/{id}`. */
  path: string;
  /** The GraphQL root field: the operation's id. */
  field: string;
  document: string;
  /** Variables the document takes, and where each comes from in the request. */
  variables: Array<{ name: string; in: 'path' | 'query'; type: 'String' | 'Int' | 'Float' | 'Boolean' }>;
  /** An envelope's list the BFF hoists to its own root field, to put back under `prop`. */
  hoist?: { prop: string; field: string };
}

export interface EmptyResponse {
  method: string;
  path: string;
  /** The REST body with every list empty: what an MFE gets for data it does not own. */
  value: unknown;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

/**
 * The naming-convention transform's camelCase (change-case): words split at
 * case changes and non-alphanumerics, the first lower-cased, the rest
 * capitalised; a later word starting with a digit keeps an underscore.
 */
export function graphqlName(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1\0$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1\0$2')
    .split(/[^A-Za-z0-9]+|\0/)
    .filter(Boolean);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i === 0) return lower;
      if (/^[0-9]/.test(w)) return `_${lower}`;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

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
  const content = status ? op.responses[status]?.content : undefined;
  const json = content ? Object.keys(content).find((k) => k.includes('json')) : undefined;
  return json && content ? resolve(doc, content[json].schema) : undefined;
}

/** A GraphQL selection set restoring the REST names; '' for a leaf. */
function selection(doc: OpenApiDocument, schema: SchemaObject | undefined, skip?: string): string {
  const s = resolve(doc, schema);
  if (!s) return '';
  if (s.type === 'array') return selection(doc, s.items);
  if (s['x-smt-mixed'] || s.type !== 'object' || !s.properties || Object.keys(s.properties).length === 0) return '';
  const fields = Object.keys(s.properties)
    .filter((p) => p !== skip)
    .map((p) => {
      const g = graphqlName(p);
      const alias = g !== p && NAME.test(p) ? `${p}: ` : '';
      return `${alias}${g}${selection(doc, s.properties?.[p])}`;
    });
  return fields.length > 0 ? ` { ${fields.join(' ')} }` : '';
}

function emptyOf(doc: OpenApiDocument, schema: SchemaObject | undefined): unknown {
  const s = resolve(doc, schema);
  if (!s) return null;
  if (s.type === 'array') return [];
  if (s.type === 'object' && s.properties) {
    return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, emptyOf(doc, v)]));
  }
  return null;
}

const graphqlType = (s: SchemaObject | undefined): string =>
  s?.type === 'integer' ? 'Int' : s?.type === 'number' ? 'Float' : s?.type === 'boolean' ? 'Boolean' : 'String';

const prefixOf = (backend: string, layout: BackendLayout): string => (layout.gateway ? `/api/${backend}` : '/api');

function* operationsOf(doc: OpenApiDocument): Generator<{ method: string; path: string; op: OperationObject }> {
  for (const path of Object.keys(doc.paths)) {
    for (const m of METHODS) {
      const op = doc.paths[path][m];
      if (op) yield { method: m.toUpperCase(), path, op };
    }
  }
}

/** One GraphQL document per operation of a backend's document (ADR-127 §2). */
export function bffOperations(doc: OpenApiDocument, backend: string, layout: BackendLayout): BffOperation[] {
  const hoists = hoistsOf(doc);
  const out: BffOperation[] = [];
  for (const { method, path, op } of operationsOf(doc)) {
    if (!op.operationId) continue;
    const params = (op.parameters ?? []).filter((p) => NAME.test(p.name));
    const variables = params.map((p) => ({ name: p.name, in: p.in, type: graphqlType(p.schema) as BffOperation['variables'][number]['type'] }));
    const decl = params.map((p) => `$${p.name}: ${graphqlType(p.schema)}${p.required ? '!' : ''}`).join(', ');
    const args = params.length > 0 ? `(${params.map((p) => `${p.name}: $${p.name}`).join(', ')})` : '';
    const hoist = hoists.find((h) => h.pathConfig[0] === op.operationId);
    const schema = okSchema(doc, op);
    const roots: string[] = [];
    const rest = selection(doc, schema, hoist?.pathConfig[1]);
    // A response that is only the hoisted list keeps no fields of its own to ask for.
    if (!hoist || rest) roots.push(`r: ${op.operationId}${args}${rest}`);
    if (hoist) roots.push(`h: ${hoist.newFieldName}${selection(doc, schema?.properties?.[hoist.pathConfig[1]])}`);
    out.push({
      method,
      path: `${prefixOf(backend, layout)}${path}`,
      field: op.operationId,
      document: `query${decl ? ` (${decl})` : ''} { ${roots.join(' ')} }`,
      variables,
      ...(hoist ? { hoist: { prop: hoist.pathConfig[1], field: hoist.newFieldName } } : {}),
    });
  }
  return out;
}

/** Every operation of a backend's document as an empty REST body (ADR-127 §3). */
export function emptyResponses(doc: OpenApiDocument, backend: string, layout: BackendLayout): EmptyResponse[] {
  return [...operationsOf(doc)].map(({ method, path, op }) => ({ method, path: `${prefixOf(backend, layout)}${path}`, value: emptyOf(doc, okSchema(doc, op)) }));
}

/** The root fields a GraphQL document selects (aliases resolved). */
export function rootFields(document: string): string[] {
  const body = document.replace(/#[^\n]*/g, '');
  const open = body.indexOf('{');
  if (open < 0) return [];
  const fields: string[] = [];
  let depth = 0;
  let parens = 0;
  let i = open + 1;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '(') parens += 1;
    else if (ch === ')') parens -= 1;
    else if (parens === 0 && ch === '{') depth += 1;
    else if (parens === 0 && ch === '}') {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && parens === 0 && /[_A-Za-z]/.test(ch)) {
      const m = /^([_A-Za-z][_0-9A-Za-z]*)(\s*:\s*([_A-Za-z][_0-9A-Za-z]*))?/.exec(body.slice(i));
      if (m) {
        fields.push(m[3] ?? m[1]);
        i += m[0].length;
        continue;
      }
    }
    i += 1;
  }
  return fields;
}

/**
 * The backend calls a GraphQL request to a BFF stands for (ADR-127 §4): each
 * root field that is an operation, or a list hoisted from one, as
 * `METHOD /api/<backend>/<path>`. A field and its hoisted list are one call.
 */
export function backendCallsOf(document: string, ops: Array<Pick<BffOperation, 'method' | 'path' | 'field' | 'hoist'>>): string[] {
  const calls = new Set<string>();
  for (const f of rootFields(document)) {
    const op = ops.find((o) => o.field === f || o.hoist?.field === f);
    if (op) calls.add(`${op.method} ${op.path}`);
  }
  return [...calls];
}

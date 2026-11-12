/**
 * The BFF's contract, from its specs alone (ADR-129 §11): what remote:generate
 * gives an MFE before anything has run.
 *
 * For each read operation of each spec the BFF is generated from, an upstream
 * answer is synthesised from the operation's response schema — every declared
 * field, typed as declared, two distinct items per list — and the connector
 * test (`spec.contract.ts`) runs the built Mesh against it and expects every
 * declared value back unchanged, then expects an upstream failure to surface
 * as a GraphQL error rather than as data. A recording (`test:generate`) later
 * adds the same test over real traffic.
 *
 * `planSpecContracts` is pure; `readManifestSpecs` reads the files a manifest names.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { bffOperations, graphqlName, type HoistRule, type OpenApiDocument, type SchemaObject } from '@seans-mfe/decompose';

export interface SpecOperation {
  call: string;
  field: string;
  document: string;
  variables: Record<string, unknown>;
  hoist?: { prop: string; field: string };
  /** The spec path, parameters filled: where the stub answers it. */
  upstream: string;
  /** The synthesised upstream answer. */
  body: unknown;
  /** What the connector must return, under the REST names. */
  expected: unknown;
}

export interface SpecContractPlan {
  operations: SpecOperation[];
  uncovered: Array<{ call: string; why: string }>;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
/** A fixed instant, so a generated file is the same on every run. */
const INSTANT = '2026-01-01T00:00:00.000Z';

function resolve(doc: OpenApiDocument, schema: SchemaObject | undefined, depth = 0): SchemaObject | undefined {
  if (!schema || depth > 20) return schema;
  if (schema.$ref) {
    const name = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref)?.[1];
    return resolve(doc, name ? doc.components?.schemas?.[name] : undefined, depth + 1);
  }
  return schema;
}

/** A value the schema allows, deterministic: item `n` of a list differs from item `n - 1`. */
export function sampleOf(doc: OpenApiDocument, schema: SchemaObject | undefined, n = 1, name = 'value', depth = 0): unknown {
  const s = resolve(doc, schema);
  if (!s || depth > 8) return null;
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[(n - 1) % s.enum.length];
  // The spec's own idea of a valid value; Mesh infers a scalar's type from it (an ISO example is a DateTime).
  if (s.example !== undefined && s.type !== 'array' && s.type !== 'object') return s.example;
  switch (s.type) {
    case 'array':
      return [1, 2].map((i) => sampleOf(doc, s.items, i, name, depth + 1));
    case 'object':
      return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, sampleOf(doc, v, n, k, depth + 1)]));
    case 'integer':
      return n;
    case 'number':
      return n + 0.5;
    case 'boolean':
      return n % 2 === 1;
    case 'string':
      if (s.format === 'date-time') return INSTANT;
      if (s.format === 'date') return INSTANT.slice(0, 10);
      return `${name}-${n}`;
    default:
      return s.nullable ? null : `${name}-${n}`;
  }
}

function okSchema(doc: OpenApiDocument, path: string, method: (typeof METHODS)[number]): SchemaObject | undefined {
  const op = doc.paths[path]?.[method];
  if (!op) return undefined;
  const status = Object.keys(op.responses).filter((s) => /^2\d\d$/.test(s)).sort()[0];
  const content = status ? op.responses[status]?.content : undefined;
  const json = content ? Object.keys(content).find((k) => k.includes('json')) : undefined;
  return json && content ? content[json].schema : undefined;
}

export function planSpecContracts(specs: Record<string, OpenApiDocument>, hoists: Record<string, HoistRule[]> = {}): SpecContractPlan {
  const operations: SpecOperation[] = [];
  const uncovered: SpecContractPlan['uncovered'] = [];
  for (const backend of Object.keys(specs).sort()) {
    const spec = specs[backend];
    const ops = bffOperations(spec, backend, { gateway: true }, hoists[backend]);
    for (const [specPath, item] of Object.entries(spec.paths)) {
      for (const method of METHODS) {
        const op = item[method];
        if (!op?.operationId) continue;
        const planned = ops.find((o) => o.field === graphqlName(op.operationId as string));
        const call = `${method.toUpperCase()} /api/${backend}${specPath}`;
        if (method !== 'get') {
          uncovered.push({ call, why: 'a write: not exercised against a stub' });
          continue;
        }
        const schema = okSchema(spec, specPath, method);
        if (!planned || !schema) {
          uncovered.push({ call, why: 'no JSON response declared to synthesise' });
          continue;
        }
        const variables: Record<string, unknown> = {};
        let upstream = specPath;
        for (const p of op.parameters ?? []) {
          if (!p.required) continue;
          const value = sampleOf(spec, p.schema, 1, p.name);
          if (p.in === 'path') upstream = upstream.replace(`{${p.name}}`, encodeURIComponent(String(value)));
          if (planned.variables.some((v) => v.name === p.name)) variables[p.name] = value;
        }
        if (upstream.includes('{')) {
          uncovered.push({ call, why: 'a path parameter the BFF does not take' });
          continue;
        }
        const body = sampleOf(spec, schema);
        operations.push({
          call,
          field: planned.field,
          document: planned.document,
          variables,
          ...(planned.hoist ? { hoist: planned.hoist } : {}),
          upstream,
          body,
          expected: body,
        });
      }
    }
  }
  return { operations, uncovered };
}

/** The generated connector test and its data, as generator-owned files for remote:generate. */
export interface SpecContractFile {
  path: string;
  content: string;
  overwrite: true;
}

/**
 * The spec contract's files for an MFE with a BFF (ADR-129 §11): data and test,
 * re-stamped on every generation like the rest of the platform's files. None
 * when the MFE declares no data sources, or its specs are not there yet.
 */
export function specContractFiles(
  mfeDir: string,
  mfeName: string,
  specs: Record<string, OpenApiDocument> | undefined,
  hoists: Record<string, HoistRule[]>,
  render: { connector: (mfe: string) => string; mark: string }
): SpecContractFile[] {
  if (!specs || Object.keys(specs).length === 0) return [];
  const plan = planSpecContracts(specs, hoists);
  const dir = `${mfeDir}/src/platform/bff/contract`;
  return [
    {
      path: `${dir}/spec.json`,
      content: `${JSON.stringify({ _comment: `${render.mark}. From specs/*.yaml; regenerated by remote:generate.`, operations: plan.operations, uncovered: plan.uncovered }, null, 2)}\n`,
      overwrite: true,
    },
    { path: `${dir}/spec.contract.ts`, content: render.connector(mfeName), overwrite: true },
  ];
}

/**
 * The OpenAPI documents a manifest's BFF is generated from, by the file name
 * each source names (`./specs/station-os.yaml` → `station-os`). A source given
 * by URL, or a file not there yet, is left out: nothing to synthesise from.
 */
export async function readManifestSpecs(
  manifest: { data?: { sources?: Array<{ handler?: { openapi?: { source?: string } } }> } },
  mfeDir: string
): Promise<Record<string, OpenApiDocument>> {
  const out: Record<string, OpenApiDocument> = {};
  for (const s of manifest.data?.sources ?? []) {
    const source = s.handler?.openapi?.source;
    if (!source || /^https?:\/\//.test(source)) continue;
    const file = path.resolve(mfeDir, source);
    if (!(await fs.pathExists(file))) continue;
    const text = await fs.readFile(file, 'utf8');
    const doc = (/\.json$/i.test(file) ? JSON.parse(text) : yaml.load(text)) as OpenApiDocument;
    if (doc && typeof doc === 'object' && doc.paths) out[path.basename(file).replace(/\.(ya?ml|json)$/i, '')] = doc;
  }
  return out;
}

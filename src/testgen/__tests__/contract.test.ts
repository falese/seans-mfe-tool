import * as ts from 'typescript';
import type { OpenApiDocument } from '@seans-mfe/decompose';
import { planContracts, upstreamRequests } from '../contract';
import { SCHEMA_CHECK } from '../emit';

const spec: OpenApiDocument = {
  openapi: '3.0.3',
  info: { title: 'ledger', version: '1' },
  servers: [{ url: 'http://localhost:5102' }],
  paths: {
    '/charges': {
      get: {
        operationId: 'listCharges',
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'object', properties: { result: { type: 'array', items: { $ref: '#/components/schemas/Charge' } }, meta: { type: 'object', properties: { hasMore: { type: 'boolean' } } } } } } },
          },
        },
      },
    },
    '/charges/{id}': {
      get: { operationId: 'getCharge', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Charge' } } } } } },
    },
    '/payroll': { get: { operationId: 'listPayroll', responses: { '200': { description: 'ok' } } } },
  },
  components: { schemas: { Charge: { type: 'object', properties: { chargeId: { type: 'string' }, amountCents: { type: 'integer' } } } } },
};

const body = { result: [{ chargeId: 'CHG-1', amountCents: 480000 }], meta: { hasMore: false } };

describe('planContracts', () => {
  const plan = planContracts(
    { ledger: spec },
    {
      'GET /api/ledger/charges?limit=50': { status: 200, mimeType: 'application/json', body },
      'GET /api/ledger/charges/CHG-1': { status: 200, mimeType: 'application/json', body: body.result[0] },
    },
    { gateway: true }
  );

  it('pairs each spec operation with the response recorded for it, variables from its URL', () => {
    expect(plan.operations.map((o) => [o.call, o.url, o.variables])).toEqual([
      ['GET /api/ledger/charges', '/api/ledger/charges?limit=50', { limit: 50 }],
      ['GET /api/ledger/charges/{id}', '/api/ledger/charges/CHG-1', { id: 'CHG-1' }],
    ]);
  });

  it('records where the upstream answers each one: the spec path, parameters filled, with its query', () => {
    expect(plan.operations.map((o) => o.upstream)).toEqual(['/charges?limit=50', '/charges/CHG-1']);
  });

  it('carries the hoist and the document that restores the REST names', () => {
    const list = plan.operations[0];
    expect(list.hoist).toEqual({ prop: 'result', field: 'charges' });
    expect(list.document).toContain('h: charges');
  });

  it('inlines the response schema', () => {
    expect(plan.operations[1].schema).toEqual({ type: 'object', properties: { chargeId: { type: 'string' }, amountCents: { type: 'integer' } } });
  });

  it('expects back what the spec declares, and names what the backend sends beyond it', () => {
    const extra = planContracts(
      { ledger: spec },
      { 'GET /api/ledger/charges/CHG-1': { status: 200, mimeType: 'application/json', body: { chargeId: 'CHG-1', amountCents: 5, createdAt: 'x', id: 7 } } },
      { gateway: true }
    ).operations[0];
    expect(extra.expected).toEqual({ chargeId: 'CHG-1', amountCents: 5 });
    expect(extra.undeclared).toEqual(['$.createdAt', '$.id']);
    const list = plan.operations[0];
    expect(list.expected).toEqual(body);
    expect(list.undeclared).toEqual([]);
  });

  it('says which operations no recording covers', () => {
    expect(plan.unrecorded).toEqual(['GET /api/ledger/payroll']);
  });
});

describe('upstreamRequests', () => {
  it('asks each spec server for its GET operations that need no argument, keyed as planContracts looks them up', () => {
    expect(upstreamRequests({ ledger: spec }, { gateway: true })).toEqual([
      { key: 'GET /api/ledger/charges', url: 'http://localhost:5102/charges' },
      { key: 'GET /api/ledger/payroll', url: 'http://localhost:5102/payroll' },
    ]);
  });

  it('pairs a snake_case operation with its recording under the name the BFF gives it', () => {
    const harbormaster = {
      ...spec,
      servers: [{ url: 'http://harbormaster-api:5101/api' }],
      paths: { '/vessels': { get: { operationId: 'list_vessels', responses: { '200': { description: 'ok', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { vessel_name: { type: 'string' } } } } } } } } } } },
      components: {},
    } as OpenApiDocument;
    const [req] = upstreamRequests({ harbormaster }, { gateway: true });
    expect(req).toEqual({ key: 'GET /api/harbormaster/vessels', url: 'http://harbormaster-api:5101/api/vessels' });
    const plan = planContracts({ harbormaster }, { [req.key]: { status: 200, mimeType: 'application/json', body: [{ vessel_name: 'Solace' }] } }, { gateway: true });
    expect(plan.operations.map((o) => [o.field, o.schema.type])).toEqual([['listVessels', 'array']]);
  });
});

describe('the generated schema check', () => {
  const js = ts.transpileModule(SCHEMA_CHECK, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const mod: { exports: { schemaErrors?: (s: unknown, v: unknown) => string[] } } = { exports: {} };
  new Function('module', 'exports', js.outputText)(mod, mod.exports);
  const check = mod.exports.schemaErrors as (s: unknown, v: unknown) => string[];
  const schema = planContracts({ ledger: spec }, { 'GET /api/ledger/charges': { status: 200, mimeType: 'application/json', body } }, { gateway: true }).operations[0].schema;

  it('accepts what the spec describes', () => {
    expect(check(schema, body)).toEqual([]);
  });

  it('names each value the spec does not allow', () => {
    expect(check(schema, { result: [{ chargeId: 7, amountCents: 1.5 }], meta: null })).toEqual([
      '$.result[0].chargeId: number, but the spec says string',
      '$.result[0].amountCents: number, but the spec says integer',
      '$.meta: null, but the spec says object',
    ]);
  });
});

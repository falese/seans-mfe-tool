import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI } from 'openapi-types';
import { chooseSpecs, compareSpecs, hoistsOf, inferSpecs, restrictSpec, schemaOf, splitBackendUrl, validateOpenApi, type OpenApiDocument } from '../openapi';

describe('schemaOf', () => {
  it('merges samples: union of keys, required where every sample has the key', () => {
    expect(schemaOf([{ id: 1, name: 'a' }, { id: 2 }])).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' }, name: { type: 'string' } },
      required: ['id'],
    });
  });
  it('widens integer to number, marks nulls nullable, and recognises timestamps', () => {
    expect(schemaOf([1, 2.5])).toEqual({ type: 'number' });
    expect(schemaOf(['x', null])).toEqual({ type: 'string', nullable: true });
    expect(schemaOf(['2026-10-03T15:40:29.243Z'])).toEqual({ type: 'string', format: 'date-time' });
    expect(schemaOf([null])).toEqual({ nullable: true });
  });
  it('infers array items from every element, and leaves an empty array untyped', () => {
    expect(schemaOf([[{ a: true }, { a: false }]])).toEqual({
      type: 'array',
      items: { type: 'object', properties: { a: { type: 'boolean' } }, required: ['a'] },
    });
    expect(schemaOf([[]])).toEqual({ type: 'array', items: {} });
  });
  it('gives up on a type it cannot reconcile rather than guessing one', () => {
    expect(schemaOf(['x', 1])).toEqual({ 'x-smt-mixed': ['integer', 'string'] });
  });
});

describe('splitBackendUrl', () => {
  it('splits the backend prefix from the path the backend serves', () => {
    expect(splitBackendUrl('/api/harbormaster/berths/7?x=1')).toEqual({ origin: '', backend: 'harbormaster', prefix: '/api/harbormaster', path: '/berths/7', query: 'x=1' });
    expect(splitBackendUrl('https://ledger.example/charges')).toEqual({ origin: 'https://ledger.example', backend: 'charges', prefix: '/charges', path: '/', query: '' });
  });
});

const responses = {
  'GET /api/harbormaster/berths': {
    status: 200,
    mimeType: 'application/json',
    body: [
      { id: 1, berth_id: 'b1', current_docking_id: 4021 },
      { id: 2, berth_id: 'b2', current_docking_id: null },
    ],
  },
  'GET /api/harbormaster/berths/7': { status: 200, mimeType: 'application/json', body: { id: 7, berth_id: 'b7', current_docking_id: null } },
  'GET /api/ledger/charges?limit=50&open=true': {
    status: 200,
    mimeType: 'application/json',
    body: { meta: { cursor: null, hasMore: false }, result: [{ chargeId: 'C-1', amountCents: 1200 }] },
  },
  'GET /api/ledger/payroll/88': { status: 200, mimeType: 'application/json', body: { result: { crewRef: 'CRW-0088' } } },
};
const requests = [
  { id: 'home.0.r0', method: 'GET', url: '/api/harbormaster/berths', status: 200 },
  { id: 'home.1.r0', method: 'GET', url: '/api/harbormaster/berths/7', status: 200 },
  { id: 'home.1.r1', method: 'GET', url: '/api/ledger/charges?limit=50&open=true', status: 200 },
  { id: 'home.2.r0', method: 'GET', url: '/api/ledger/payroll/88', status: 200 },
  // Same call again: one more observation of the same operation.
  { id: 'home.3.r0', method: 'GET', url: '/api/harbormaster/berths', status: 200 },
];
const code = [
  { method: 'GET', url: '/api/harbormaster/berths' },
  { method: 'GET', url: '/api/harbormaster/berths/{berthId}' },
  // Never exercised by the capture: from code only.
  { method: 'GET', url: '/api/harbormaster/vessels/{?}' },
];

describe('inferSpecs', () => {
  const specs = inferSpecs({ appUrl: 'http://localhost:5173/', requests, responses, code });

  it('writes one OpenAPI 3 document per backend, served from the app’s origin under the backend’s prefix', () => {
    expect(Object.keys(specs)).toEqual(['harbormaster', 'ledger']);
    const hm = specs.harbormaster.document;
    expect(hm.openapi).toBe('3.0.3');
    expect(hm.servers).toEqual([{ url: 'http://localhost:5173/api/harbormaster' }]);
    expect(hm.info['x-smt-inferred']).toBe(true);
  });

  it('templates paths where traffic and code agree, and keeps operations seen only in code', () => {
    const paths = specs.harbormaster.document.paths;
    expect(Object.keys(paths)).toEqual(['/berths', '/berths/{berthId}', '/vessels/{param1}']);
    const one = paths['/berths/{berthId}'].get;
    expect(one).toMatchObject({
      operationId: 'getBerthsByBerthId',
      parameters: [{ name: 'berthId', in: 'path', required: true, schema: { type: 'integer' } }],
      'x-smt-observed': ['home.1.r0'],
      'x-smt-source': ['code', 'traffic'],
    });
    const vessels = paths['/vessels/{param1}'].get;
    expect(vessels).toMatchObject({ operationId: 'getVesselsByParam1', 'x-smt-observed': [], 'x-smt-source': ['code'] });
    expect(vessels?.parameters).toEqual([{ name: 'param1', in: 'path', required: true, schema: { type: 'string' } }]);
  });

  it('templates an id-like segment that no code explains', () => {
    expect(Object.keys(specs.ledger.document.paths)).toEqual(['/charges', '/payroll/{id}']);
  });

  it('records every observation, query parameters with their types, and the response schema', () => {
    const list = specs.harbormaster.document.paths['/berths'].get;
    expect(list?.operationId).toBe('listBerths');
    expect(list?.['x-smt-observed']).toEqual(['home.0.r0', 'home.3.r0']);
    expect(list?.responses['200'].content?.['application/json'].schema).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: { berth_id: { type: 'string' }, current_docking_id: { type: 'integer', nullable: true }, id: { type: 'integer' } },
        required: ['berth_id', 'current_docking_id', 'id'],
      },
    });
    const charges = specs.ledger.document.paths['/charges'].get;
    expect(charges?.parameters).toEqual([
      { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
      { name: 'open', in: 'query', required: false, schema: { type: 'boolean' } },
    ]);
  });

  it('records the envelope each list comes in', () => {
    expect(specs.harbormaster.document.info['x-smt-envelope']).toBe('bare');
    expect(specs.ledger.document.info['x-smt-envelope']).toBe('result');
    expect(specs.ledger.document.paths['/charges'].get?.['x-smt-envelope']).toBe('result');
  });

  it('keeps each observed response as a mock, keyed by operationId', () => {
    expect(Object.keys(specs.ledger.mocks)).toEqual(['getPayrollById', 'listCharges']);
    expect(specs.ledger.mocks.listCharges).toEqual(responses['GET /api/ledger/charges?limit=50&open=true'].body);
  });

  it('produces documents that validate as OpenAPI 3', async () => {
    for (const s of Object.values(specs)) {
      await expect(SwaggerParser.validate(JSON.parse(JSON.stringify(s.document)) as OpenAPI.Document)).resolves.toBeDefined();
    }
  });
});

describe('restrictSpec', () => {
  it('keeps only the operations a domain calls', () => {
    const { harbormaster } = inferSpecs({ appUrl: 'http://localhost:5173', requests, responses, code });
    const doc = restrictSpec(harbormaster.document, ['GET /api/harbormaster/berths/{id}', 'GET /api/ledger/vessels/{id}'], 'harbormaster');
    expect(Object.keys(doc.paths)).toEqual(['/berths/{berthId}']);
  });
  it('keeps everything when the domain names no operation of this backend', () => {
    const { harbormaster } = inferSpecs({ appUrl: 'http://localhost:5173', requests, responses, code });
    expect(Object.keys(restrictSpec(harbormaster.document, []).paths)).toHaveLength(3);
  });
});

describe('hoistsOf', () => {
  it('unwraps each list that comes in an envelope, and nothing else', () => {
    const { ledger, harbormaster } = inferSpecs({ appUrl: 'http://localhost:5173', requests, responses, code });
    expect(hoistsOf(ledger.document)).toEqual([{ typeName: 'Query', pathConfig: ['listCharges', 'result'], newFieldName: 'charges' }]);
    expect(hoistsOf(harbormaster.document)).toEqual([]);
  });
  it('reads a published spec’s envelope through $refs', () => {
    expect(hoistsOf(real)).toEqual([{ typeName: 'Query', pathConfig: ['list_berths', 'Data'], newFieldName: 'berths' }]);
  });
});

const real: OpenApiDocument = {
  openapi: '3.0.3',
  info: { title: 'Harbormaster', version: '1' },
  paths: {
    '/berths': {
      get: {
        operationId: 'list_berths',
        responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/page' } } } } },
      },
    },
    '/berths/{id}': {
      get: {
        operationId: 'get_berth',
        responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/berth' } } } } },
      },
    },
    '/vessels': { get: { operationId: 'list_vessels', responses: { '200': { description: 'ok' } } } },
  },
  components: {
    schemas: {
      page: { type: 'object', properties: { Data: { type: 'array', items: { $ref: '#/components/schemas/berth' } } } },
      berth: { type: 'object', properties: { id: { type: 'integer' }, berth_id: { type: 'string' }, max_mass_kg: { type: 'number' } } },
    },
  },
};

describe('compareSpecs', () => {
  it('pairs operations by method and path shape, and compares their response fields', () => {
    const inferred = inferSpecs({
      appUrl: 'http://localhost:5173',
      requests: [{ id: 's.0.r0', method: 'GET', url: '/api/hm/berths/3', status: 200 }, { id: 's.0.r1', method: 'GET', url: '/api/hm/cranes', status: 200 }],
      responses: {
        'GET /api/hm/berths/3': { status: 200, mimeType: 'application/json', body: { id: 3, berth_id: 'b3', note: 'x' } },
        'GET /api/hm/cranes': { status: 200, mimeType: 'application/json', body: [] },
      },
      code: [],
    }).hm.document;
    const diff = compareSpecs(inferred, real);
    expect(diff.operations).toEqual({
      matched: [{ inferred: 'getBerthsById', real: 'get_berth', key: 'GET /berths/{}' }],
      inferredOnly: ['GET /cranes'],
      realOnly: ['GET /berths', 'GET /vessels'],
    });
    expect(diff.fields).toEqual({ matched: 2, inferredOnly: ['getBerthsById: note'], realOnly: ['get_berth: max_mass_kg'], typeMismatches: [] });
  });
});

describe('chooseSpecs', () => {
  const inferred = inferSpecs({
    appUrl: 'http://localhost:5173',
    requests: [{ id: 's.0.r0', method: 'GET', url: '/api/hm/berths', status: 200 }, { id: 's.0.r1', method: 'GET', url: '/api/ledger/charges', status: 200 }],
    responses: {
      'GET /api/hm/berths': { status: 200, mimeType: 'application/json', body: { Data: [{ id: 1 }] } },
      'GET /api/ledger/charges': { status: 200, mimeType: 'application/json', body: [] },
    },
    code: [],
  });

  it('uses a published spec where there is one, re-keys its fixtures and reports how the inferred one differs', () => {
    const { backends, report } = chooseSpecs(inferred, { hm: real });
    expect(backends.specs.hm).toBe(real);
    expect(backends.mocks?.hm).toEqual({ list_berths: { Data: [{ id: 1 }] } });
    expect(backends.specs.ledger).toBe(inferred.ledger.document);
    expect(report.map((r) => [r.backend, r.source, r.operations])).toEqual([
      ['hm', 'published', 3],
      ['ledger', 'inferred', 1],
    ]);
    expect(report[0].comparison?.operations.matched).toEqual([{ inferred: 'listBerths', real: 'list_berths', key: 'GET /berths' }]);
  });
});

describe('validateOpenApi', () => {
  it('returns no errors for a valid document and the parser’s message for an invalid one', async () => {
    expect(await validateOpenApi(real)).toEqual([]);
    // An operation without responses is not OpenAPI.
    const broken = { ...real, paths: { '/x': { get: { operationId: 'x' } } } } as unknown as OpenApiDocument;
    expect(await validateOpenApi(broken)).toHaveLength(1);
  });
});

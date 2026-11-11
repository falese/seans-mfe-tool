import { backendCallsOf, bffOperations, bffReads, graphqlName, rootFields } from '../bff-plan';
import type { OpenApiDocument } from '../openapi';

const ledger: OpenApiDocument = {
  openapi: '3.0.3',
  info: { title: 'ledger', version: '1' },
  paths: {
    '/charges': {
      get: {
        operationId: 'listCharges',
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: { type: 'array', items: { type: 'object', properties: { chargeId: { type: 'string' }, amount_cents: { type: 'integer' } } } },
                    meta: { type: 'object', properties: { cursor: { type: 'string', nullable: true }, hasMore: { type: 'boolean' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/dockings/{id}': {
      get: {
        operationId: 'getDocking',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object', properties: { Data: { type: 'object', properties: { BerthId: { type: 'string' } } } } } } } } },
      },
    },
  },
};

describe('reading through the BFF (ADR-127 §2)', () => {
  it('camel-cases names as the naming-convention transform does', () => {
    expect(['berth_id', 'Data', 'MetricValue', 'eta_utc', 'HTTPStatus', 'level_2', 'id'].map(graphqlName)).toEqual([
      'berthId', 'data', 'metricValue', 'etaUtc', 'httpStatus', 'level_2', 'id',
    ]);
  });

  it('writes one document per operation, aliased back to the REST names, with the hoisted list asked for on its own', () => {
    const ops = bffOperations(ledger, 'ledger', { gateway: true });
    expect(ops[0]).toEqual({
      method: 'GET',
      path: '/api/ledger/charges',
      field: 'listCharges',
      document: 'query { r: listCharges { meta { cursor hasMore } } h: charges { chargeId amount_cents: amountCents } }',
      variables: [],
      hoist: { prop: 'result', field: 'charges' },
    });
    expect(ops[1]).toMatchObject({
      path: '/api/ledger/dockings/{id}',
      document: 'query ($id: String!) { r: getDocking(id: $id) { Data: data { BerthId: berthId } } }',
      variables: [{ name: 'id', in: 'path', type: 'String' }],
    });
  });

  it('reads a request to a BFF as the backend calls it stands for (ADR-127 §4)', () => {
    const ops = bffOperations(ledger, 'ledger', { gateway: true });
    expect(rootFields('query ($id: String!) { r: getDocking(id: $id) { Data: data { BerthId: berthId } } other }')).toEqual(['getDocking', 'other']);
    expect(backendCallsOf(ops[0].document, ops)).toEqual(['GET /api/ledger/charges']);
    expect(backendCallsOf('{ charges { chargeId } unknownField }', ops)).toEqual(['GET /api/ledger/charges']);
  });

  it('reads each endpoint in the BFF\'s own shape: camel-cased, the envelope\'s list unwrapped (ADR-128 §5)', () => {
    const reads = bffReads(ledger, 'ledger', { gateway: true });
    expect(reads[0]).toEqual({
      method: 'GET',
      path: '/api/ledger/charges',
      field: 'charges',
      document: 'query { charges { chargeId amountCents } }',
      variables: [],
      empty: [],
    });
    expect(reads[1]).toEqual({
      method: 'GET',
      path: '/api/ledger/dockings/{id}',
      field: 'getDocking',
      document: 'query ($id: String!) { getDocking(id: $id) { data { berthId } } }',
      variables: [{ name: 'id', in: 'path', type: 'String' }],
      empty: { data: { berthId: null } },
    });
    // Verify still reads the hoisted field as the operation's backend call.
    expect(backendCallsOf(reads[0].document, bffOperations(ledger, 'ledger', { gateway: true }))).toEqual(['GET /api/ledger/charges']);
  });
});

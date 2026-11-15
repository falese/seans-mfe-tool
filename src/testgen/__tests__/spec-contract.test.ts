import type { OpenApiDocument } from '@seans-mfe/decompose';
import { planSpecContracts, sampleOf } from '../spec-contract';

const harbormaster: OpenApiDocument = {
  openapi: '3.0.3',
  info: { title: 'harbormaster', version: '1' },
  servers: [{ url: 'http://harbormaster-api:5101/api' }],
  paths: {
    '/vessels': {
      get: {
        operationId: 'list_vessels',
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Vessel' } } } },
          },
        },
      },
    },
    '/vessels/{vessel_registry_no}': {
      get: {
        operationId: 'get_vessel',
        parameters: [{ name: 'vessel_registry_no', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Vessel' } } } } },
      },
    },
    '/vessels/{id}/notes': {
      post: { operationId: 'add_note', responses: { '201': { description: 'created' } } },
    },
  },
  components: {
    schemas: {
      Vessel: {
        type: 'object',
        required: ['vessel_registry_no'],
        properties: {
          vessel_registry_no: { type: 'string' },
          max_capacity_kg: { type: 'integer' },
          status: { type: 'string', enum: ['DOCKED', 'DEPARTED'] },
          eta_utc: { type: 'string', format: 'date-time' },
          insured: { type: 'boolean' },
        },
      },
    },
  },
};

const ledger: OpenApiDocument = {
  openapi: '3.0.3',
  info: { title: 'ledger', version: '1' },
  servers: [{ url: 'http://ledger:5102/api' }],
  paths: {
    '/accounts': {
      get: {
        operationId: 'listAccounts',
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: { type: 'array', items: { type: 'object', properties: { accountId: { type: 'string' }, balanceCents: { type: 'integer' } } } },
                    meta: { type: 'object', properties: { hasMore: { type: 'boolean' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

describe('sampleOf', () => {
  it('fills every declared field, distinct per array item, as the spec types it', () => {
    const v = sampleOf(harbormaster, harbormaster.paths['/vessels'].get?.responses['200'].content?.['application/json'].schema) as Array<Record<string, unknown>>;
    expect(v).toHaveLength(2);
    expect(v[0]).toEqual({ vessel_registry_no: 'vessel_registry_no-1', max_capacity_kg: 1, status: 'DOCKED', eta_utc: '2026-01-01T00:00:00.000Z', insured: true });
    expect(v[1].vessel_registry_no).toBe('vessel_registry_no-2');
    expect(v[1].max_capacity_kg).toBe(2);
  });
});

describe('sampleOf, with examples', () => {
  it('uses the value the spec gives as an example: Mesh infers the field\'s type from it', () => {
    const doc = { ...harbormaster, components: {} } as OpenApiDocument;
    expect(sampleOf(doc, { type: 'object', properties: { eta_utc: { type: 'string', example: '2026-07-18T14:30:00Z' }, n: { type: 'integer', example: 7 } } })).toEqual({ eta_utc: '2026-07-18T14:30:00Z', n: 7 });
  });
});

describe('planSpecContracts', () => {
  const plan = planSpecContracts({ harbormaster, ledger }, { harbormaster: [], ledger: [{ typeName: 'Query', pathConfig: ['listAccounts', 'result'], newFieldName: 'accounts' }] });

  it('plans every read the spec declares, path parameters filled, as the BFF names it', () => {
    expect(plan.operations.map((o) => [o.field, o.upstream, o.variables])).toEqual([
      ['listVessels', '/vessels', {}],
      ['getVessel', '/vessels/vessel_registry_no-1', { vessel_registry_no: 'vessel_registry_no-1' }],
      ['listAccounts', '/accounts', {}],
    ]);
  });

  it('expects back every declared field the synthesised upstream sent', () => {
    const accounts = plan.operations[2];
    expect(accounts.hoist).toEqual({ prop: 'result', field: 'accounts' });
    expect(accounts.expected).toEqual(accounts.body);
  });

  it('says which operations it does not cover, and why', () => {
    expect(plan.uncovered).toEqual([{ call: 'POST /api/harbormaster/vessels/{id}/notes', why: 'a write: not exercised against a stub' }]);
  });
});

describe('the files remote:generate writes', () => {
  it('reads the specs the manifest names, by file name, skipping URLs and missing files', async () => {
    const os = await import('os');
    const fsx = await import('fs-extra');
    const path = await import('path');
    const dir = await fsx.mkdtemp(path.join(os.tmpdir(), 'spec-contract-'));
    try {
      await fsx.outputFile(path.join(dir, 'specs', 'station-os.yaml'), 'openapi: 3.0.3\ninfo: { title: s, version: "1" }\npaths: {}\n');
      const { readManifestSpecs } = await import('../spec-contract');
      const specs = await readManifestSpecs(
        { data: { sources: [{ handler: { openapi: { source: './specs/station-os.yaml' } } }, { handler: { openapi: { source: 'https://x/spec.yaml' } } }, { handler: { openapi: { source: './specs/gone.yaml' } } }] } },
        dir
      );
      expect(Object.keys(specs)).toEqual(['station-os']);
    } finally {
      await fsx.remove(dir);
    }
  });

  it('writes the data and the test as generator-owned files; none without specs', async () => {
    const { specContractFiles } = await import('../spec-contract');
    const files = specContractFiles('/m', 'm', { harbormaster }, {}, { mark: 'MARK', connector: (mfe) => `test for ${mfe}` });
    expect(files.map((f) => [f.path, f.overwrite])).toEqual([
      ['/m/src/platform/bff/contract/spec.json', true],
      ['/m/src/platform/bff/contract/spec.contract.ts', true],
    ]);
    expect(files[1].content).toBe('test for m');
    expect(specContractFiles('/m', 'm', {}, {}, { mark: 'M', connector: () => '' })).toEqual([]);
  });
});

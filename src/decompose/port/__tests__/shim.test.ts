import * as ts from 'typescript';
import { bffOperations, emptyResponses, type OpenApiDocument } from '@seans-mfe/decompose';
import { operationsModule, shimModule } from '../shim';

const spec = (backend: string, path: string, operationId: string, schema: Record<string, unknown>): OpenApiDocument => ({
  openapi: '3.0.3',
  info: { title: backend, version: '1' },
  paths: { [path]: { get: { operationId, parameters: path.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }] : [], responses: { '200': { description: 'ok', content: { 'application/json': { schema } } } } } } },
});

const ledger = spec('ledger', '/charges', 'listCharges', {
  type: 'object',
  properties: { result: { type: 'array', items: { type: 'object', properties: { charge_id: { type: 'string' } } } }, meta: { type: 'object', properties: { hasMore: { type: 'boolean' } } } },
});
const harbor = spec('harbormaster', '/dockings/{id}', 'getDocking', { type: 'object', properties: { berth_id: { type: 'string' } } });
const stationos = spec('stationos', '/modules', 'listModules', { type: 'object', properties: { Data: { type: 'array', items: { type: 'object' } } } });

type Shim = {
  bffHttp: { get(url: string, c?: { params?: Record<string, unknown> }): Promise<{ data: unknown }>; post(url: string): never };
  bffFetch(url: string, init?: RequestInit): Promise<{ json(): Promise<unknown> }>;
};

function load(query: jest.Mock): Shim {
  const compile = (src: string) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const layout = { gateway: true };
  const ops = [...bffOperations(ledger, 'ledger', layout), ...bffOperations(harbor, 'harbormaster', layout)];
  const opsModule = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', compile(operationsModule(ops, emptyResponses(stationos, 'stationos', layout))))(opsModule, opsModule.exports);
  class BusinessError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
    }
  }
  const modules: Record<string, unknown> = {
    '@seans-mfe-tool/runtime': { BusinessError },
    '../../platform/bff/bff': { query },
    './bff-operations': opsModule.exports,
  };
  const shim = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', 'require', compile(shimModule(true)))(shim, shim.exports, (m: string) => modules[m]);
  return shim.exports as unknown as Shim;
}

describe('the BFF transport a port writes (ADR-127 §2–3)', () => {
  it('answers a REST read from its GraphQL document, with the hoisted list put back', async () => {
    const query = jest.fn(async () => ({ r: { meta: { hasMore: false } }, h: [{ charge_id: 'C1' }] }));
    const { bffHttp } = load(query);
    await expect(bffHttp.get('/api/ledger/charges')).resolves.toMatchObject({ data: { meta: { hasMore: false }, result: [{ charge_id: 'C1' }] } });
    expect(query).toHaveBeenCalledWith('query { r: listCharges { meta { hasMore } } h: charges { charge_id: chargeId } }', {});
  });

  it('passes path parameters as typed variables', async () => {
    const query = jest.fn(async () => ({ r: { berth_id: 'b2' } }));
    const { bffHttp } = load(query);
    await expect(bffHttp.get('/api/harbormaster/dockings/42')).resolves.toMatchObject({ data: { berth_id: 'b2' } });
    expect(query.mock.calls[0][1]).toEqual({ id: 42 });
  });

  it('returns an empty body, with no call, for an endpoint this MFE does not front', async () => {
    const query = jest.fn();
    const { bffHttp } = load(query);
    await expect(bffHttp.get('/api/stationos/modules')).resolves.toMatchObject({ data: { Data: [] } });
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses writes and unknown endpoints rather than reaching a backend directly', async () => {
    const { bffHttp } = load(jest.fn());
    expect(() => bffHttp.post('/api/ledger/charges')).toThrow(/writes are not inferred/);
    await expect(bffHttp.get('/api/elsewhere')).rejects.toThrow(/not an endpoint/);
  });

  it('serves fetch through the BFF for the proposal\'s endpoints and leaves other URLs alone', async () => {
    const query = jest.fn(async () => ({ r: { meta: { hasMore: true } }, h: [] }));
    const { bffFetch } = load(query);
    const original = global.fetch;
    const passthrough = jest.fn(async () => ({ json: async () => 'asset' }));
    (global as unknown as { fetch: unknown }).fetch = passthrough;
    (global as unknown as { Response: unknown }).Response ??= class {
      constructor(private readonly body: string) {}
      async json() {
        return JSON.parse(this.body);
      }
    };
    try {
      await expect((await bffFetch('/api/ledger/charges')).json()).resolves.toEqual({ meta: { hasMore: true }, result: [] });
      await expect((await bffFetch('/static/logo.svg')).json()).resolves.toBe('asset');
      expect(passthrough).toHaveBeenCalledTimes(1);
    } finally {
      (global as unknown as { fetch: unknown }).fetch = original;
    }
  });
});

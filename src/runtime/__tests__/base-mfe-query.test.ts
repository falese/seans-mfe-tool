/**
 * Tests for BaseMFE.doQuery() default implementation.
 *
 * Verifies that the base class dispatches to the BFF endpoint using
 * context.inputs.document + variables, forwards JWT, and resolves the
 * BFF URL from deps.bffUrl → BFF_URL env → manifest.data.serve.endpoint.
 */

import { BaseMFE } from '../base-mfe';
import type { Context, QueryInput } from '../context';
import type {
  LoadResult,
  RenderResult,
  HealthResult,
  DescribeResult,
  SchemaResult,
  EmitResult,
  ControlPlaneStateResult,
} from '../base-mfe';

// Minimal concrete subclass — only overrides the abstract methods that remain abstract.
class TestMFE extends BaseMFE {
  protected async doLoad(_ctx: Context): Promise<LoadResult> {
    return { status: 'loaded', timestamp: new Date() };
  }
  protected async doRender(_ctx: Context): Promise<RenderResult> {
    return { status: 'rendered', timestamp: new Date() };
  }
  protected async doRefresh(_ctx: Context): Promise<void> {}
  protected async doAuthorizeAccess(_ctx: Context): Promise<boolean> { return true; }
  protected async doHealth(_ctx: Context): Promise<HealthResult> {
    return { status: 'healthy', checks: [], timestamp: new Date() };
  }
  protected async doDescribe(_ctx: Context): Promise<DescribeResult> {
    return { name: 'test', version: '1.0.0', type: 'bff', capabilities: [], manifest: this.manifest };
  }
  protected async doSchema(_ctx: Context): Promise<SchemaResult> {
    return { schema: '{}', format: 'json' };
  }
  protected async doEmit(_ctx: Context): Promise<EmitResult> {
    return { emitted: true };
  }
  protected async doUpdateControlPlaneState(_ctx: Context): Promise<ControlPlaneStateResult> {
    return { acknowledged: true, correlationId: 'test' };
  }
}

const BASE_MANIFEST = {
  name: 'test-mfe',
  version: '1.0.0',
  type: 'bff',
  language: 'typescript',
} as const;

function makeContext(inputs?: QueryInput, extra?: Partial<Context>): Context {
  return {
    requestId: 'req-test',
    timestamp: new Date(),
    inputs: inputs as Record<string, unknown> | undefined,
    ...extra,
  };
}

describe('BaseMFE.doQuery() — default BFF dispatch', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    delete process.env['BFF_URL'];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a POST to deps.bffUrl with document and variables', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { hello: 'world' } }),
    });

    const mfe = new TestMFE(BASE_MANIFEST, { bffUrl: 'http://localhost:4000/graphql' });
    const ctx = makeContext({ document: '{ hello }', variables: { id: '1' } });
    const result = await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query: '{ hello }', variables: { id: '1' } }),
      }),
    );
    expect(result).toEqual({ data: { hello: 'world' }, errors: undefined });
  });

  it('forwards context.jwt as Authorization header', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const mfe = new TestMFE(BASE_MANIFEST, { bffUrl: 'http://bff/graphql' });
    const ctx = makeContext({ document: '{ me }' }, { jwt: 'my-token' });
    await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token');
  });

  it('returns { data, errors } on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { user: { id: '42' } } }),
    });

    const mfe = new TestMFE(BASE_MANIFEST, { bffUrl: 'http://bff/graphql' });
    const ctx = makeContext({ document: 'query { user { id } }' });
    const result = await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    expect(result).toEqual({ data: { user: { id: '42' } }, errors: undefined });
  });

  it('returns { data: null, errors } when HTTP response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });

    const mfe = new TestMFE(BASE_MANIFEST, { bffUrl: 'http://bff/graphql' });
    const ctx = makeContext({ document: '{ hello }' });
    const result = await (mfe as unknown as { doQuery: (c: Context) => Promise<{ data: unknown; errors: unknown[] }> }).doQuery(ctx);

    expect(result.data).toBeNull();
    expect((result.errors as Array<{ message: string }>)[0].message).toMatch(/BFF request failed: 503/);
  });

  it('throws ValidationError when context.inputs.document is missing', async () => {
    const mfe = new TestMFE(BASE_MANIFEST, { bffUrl: 'http://bff/graphql' });
    const ctx = makeContext(undefined);

    await expect(
      (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx),
    ).rejects.toThrow(/document is required/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to BFF_URL env var when deps.bffUrl is not set', async () => {
    process.env['BFF_URL'] = 'http://env-bff/graphql';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const mfe = new TestMFE(BASE_MANIFEST);
    const ctx = makeContext({ document: '{ hello }' });
    await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    expect(fetchMock).toHaveBeenCalledWith('http://env-bff/graphql', expect.anything());
  });

  it('derives absolute URL from manifest.endpoint + data.serve.endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const manifestWithEndpoint = {
      ...BASE_MANIFEST,
      endpoint: 'http://localhost:3001',
      data: { sources: [], serve: { endpoint: '/graphql', playground: true } },
    };

    const mfe = new TestMFE(manifestWithEndpoint as unknown as typeof BASE_MANIFEST);
    const ctx = makeContext({ document: '{ hello }' });
    await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/graphql', expect.anything());
  });

  it('falls back to manifest data.serve.endpoint (relative) when no endpoint field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const manifestWithServe = {
      ...BASE_MANIFEST,
      data: { sources: [], serve: { endpoint: '/api/graphql', playground: false } },
    };

    const mfe = new TestMFE(manifestWithServe as unknown as typeof BASE_MANIFEST);
    const ctx = makeContext({ document: '{ hello }' });
    await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    expect(fetchMock).toHaveBeenCalledWith('/api/graphql', expect.anything());
  });

  it('context.inputs.bffUrl takes priority over everything else', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pets: [] } }),
    });

    const mfe = new TestMFE(BASE_MANIFEST, { bffUrl: 'http://wrong-url/graphql' });
    const ctx = makeContext({
      document: '{ listPets { id } }',
      bffUrl: 'http://localhost:3001/graphql',
    });
    await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/graphql', expect.anything());
  });

  it('falls back to /graphql when nothing else is configured', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const mfe = new TestMFE(BASE_MANIFEST);
    const ctx = makeContext({ document: '{ hello }' });
    await (mfe as unknown as { doQuery: (c: Context) => Promise<unknown> }).doQuery(ctx);

    expect(fetchMock).toHaveBeenCalledWith('/graphql', expect.anything());
  });
});

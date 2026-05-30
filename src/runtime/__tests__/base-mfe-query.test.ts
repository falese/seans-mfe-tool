/**
 * Tests for BaseMFE.doQuery() default implementation.
 *
 * The default doQuery() dispatches context.inputs.document + variables
 * to the BFF endpoint via fetch, forwarding context.jwt as Authorization.
 * Concrete classes can override doQuery() for typed, operation-specific queries.
 */

import { BaseMFE } from '../base-mfe';
import type { Context, QueryInput } from '../context';
import type { LoadResult, RenderResult, HealthResult, DescribeResult, SchemaResult, EmitResult, ControlPlaneStateResult } from '../base-mfe';
import { ContextFactory } from '../context';

// Minimal concrete subclass — only doQuery uses the base implementation.
class QueryTestMFE extends BaseMFE {
  protected async doLoad(): Promise<LoadResult> {
    return { status: 'loaded', timestamp: new Date() };
  }
  protected async doRender(): Promise<RenderResult> {
    return { status: 'rendered', timestamp: new Date() };
  }
  protected async doRefresh(): Promise<void> {}
  protected async doAuthorizeAccess(): Promise<boolean> { return true; }
  protected async doHealth(): Promise<HealthResult> {
    return { status: 'healthy', checks: [], timestamp: new Date() };
  }
  protected async doDescribe(): Promise<DescribeResult> {
    return { name: 't', version: '1', type: 'bff', capabilities: [], manifest: this.manifest };
  }
  protected async doSchema(): Promise<SchemaResult> {
    return { schema: '{}', format: 'json' };
  }
  protected async doEmit(): Promise<EmitResult> {
    return { emitted: true };
  }
  protected async doUpdateControlPlaneState(ctx: Context): Promise<ControlPlaneStateResult> {
    return { acknowledged: true, correlationId: ctx.requestId };
  }
}

const BASE_MANIFEST = { name: 'test', version: '1.0.0', type: 'bff', language: 'typescript' } as const;

function makeContext(inputs: Record<string, unknown> = {}, extras: Partial<Context> = {}): Context {
  return ContextFactory.create({ inputs, ...extras });
}

// Ensure the MFE is in 'ready' state before calling query
async function readyMfe(mfe: QueryTestMFE): Promise<void> {
  const ctx = makeContext();
  // Transition: uninitialized → loading → ready
  (mfe as unknown as { state: string }).state = 'ready';
}

describe('BaseMFE.doQuery() default implementation', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env['BFF_URL'];
  });

  it('sends a POST to deps.bffUrl with the query document', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { hello: 'world' } }),
    });
    globalThis.fetch = mockFetch;

    const mfe = new QueryTestMFE(BASE_MANIFEST, { bffUrl: 'http://localhost:4000/graphql' });
    await readyMfe(mfe);

    const ctx = makeContext({ document: '{ hello }' } as QueryInput);
    const result = await mfe.query(ctx);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/graphql',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: '{ hello }', variables: undefined }),
      }),
    );
    expect(result.data).toEqual({ hello: 'world' });
  });

  it('forwards context.jwt as Authorization header', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    globalThis.fetch = mockFetch;

    const mfe = new QueryTestMFE(BASE_MANIFEST, { bffUrl: 'http://localhost:4000/graphql' });
    await readyMfe(mfe);

    const ctx = makeContext({ document: '{ me }' } as QueryInput, { jwt: 'tok123' });
    await mfe.query(ctx);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok123');
  });

  it('returns { data, errors } from the BFF response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { user: { id: '1' } },
        errors: [{ message: 'partial failure' }],
      }),
    });

    const mfe = new QueryTestMFE(BASE_MANIFEST, { bffUrl: 'http://localhost:4000/graphql' });
    await readyMfe(mfe);

    const ctx = makeContext({ document: '{ user { id } }' } as QueryInput);
    const result = await mfe.query(ctx);

    expect(result.data).toEqual({ user: { id: '1' } });
    expect(result.errors).toEqual([{ message: 'partial failure' }]);
  });

  it('returns { data: null, errors } when HTTP response is not ok', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const mfe = new QueryTestMFE(BASE_MANIFEST, { bffUrl: 'http://localhost:4000/graphql' });
    await readyMfe(mfe);

    const ctx = makeContext({ document: '{ hello }' } as QueryInput);
    const result = await mfe.query(ctx);

    expect(result.data).toBeNull();
    expect(result.errors?.[0].message).toMatch('503');
  });

  it('throws ValidationError when context.inputs.document is missing', async () => {
    const mfe = new QueryTestMFE(BASE_MANIFEST, { bffUrl: 'http://localhost:4000/graphql' });
    await readyMfe(mfe);

    const ctx = makeContext({}); // no document

    await expect(mfe.query(ctx)).rejects.toMatchObject({
      name: 'ValidationError',
      field: 'context.inputs.document',
    });
  });

  it('falls back to BFF_URL env var when deps.bffUrl is not set', async () => {
    process.env['BFF_URL'] = 'http://env-bff:4000/graphql';
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });
    globalThis.fetch = mockFetch;

    const mfe = new QueryTestMFE(BASE_MANIFEST); // no bffUrl in deps
    await readyMfe(mfe);

    const ctx = makeContext({ document: '{ hello }' } as QueryInput);
    await mfe.query(ctx);

    expect(mockFetch).toHaveBeenCalledWith('http://env-bff:4000/graphql', expect.anything());
  });

  it('falls back to manifest data.serve.endpoint when no env var', async () => {
    const manifestWithServe = {
      ...BASE_MANIFEST,
      data: { sources: [], serve: { endpoint: '/my-graphql', playground: true } },
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });
    globalThis.fetch = mockFetch;

    const mfe = new QueryTestMFE(manifestWithServe as never); // no bffUrl, no env var
    await readyMfe(mfe);

    const ctx = makeContext({ document: '{ hello }' } as QueryInput);
    await mfe.query(ctx);

    expect(mockFetch).toHaveBeenCalledWith('/my-graphql', expect.anything());
  });

  it('falls back to /graphql when nothing else is configured', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    });
    globalThis.fetch = mockFetch;

    const mfe = new QueryTestMFE(BASE_MANIFEST); // no bffUrl, no env var, no manifest serve
    await readyMfe(mfe);

    const ctx = makeContext({ document: '{ hello }' } as QueryInput);
    await mfe.query(ctx);

    expect(mockFetch).toHaveBeenCalledWith('/graphql', expect.anything());
  });

  it('forwards variables in the request body', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    globalThis.fetch = mockFetch;

    const mfe = new QueryTestMFE(BASE_MANIFEST, { bffUrl: 'http://localhost:4000/graphql' });
    await readyMfe(mfe);

    const input: QueryInput = { document: 'query Get($id: ID!) { user(id: $id) { id } }', variables: { id: '42' } };
    const ctx = makeContext(input as Record<string, unknown>);
    await mfe.query(ctx);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      query: input.document,
      variables: { id: '42' },
    });
  });
});

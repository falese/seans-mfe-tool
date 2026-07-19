import { query, mutate } from './bff';

const MOCK_ENDPOINT = 'http://localhost:5004/graphql';

describe('meridian-cargo-ops BFF connector', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a POST to the BFF endpoint with the query document', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { hello: 'world' } }),
    });

    const result = await query<{ hello: string }>('{ hello }');

    expect(global.fetch).toHaveBeenCalledWith(
      MOCK_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query: '{ hello }', variables: undefined }),
      }),
    );
    expect(result).toEqual({ hello: 'world' });
  });

  it('throws when the response contains GraphQL errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errors: [{ message: 'field not found' }, { message: 'auth required' }],
      }),
    });

    await expect(query('{ bad }')).rejects.toThrow('field not found\nauth required');
  });

  it('throws when the HTTP response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(query('{ hello }')).rejects.toThrow('BFF request failed: 503');
  });

  it('forwards custom headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await query('{ me }', undefined, { Authorization: 'Bearer tok' });

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('passes variables in the request body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { user: { id: '1' } } }),
    });

    await query('query GetUser($id: ID!) { user(id: $id) { id } }', { id: '1' });

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      query: 'query GetUser($id: ID!) { user(id: $id) { id } }',
      variables: { id: '1' },
    });
  });

  it('mutate delegates to query (sends as POST)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { createUser: { id: '42' } } }),
    });

    const result = await mutate<{ createUser: { id: string } }>(
      'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
      { name: 'Alice' },
    );

    expect(result.createUser.id).toBe('42');
  });
});

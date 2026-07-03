import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { loadRemoteTools } from '../remote';

/**
 * Regression: `{ ...parsedUrl }` used to strip host/port/path off a WHATWG URL
 * (its fields are prototype getters, not own enumerable properties), so every
 * HTTP MCP server was silently contacted at localhost:80 and never federated.
 * These tests stand up a real server on an ephemeral port and prove the request
 * reaches it at the configured path.
 */
describe('loadRemoteTools — HTTP MCP source', () => {
  let server: http.Server;
  let port: number;
  let tmpConfig: string;
  let receivedPath: string | undefined;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      receivedPath = req.url;
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { tools: [{ name: 'refactor', description: 'do a refactor' }] },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as { port: number }).port;
    tmpConfig = path.join(os.tmpdir(), `mcp-remote-test-${Date.now()}.json`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.remove(tmpConfig).catch(() => {});
  });

  it('reaches the configured host/port/path and federates its tools', async () => {
    await fs.writeJson(tmpConfig, {
      servers: [{ name: 'daemon', url: `http://127.0.0.1:${port}/mcp` }],
    });

    const tools = await loadRemoteTools(tmpConfig);

    expect(receivedPath).toBe('/mcp');
    expect(tools).toEqual([
      expect.objectContaining({ name: 'daemon:refactor', description: 'do a refactor' }),
    ]);
  });
});

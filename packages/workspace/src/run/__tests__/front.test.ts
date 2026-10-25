import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import { startFront, type RunningFront } from '../front';

/** A stand-in upstream that echoes what reached it. */
function echo(name: string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ upstream: name, method: req.method, url: req.url, body }));
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() })
    )
  );
}

describe('the workspace front server: one origin for the page, its BFF and screenshots', () => {
  let front: RunningFront;
  let bff: { url: string; close: () => void };
  let api: { url: string; close: () => void };
  let dist: string;

  beforeEach(async () => {
    jest.useRealTimers();
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'front-'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<div id="root"></div>');
    fs.writeFileSync(path.join(dist, 'main.js'), 'console.log(1)');
    bff = await echo('bff');
    api = await echo('api');
    front = await startFront({ dist, bff: bff.url, api: api.url, port: 0 });
  });
  afterEach(async () => {
    await front.close();
    bff.close();
    api.close();
  });

  it('serves the standalone page, and falls back to it for any other path', async () => {
    expect(await (await fetch(`${front.url}/`)).text()).toBe('<div id="root"></div>');
    const js = await fetch(`${front.url}/main.js`);
    expect(js.headers.get('content-type')).toContain('javascript');
    expect(await (await fetch(`${front.url}/some/route`)).text()).toBe('<div id="root"></div>');
  });

  it('passes /graphql to the BFF, body and all', async () => {
    const res = await fetch(`${front.url}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"query":"{x}"}' });
    expect(await res.json()).toEqual({ upstream: 'bff', method: 'POST', url: '/graphql', body: '{"query":"{x}"}' });
  });

  it('passes screenshots to the workspace API, and nothing else of it', async () => {
    expect(await (await fetch(`${front.url}/api/screenshot?path=screens%2Fa.png`)).json()).toMatchObject({ upstream: 'api', url: '/api/screenshot?path=screens%2Fa.png' });
    expect((await fetch(`${front.url}/api/edits`, { method: 'POST', body: '{}' })).status).toBe(404);
  });

  it('never serves a file outside the page’s directory', async () => {
    const res = await fetch(`${front.url}/..%2F..%2Fetc%2Fpasswd`);
    expect(await res.text()).toBe('<div id="root"></div>');
  });

  it('listens on this machine only', () => {
    expect(new URL(front.url).hostname).toBe('127.0.0.1');
  });
});

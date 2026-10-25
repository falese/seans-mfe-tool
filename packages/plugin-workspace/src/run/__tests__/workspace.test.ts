import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BFF_PORT, MFE_DIR, agentFor, portIsFree, preflight, startWorkspace } from '../workspace';

describe('preflight — is the workspace MFE built?', () => {
  beforeEach(() => jest.useRealTimers());

  it('names every missing build artifact and the one command that makes them', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-'));
    expect(preflight(empty)).toEqual({
      ready: false,
      missing: ['dist/index.html', 'server.js', '.mesh/index.js'],
      fix: 'seans-mfe-tool decompose:workspace <proposal> --build   (or, in the repository: npm run build:workspace)',
    });
  });

  it('is ready when the page, the BFF server and its mesh are all built', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-'));
    for (const f of ['dist/index.html', 'server.js', '.mesh/index.js']) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), '');
    }
    expect(preflight(dir)).toEqual({ ready: true, missing: [] });
  });

  it('finds the MFE inside the plugin package', () => {
    expect(fs.existsSync(path.join(MFE_DIR, 'mfe-manifest.yaml'))).toBe(true);
  });
});

describe('portIsFree', () => {
  beforeEach(() => jest.useRealTimers());

  it('refuses a port something already listens on, so the workspace never talks to a stranger', async () => {
    const http = await import('http');
    const taken = http.createServer();
    await new Promise<void>((r) => taken.listen(0, '127.0.0.1', () => r()));
    const port = (taken.address() as { port: number }).port;
    expect(await portIsFree(port)).toBe(false);
    await new Promise<void>((r) => taken.close(() => r()));
    expect(await portIsFree(port)).toBe(true);
  });
});

describe('stopping the workspace', () => {
  beforeEach(() => jest.useRealTimers());

  it('takes its BFF down with it, even one that ignores SIGTERM', async () => {
    const mfe = fs.mkdtempSync(path.join(os.tmpdir(), 'mfe-'));
    fs.mkdirSync(path.join(mfe, 'dist'));
    fs.mkdirSync(path.join(mfe, '.mesh'));
    fs.writeFileSync(path.join(mfe, 'dist', 'index.html'), '<div id="root"></div>');
    fs.writeFileSync(path.join(mfe, '.mesh', 'index.js'), '');
    // A BFF that answers /health and refuses to die politely.
    fs.writeFileSync(
      path.join(mfe, 'server.js'),
      "process.on('SIGTERM', () => {}); require('http').createServer((q, s) => s.end('ok')).listen(Number(process.env.PORT), process.env.HOST);"
    );
    const proposal = fs.mkdtempSync(path.join(os.tmpdir(), 'proposal-'));
    fs.writeFileSync(path.join(proposal, 'decomposition.yaml'), 'version: 1\n');

    const ws = await startWorkspace({ proposalDir: proposal, cli: [process.execPath, '-e', ''], port: 0, who: 't', commit: false, log: () => undefined, mfeDir: mfe });
    await ws.close();
    expect(await portIsFree(BFF_PORT)).toBe(true);
  }, 20000);
});

describe('agentFor — is the agent connected? (ADR-117)', () => {
  it('connects when there is a key in the environment, with the model asked for', () => {
    expect(agentFor({ enabled: true, env: { ANTHROPIC_API_KEY: 'k' } })).toEqual({ agent: {} });
    expect(agentFor({ enabled: true, model: 'm', env: { ANTHROPIC_API_KEY: 'k' } })).toEqual({ agent: { model: 'm' } });
  });

  it('says which variable to set when there is no key, and that it was turned off when it was', () => {
    expect(agentFor({ enabled: true, env: {} })).toEqual({ unavailable: expect.stringContaining('ANTHROPIC_API_KEY') });
    expect(agentFor({ enabled: false, env: { ANTHROPIC_API_KEY: 'k' } })).toEqual({ unavailable: expect.stringContaining('--no-agent') });
  });
});

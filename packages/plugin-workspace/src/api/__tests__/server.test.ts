import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import * as yaml from 'js-yaml';
import type { CommandResult } from '@seans-mfe/contracts';
import { startWorkspaceApi, type CliRunner, type RunningApi } from '../server';

const SPEC = path.resolve(__dirname, '../../../decomposition-workspace/specs/workspace-api.yaml');

const ok = <T>(data: T): CommandResult<T> => ({ ok: true, data, warnings: [], telemetry: { durationMs: 1, correlationId: 'c' } });
const failed = (message: string): CommandResult<never> => ({
  ok: false,
  error: { type: 'ValidationError', code: 2, message, retryable: false, userFacing: true },
  warnings: [],
  telemetry: { durationMs: 1, correlationId: 'c' },
});

/** A stand-in CLI: records each call (and the edits file it was handed), answers from a script. */
function fakeCli(answer: (args: string[]) => CommandResult<unknown>): CliRunner & { calls: string[][]; edits: unknown[] } {
  const calls: string[][] = [];
  const edits: unknown[] = [];
  return {
    calls,
    edits,
    async run(args) {
      calls.push(args);
      const ops = args[args.indexOf('--ops') + 1];
      if (args[0] === 'decompose:edit' && ops?.startsWith('@')) edits.push(JSON.parse(fs.readFileSync(ops.slice(1), 'utf8')));
      return answer(args);
    },
  };
}

function project(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-api-'));
  fs.mkdirSync(path.join(root, 'proposal'));
  fs.writeFileSync(path.join(root, 'proposal', 'decomposition.yaml'), 'version: 1\n');
  fs.writeFileSync(path.join(root, 'bundle.json'), '{}');
  fs.mkdirSync(path.join(root, 'screens'));
  fs.writeFileSync(path.join(root, 'screens', 'j.0.png'), Buffer.from([137, 80, 78, 71]));
  fs.writeFileSync(path.join(root, 'secret.txt'), 'not for the browser');
  return root;
}

const STATUS = { proposal: 'p', app: { name: 'app', namespace: 'app' }, approval: { status: 'none' }, document: {}, validation: {}, valid: true, suggestions: [], screens: null, bundle: null };

describe('the workspace API (ADR-116)', () => {
  let api: RunningApi;
  let root: string;
  // A real server and real requests: the repository's fake timers would stall both.
  beforeEach(() => jest.useRealTimers());
  afterEach(async () => api?.close());

  async function start(cli: CliRunner) {
    root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), cli, who: 'sean', now: () => new Date('2026-10-25T12:00:00Z'), port: 0 });
    return api;
  }

  it('is described by a valid OpenAPI document, which it serves', async () => {
    await expect(SwaggerParser.validate(SPEC)).resolves.toBeDefined();
    await start(fakeCli(() => ok(STATUS)));
    const res = await fetch(`${api.url}/api/openapi.yaml`);
    expect(res.status).toBe(200);
    expect((yaml.load(await res.text()) as { info: { title: string } }).info.title).toBe('Decomposition workspace API');
  });

  it('answers a read from decompose:status, and only listens on this machine', async () => {
    const cli = fakeCli(() => ok(STATUS));
    await start(cli);
    expect(new URL(api.url).hostname).toBe('127.0.0.1');
    const res = await fetch(`${api.url}/api/proposal`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(STATUS);
    expect(cli.calls).toEqual([['decompose:status', path.join(root, 'proposal'), '--json']]);
  });

  it('applies edits through decompose:edit, filling who and when, then returns the new status', async () => {
    const cli = fakeCli(() => ok(STATUS));
    await start(cli);
    const res = await fetch(`${api.url}/api/edits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ edits: [{ kind: 'rename-domain', from: 'shell', to: 'console' }, { kind: 'comment', text: 'Looks right' }, { kind: 'approve' }] }),
    });
    expect(res.status).toBe(200);
    expect(cli.calls.map((c) => c[0])).toEqual(['decompose:edit', 'decompose:status']);
    expect(cli.calls[0].slice(0, 2)).toEqual(['decompose:edit', path.join(root, 'proposal', 'decomposition.yaml')]);
    expect(cli.edits[0]).toEqual([
      { kind: 'rename-domain', from: 'shell', to: 'console' },
      { kind: 'comment', text: 'Looks right', by: 'sean', at: '2026-10-25T12:00:00.000Z' },
      { kind: 'approve', by: 'sean', at: '2026-10-25T12:00:00.000Z' },
    ]);
  });

  it('reports an edit that cannot apply as 422 with the reason, and changes nothing', async () => {
    const cli = fakeCli((args) => (args[0] === 'decompose:edit' ? failed('no domain "crew" in the proposal') : ok(STATUS)));
    await start(cli);
    const res = await fetch(`${api.url}/api/edits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ edits: [{ kind: 'rename-domain', from: 'crew', to: 'people' }] }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message: 'no domain "crew" in the proposal', type: 'ValidationError' });
    // A malformed request never reaches the CLI.
    const bad = await fetch(`${api.url}/api/edits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"edits":[]}' });
    expect(bad.status).toBe(422);
    expect(cli.calls.length).toBe(1);
  });

  it('serves a captured screenshot, and nothing else from the bundle', async () => {
    await start(fakeCli(() => ok(STATUS)));
    const png = await fetch(`${api.url}/api/screenshot?path=screens/j.0.png`);
    expect(png.status).toBe(200);
    expect(png.headers.get('content-type')).toBe('image/png');
    for (const p of ['secret.txt', 'screens/../secret.txt', '../proposal/decomposition.yaml', 'screens/missing.png']) {
      expect((await fetch(`${api.url}/api/screenshot?path=${encodeURIComponent(p)}`)).status).toBe(404);
    }
  });

  it('applies concurrent edit requests one at a time, in arrival order', async () => {
    let inFlight = 0;
    let most = 0;
    const cli: CliRunner = {
      async run(args) {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((r) => setTimeout(r, 20));
        inFlight -= 1;
        return ok(args[0] === 'decompose:status' ? STATUS : {});
      },
    };
    await start(cli);
    const post = (to: string) => fetch(`${api.url}/api/edits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ edits: [{ kind: 'rename-slot', from: 'a', to }] }) });
    const results = await Promise.all([post('b'), post('c'), post('d')]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(most).toBe(1);
  });

  it('every operation the document declares is one the server answers', () => {
    const spec = yaml.load(fs.readFileSync(SPEC, 'utf8')) as { paths: Record<string, Record<string, { operationId: string }>> };
    expect(Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`)).sort()).toEqual([
      'GET /agent',
      'GET /proposal',
      'GET /screenshot',
      'POST /ask',
      'POST /edits',
    ]);
  });
});

describe('after an approval (ADR-116 §5)', () => {
  let api: RunningApi | undefined;
  beforeEach(() => jest.useRealTimers());
  afterEach(async () => api?.close());

  it('tells the caller once the approve edit has applied, and only then', async () => {
    const approved: string[] = [];
    let refuse = false;
    const cli: CliRunner = { run: async (args) => (args[0] === 'decompose:edit' && refuse ? failed('nope') : ok(STATUS)) };
    const root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), cli, who: 'sean', port: 0, onApproved: async (by) => void approved.push(by) });
    const post = (edits: unknown[]) => fetch(`${api?.url}/api/edits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ edits }) });
    await post([{ kind: 'comment', text: 'x' }]);
    expect(approved).toEqual([]);
    await post([{ kind: 'approve' }]);
    expect(approved).toEqual(['sean']);
    refuse = true;
    await post([{ kind: 'approve', by: 'pat' }]);
    expect(approved).toEqual(['sean']);
  });
});

describe('the agent (ADR-117)', () => {
  let api: RunningApi | undefined;
  beforeEach(() => jest.useRealTimers());
  afterEach(async () => api?.close());

  const ANSWER = { answer: 'Hazards can stand alone.', suggested: [{ explanation: 'separate team', edit: { kind: 'split-domain', domain: 'cargo', into: 'hazmat', files: ['a.tsx'] } }], dropped: [], model: 'model-x' };
  const ask = (url: string, body: unknown) => fetch(`${url}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('says whether an agent is connected, and which model', async () => {
    const root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), cli: fakeCli(() => ok(STATUS)), who: 'sean', port: 0, agent: { model: 'model-x' } });
    expect(await (await fetch(`${api.url}/api/agent`)).json()).toEqual({ connected: true, model: 'model-x' });
    await api.close();

    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), cli: fakeCli(() => ok(STATUS)), who: 'sean', port: 0, agentUnavailable: 'set ANTHROPIC_API_KEY' });
    expect(await (await fetch(`${api.url}/api/agent`)).json()).toEqual({ connected: false, reason: 'set ANTHROPIC_API_KEY' });
  });

  it('asks through coder:suggest, signed by the person running the workspace, and returns its answer', async () => {
    const cli = fakeCli((args) => (args[0] === 'coder:suggest' ? ok(ANSWER) : ok(STATUS)));
    const root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), cli, who: 'sean', port: 0, agent: { model: 'model-x' } });
    const res = await ask(api.url, { request: 'Split hazards out of cargo' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ANSWER);
    expect(cli.calls).toEqual([
      ['coder:suggest', path.join(root, 'proposal'), 'Split hazards out of cargo', '--by', 'sean', '--model', 'model-x', '--json'],
    ]);
  });

  it('refuses a question when no agent is connected, without running anything', async () => {
    const cli = fakeCli(() => ok(STATUS));
    const root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), cli, who: 'sean', port: 0 });
    const res = await ask(api.url, { request: 'anything' });
    expect(res.status).toBe(503);
    expect(cli.calls).toEqual([]);
  });

  it('refuses an empty question, and reports the agent’s failure as 422 with the reason', async () => {
    const cli = fakeCli((args) => (args[0] === 'coder:suggest' ? failed('the model declined to answer this request') : ok(STATUS)));
    const root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), cli, who: 'sean', port: 0, agent: { model: 'm' } });
    expect((await ask(api.url, { request: '  ' })).status).toBe(422);
    const res = await ask(api.url, { request: 'q' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message: 'the model declined to answer this request', type: 'ValidationError' });
  });
});

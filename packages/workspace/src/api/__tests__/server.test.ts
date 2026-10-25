import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import SwaggerParser from '@apidevtools/swagger-parser';
import * as yaml from 'js-yaml';
import { BusinessError } from '@seans-mfe/contracts';
import { dumpYaml, readDecomposition, type AskResult, type Decomposition, type Domain } from '@seans-mfe/decompose';
import { startWorkspaceApi, type RunningApi, type WorkspaceApiOptions } from '../server';

const SPEC = path.resolve(__dirname, '../../../decomposition-workspace/specs/workspace-api.yaml');

const evidence = { route: 1, data: 1, imports: 1, runtime: null, cochange: null, ownership: null };
const domain = (id: string, files: string[], caps: string[], extra: Partial<Domain> = {}): Domain => ({
  id, mfe: `app-${id}`, shell: false, files,
  capabilities: caps.map((name, i) => ({ name, file: files[i] ?? files[0], component: name })),
  backends: [], endpoints: [], evidence, reasons: [], ...extra,
});

const doc = (): Decomposition => ({
  version: 1,
  app: { name: 'app', namespace: 'app', gateway: true },
  domains: [
    domain('shell', ['src/App.tsx'], ['App'], { shell: true }),
    domain('docking', ['src/Board.tsx'], ['Board']),
    domain('cargo', ['src/Manifest.tsx', 'src/Hazards.tsx'], ['Manifest', 'Hazards']),
  ],
  shared: [],
  unassigned: [],
  couplings: [],
  slots: [{ id: 'main', provider: 'shell', repeated: false }],
  routes: [
    { path: '/docking', stateKey: 'app.open.docking', place: [{ capability: 'Board', domain: 'docking', slot: 'main' }] },
    { path: '/cargo', stateKey: 'app.open.cargo', place: [{ capability: 'Manifest', domain: 'cargo', slot: 'main' }] },
  ],
  repeated: [],
  tests: [],
  uncovered: [],
});

/** A proposal beside a minimal evidence bundle, and a file the browser must never get. */
function project(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-api-'));
  fs.mkdirSync(path.join(root, 'proposal'));
  fs.writeFileSync(path.join(root, 'proposal', 'decomposition.yaml'), dumpYaml(doc()));
  fs.mkdirSync(path.join(root, 'screens'));
  fs.writeFileSync(path.join(root, 'screens', 'j.0.png'), Buffer.from([137, 80, 78, 71]));
  fs.writeFileSync(path.join(root, 'secret.txt'), 'not for the browser');
  return root;
}

const AT = '2026-10-25T12:00:00.000Z';
const post = (url: string, route: string, body: unknown) =>
  fetch(`${url}/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('the workspace API (ADR-116, ADR-118)', () => {
  let api: RunningApi | undefined;
  let root: string;
  // A real server and real requests: the repository's fake timers would stall both.
  beforeEach(() => jest.useRealTimers());
  afterEach(async () => api?.close());

  async function start(extra: Partial<WorkspaceApiOptions> = {}) {
    root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), who: 'sean', now: () => new Date(AT), port: 0, ...extra });
    return api;
  }
  const proposal = () => readDecomposition(path.join(root, 'proposal', 'decomposition.yaml'));

  it('is described by a valid OpenAPI document, which it serves', async () => {
    await expect(SwaggerParser.validate(SPEC)).resolves.toBeDefined();
    const { url } = await start();
    const res = await fetch(`${url}/api/openapi.yaml`);
    expect(res.status).toBe(200);
    expect((yaml.load(await res.text()) as { info: { title: string } }).info.title).toBe('Decomposition workspace API');
  });

  it('answers a read with the proposal’s status, and only listens on this machine', async () => {
    const { url } = await start();
    expect(new URL(url).hostname).toBe('127.0.0.1');
    const res = await fetch(`${url}/api/proposal`);
    expect(res.status).toBe(200);
    const status = (await res.json()) as { proposal: string; valid: boolean; document: Decomposition; screens: unknown };
    expect(status.proposal).toBe(path.join(root, 'proposal', 'decomposition.yaml'));
    expect(status.valid).toBe(true);
    expect(status.document.domains.map((d) => d.id)).toEqual(['shell', 'docking', 'cargo']);
    expect(status).not.toHaveProperty('warnings');
  });

  it('applies edits through the proposal model, filling who and when, then returns the new status', async () => {
    const { url } = await start();
    const res = await post(url, 'edits', { edits: [{ kind: 'rename-domain', from: 'shell', to: 'console' }, { kind: 'comment', text: 'Looks right' }, { kind: 'approve' }] });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { approval: { status: string } }).approval.status).toBe('current');
    const written = await proposal();
    expect(written.domains[0].id).toBe('console');
    expect(written.comments).toEqual([{ id: expect.any(String), by: 'sean', at: AT, text: 'Looks right' }]);
    expect(written.approval).toEqual({ by: 'sean', at: AT, hash: expect.any(String) });
  });

  it('reports an edit that cannot apply as 422 with the reason, and changes nothing', async () => {
    const { url } = await start();
    const before = fs.readFileSync(path.join(root, 'proposal', 'decomposition.yaml'), 'utf8');
    const res = await post(url, 'edits', { edits: [{ kind: 'comment', text: 'first' }, { kind: 'rename-domain', from: 'crew', to: 'people' }] });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message: expect.stringContaining('crew'), type: 'ValidationError' });
    expect((await post(url, 'edits', '{"edits":[]}')).status).toBe(422);
    expect((await post(url, 'edits', { edits: [{ kind: 'explode' }] })).status).toBe(422);
    expect(fs.readFileSync(path.join(root, 'proposal', 'decomposition.yaml'), 'utf8')).toBe(before);
  });

  it('serves a captured screenshot, and nothing else from the bundle', async () => {
    const { url } = await start();
    const png = await fetch(`${url}/api/screenshot?path=screens/j.0.png`);
    expect(png.status).toBe(200);
    expect(png.headers.get('content-type')).toBe('image/png');
    for (const p of ['secret.txt', 'screens/../secret.txt', '../proposal/decomposition.yaml', 'screens/missing.png']) {
      expect((await fetch(`${url}/api/screenshot?path=${encodeURIComponent(p)}`)).status).toBe(404);
    }
  });

  it('applies concurrent edit requests one at a time, in arrival order', async () => {
    const { url } = await start();
    const results = await Promise.all(['a', 'b', 'c'].map((text) => post(url, 'edits', { edits: [{ kind: 'comment', text }] })));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect((await proposal()).comments?.map((c) => c.text)).toEqual(['a', 'b', 'c']);
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

  it('tells the caller once the approve edit has applied, and only then (ADR-116 §5)', async () => {
    const approved: string[] = [];
    const { url } = await start({ onApproved: async (by) => void approved.push(by) });
    await post(url, 'edits', { edits: [{ kind: 'comment', text: 'x' }] });
    expect(approved).toEqual([]);
    await post(url, 'edits', { edits: [{ kind: 'approve' }] });
    expect(approved).toEqual(['sean']);
    await post(url, 'edits', { edits: [{ kind: 'approve', by: 'pat' }, { kind: 'rename-domain', from: 'crew', to: 'x' }] });
    expect(approved).toEqual(['sean']);
  });
});

describe('the agent (ADR-117, ADR-118 §4)', () => {
  let api: RunningApi | undefined;
  beforeEach(() => jest.useRealTimers());
  afterEach(async () => api?.close());

  const ANSWER: AskResult = { answer: 'Hazards can stand alone.', suggested: [], dropped: [], model: 'model-x' };

  it('says whether an agent is connected, which model, and if not, why', async () => {
    const root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), who: 'sean', port: 0, agent: { model: 'model-x', ask: async () => ANSWER } });
    expect(await (await fetch(`${api.url}/api/agent`)).json()).toEqual({ connected: true, model: 'model-x' });
    await api.close();

    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), who: 'sean', port: 0, agentUnavailable: 'set the key' });
    expect(await (await fetch(`${api.url}/api/agent`)).json()).toEqual({ connected: false, reason: 'set the key' });
  });

  it('hands a question to the agent it was given, signed by the person running the workspace', async () => {
    const asked: unknown[] = [];
    const root = project();
    api = await startWorkspaceApi({
      proposalDir: path.join(root, 'proposal'),
      who: 'sean',
      now: () => new Date(AT),
      port: 0,
      agent: { ask: async (...args) => (asked.push(args), ANSWER) },
    });
    const res = await post(api.url, 'ask', { request: '  Split hazards out of cargo ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ANSWER);
    expect(asked).toEqual([['Split hazards out of cargo', 'sean', AT]]);
  });

  it('refuses a question when no agent is connected, and an empty one when one is', async () => {
    const root = project();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), who: 'sean', port: 0 });
    expect((await post(api.url, 'ask', { request: 'anything' })).status).toBe(503);
    await api.close();
    const ask = jest.fn();
    api = await startWorkspaceApi({ proposalDir: path.join(root, 'proposal'), who: 'sean', port: 0, agent: { ask } });
    expect((await post(api.url, 'ask', { request: '  ' })).status).toBe(422);
    expect(ask).not.toHaveBeenCalled();
  });

  it('reports the agent’s failure as 422 with its reason and type', async () => {
    const root = project();
    api = await startWorkspaceApi({
      proposalDir: path.join(root, 'proposal'),
      who: 'sean',
      port: 0,
      agent: { ask: async () => Promise.reject(new BusinessError('the model declined to answer this request', 'AGENT_DECLINED')) },
    });
    const res = await post(api.url, 'ask', { request: 'q' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ message: 'the model declined to answer this request', type: 'BusinessError' });
  });
});

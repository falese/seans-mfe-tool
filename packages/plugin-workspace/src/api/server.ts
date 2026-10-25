/**
 * The workspace API, local implementation (ADR-116 §2–§3).
 *
 * It keeps nothing. A read is `decompose:status`; a write is `decompose:edit
 * --ops`, run as a child process with `--json` the way MCP tool calls are
 * (CLAUDE.md, "MCP child-process per tool call"), so the API cannot reach the
 * document by any path the CLI does not validate. `openapi/workspace-api.yaml`
 * is the contract; a hosted relay implements the same one (§6).
 */

import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import type { CommandResult } from '@seans-mfe/contracts';

/** Runs one CLI command with `--json` and returns its envelope. */
export interface CliRunner {
  run(args: string[]): Promise<CommandResult<unknown>>;
}

export interface WorkspaceApiOptions {
  /** The proposal directory, holding decomposition.yaml. */
  proposalDir: string;
  /** The evidence bundle screenshots are served from (default: the proposal directory's parent). */
  evidenceDir?: string;
  cli: CliRunner;
  /** Recorded as `by` on comments, suggestions and approvals that do not name anyone. */
  who: string;
  now?: () => Date;
  /** 0 picks a free port. */
  port: number;
}

export interface RunningApi {
  url: string;
  close(): Promise<void>;
}

export const SPEC_PATH = path.resolve(__dirname, '../../openapi/workspace-api.yaml');

/** Edit kinds that record who made them and when. */
const ATTRIBUTED = new Set(['comment', 'suggest', 'approve']);
const SCREENSHOT = /^screens\/[A-Za-z0-9._-]+\.png$/;

type Json = Record<string, unknown>;

function send(res: http.ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  const payload = Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': type });
  res.end(payload);
}

const problem = (res: http.ServerResponse, status: number, message: string, type?: string) =>
  send(res, status, type ? { message, type } : { message });

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** Fill `by` and `at` where an attributed edit leaves them out, including a comment inside a suggestion. */
function attribute(edit: Json, who: string, at: string): Json {
  const out: Json = { ...edit };
  if (ATTRIBUTED.has(String(out.kind))) {
    if (out.by === undefined) out.by = who;
    if (out.at === undefined) out.at = at;
  }
  if (out.edit && typeof out.edit === 'object') out.edit = attribute(out.edit as Json, who, at);
  return out;
}

export function createWorkspaceHandler(opts: Omit<WorkspaceApiOptions, 'port'>): http.RequestListener {
  const proposalDir = path.resolve(opts.proposalDir);
  const proposalFile = path.join(proposalDir, 'decomposition.yaml');
  const evidenceDir = path.resolve(opts.evidenceDir ?? path.join(proposalDir, '..'));
  const now = opts.now ?? (() => new Date());
  // Edits apply one at a time, in arrival order: each reads the file the last one wrote.
  let queue: Promise<unknown> = Promise.resolve();
  const serially = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  };

  async function status(res: http.ServerResponse): Promise<void> {
    const result = await opts.cli.run(['decompose:status', proposalDir, '--json']);
    if (result.ok) send(res, 200, result.data);
    else problem(res, 500, result.error?.message ?? 'decompose:status failed', result.error?.type);
  }

  async function edits(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      return problem(res, 422, 'the request body is not JSON');
    }
    const list = (body as { edits?: unknown }).edits;
    if (!Array.isArray(list) || list.length === 0 || !list.every((e) => e && typeof e === 'object' && typeof (e as Json).kind === 'string')) {
      return problem(res, 422, 'expected { "edits": [ { "kind": … }, … ] } with at least one edit');
    }
    const at = now().toISOString();
    const ops = list.map((e) => attribute(e as Json, opts.who, at));
    await serially(async () => {
      const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'smt-workspace-')), 'edits.json');
      fs.writeFileSync(tmp, JSON.stringify(ops));
      try {
        const result = await opts.cli.run(['decompose:edit', proposalFile, '--ops', `@${tmp}`, '--json']);
        if (!result.ok) return problem(res, 422, result.error?.message ?? 'the edits could not be applied', result.error?.type);
        await status(res);
      } finally {
        fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
      }
    });
  }

  function screenshot(url: URL, res: http.ServerResponse): void {
    const rel = url.searchParams.get('path') ?? '';
    // Only a screens/<name>.png path, resolved inside the bundle: never anything else on disk.
    const file = path.resolve(evidenceDir, rel);
    if (!SCREENSHOT.test(rel) || !file.startsWith(path.join(evidenceDir, 'screens') + path.sep) || !fs.existsSync(file)) {
      return problem(res, 404, `no screenshot ${rel}`);
    }
    send(res, 200, fs.readFileSync(file), 'image/png');
  }

  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = `${req.method} ${url.pathname}`;
    const handle = async () => {
      switch (route) {
        case 'GET /api/openapi.yaml':
          return send(res, 200, fs.readFileSync(SPEC_PATH, 'utf8'), 'application/yaml');
        case 'GET /api/proposal':
          if (!fs.existsSync(proposalFile)) return problem(res, 404, `no decomposition.yaml in ${proposalDir}`);
          return serially(() => status(res));
        case 'POST /api/edits':
          return edits(req, res);
        case 'GET /api/screenshot':
          return screenshot(url, res);
        default:
          return problem(res, 404, `no route ${route}`);
      }
    };
    handle().catch((err: unknown) => {
      if (!res.headersSent) problem(res, 500, err instanceof Error ? err.message : String(err));
    });
  };
}

/** Start the API on this machine only: it edits a file in the developer's repository. */
export function startWorkspaceApi(opts: WorkspaceApiOptions): Promise<RunningApi> {
  const server = http.createServer(createWorkspaceHandler(opts));
  return new Promise((resolve) => {
    server.listen(opts.port, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            // A browser or fetch keeps connections alive; closing must not wait for them.
            server.closeAllConnections();
          }),
      });
    });
  });
}

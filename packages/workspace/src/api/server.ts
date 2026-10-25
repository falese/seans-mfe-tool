/**
 * The workspace API, local implementation (ADR-116 §2–§3).
 *
 * It keeps nothing. A read is the proposal's status; a write is named edits,
 * applied all or none; both go through `@seans-mfe/decompose`, the same code
 * `decompose:status` and `decompose:edit` wrap, so the API cannot change the
 * document by any path the CLI does not validate (ADR-118 §2). A question goes
 * to the agent it was handed, if any (ADR-117); the API never names a model
 * provider. `decomposition-workspace/specs/workspace-api.yaml` is the contract;
 * a hosted relay implements the same one (§6).
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import type { AddressInfo } from 'net';
import { ValidationError } from '@seans-mfe/contracts';
import { EditOpSchema, editProposalFile, loadProposalStatus, type AskResult } from '@seans-mfe/decompose';

/** The agent questions go to (ADR-117); the command that starts the workspace supplies it. */
export interface WorkspaceAgent {
  /** The model asked, when the command knows it. */
  model?: string;
  ask(request: string, who: string, at: string): Promise<AskResult>;
}

export interface WorkspaceApiOptions {
  /** The proposal directory, holding decomposition.yaml. */
  proposalDir: string;
  /** The evidence bundle screenshots are served from (default: the proposal directory's parent). */
  evidenceDir?: string;
  /** Recorded as `by` on comments, suggestions and approvals that do not name anyone, and on questions. */
  who: string;
  now?: () => Date;
  /** 0 picks a free port. */
  port: number;
  /** Called with who approved, once an approve edit has applied (ADR-116 §5: the approval lands on the PR). */
  onApproved?: (by: string) => Promise<void>;
  /** Absent when no agent is connected. */
  agent?: WorkspaceAgent;
  /** Why no agent is connected, in words the page can show. */
  agentUnavailable?: string;
}

export interface RunningApi {
  url: string;
  close(): Promise<void>;
}

export const SPEC_PATH = path.resolve(__dirname, '../../decomposition-workspace/specs/workspace-api.yaml');

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

/** A typed platform error as a Problem: its message, and its class as the type. */
const failure = (res: http.ServerResponse, status: number, err: unknown) =>
  err instanceof Error ? problem(res, status, err.message, err.name) : problem(res, status, String(err));

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
    const { warnings: _w, ...loaded } = await loadProposalStatus(proposalDir, { evidence: evidenceDir });
    send(res, 200, loaded);
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
    const parsed = EditOpSchema.array().safeParse(list.map((e) => attribute(e as Json, opts.who, at)));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return failure(res, 422, new ValidationError(`edit ${first.path.join('.')}: ${first.message}`, 'edits', 'schema'));
    }
    await serially(async () => {
      try {
        await editProposalFile(proposalFile, parsed.data, { dryRun: false });
      } catch (err) {
        return failure(res, 422, err);
      }
      const approval = parsed.data.filter((e) => e.kind === 'approve').pop();
      if (approval && approval.kind === 'approve' && opts.onApproved) await opts.onApproved(approval.by);
      await status(res);
    });
  }

  function agent(res: http.ServerResponse): void {
    send(res, 200, opts.agent ? { connected: true, ...(opts.agent.model ? { model: opts.agent.model } : {}) } : { connected: false, reason: opts.agentUnavailable ?? 'no agent is connected' });
  }

  /** One question at a time, queued with the edits: the agent writes to the same document (ADR-117 §4). */
  async function ask(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const connected = opts.agent;
    if (!connected) return problem(res, 503, opts.agentUnavailable ?? 'no agent is connected');
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      return problem(res, 422, 'the request body is not JSON');
    }
    const request = (body as { request?: unknown }).request;
    if (typeof request !== 'string' || !request.trim()) return problem(res, 422, 'expected { "request": "…" } with a question or a change to make');
    await serially(async () => {
      try {
        send(res, 200, await connected.ask(request.trim(), opts.who, now().toISOString()));
      } catch (err) {
        failure(res, 422, err);
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
        case 'GET /api/agent':
          return agent(res);
        case 'POST /api/ask':
          return ask(req, res);
        default:
          return problem(res, 404, `no route ${route}`);
      }
    };
    handle().catch((err: unknown) => {
      if (!res.headersSent) failure(res, 500, err);
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

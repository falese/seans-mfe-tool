/**
 * Running the decomposition workspace (ADR-116 §2, §7): the workspace API, the
 * workspace MFE's own BFF, and one front door — all on this machine only.
 *
 *   browser ──► front :4611 ──► /graphql ──► MFE BFF :5611 (HOST=127.0.0.1) ──► API :4610 ──► @seans-mfe/decompose
 *                     └──────► /api/screenshot ─────────────────────────────────► API :4610
 *
 * The API port is fixed: the MFE's BFF reaches it at the address in its spec
 * (`servers:` in specs/workspace-api.yaml), as any MFE reaches its backend.
 */

import { execFile, spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { SystemError, ValidationError } from '@seans-mfe/contracts';
import { startWorkspaceApi, type RunningApi, type WorkspaceAgent } from '../api/server';
import { startFront, type RunningFront } from './front';
import { commitApproval, type CommitResult } from './git';

/** The generated MFE ships inside this package. */
export const MFE_DIR = path.resolve(__dirname, '../../decomposition-workspace');
export const API_PORT = 4610;
export const BFF_PORT = 5611;

const ARTIFACTS = ['dist/index.html', 'server.js', '.mesh/index.js'];

export type Preflight = { ready: true; missing: [] } | { ready: false; missing: string[]; fix: string };

export function preflight(mfeDir: string = MFE_DIR): Preflight {
  const missing = ARTIFACTS.filter((f) => !fs.existsSync(path.join(mfeDir, f)));
  if (missing.length === 0) return { ready: true, missing: [] };
  return {
    ready: false,
    missing,
    fix: 'seans-mfe-tool decompose:workspace <proposal> --build   (or, in the repository: npm run build:workspace)',
  };
}

/** Extra environment for every child process: the starting command's `TRACEPARENT` (ADR-081). */
export type ChildEnv = Record<string, string>;

function run(cmd: string, args: string[], cwd: string, log: (line: string) => void, env: ChildEnv): Promise<void> {
  log(`  $ ${cmd} ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'], shell: false, env: { ...process.env, ...env } });
    let err = '';
    child.stderr.on('data', (d: Buffer) => (err += d.toString('utf8')));
    child.on('error', (e) => reject(new SystemError(`could not run ${cmd}: ${e.message}`, e)));
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new SystemError(`${cmd} ${args.join(' ')} exited ${code}: ${err.trim().split('\n').slice(-5).join(' | ')}`))
    );
  });
}

/** Install and build the workspace MFE: its page, its mesh, its BFF server. */
export async function buildMfe(mfeDir: string, log: (line: string) => void, env: ChildEnv = {}): Promise<void> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if (!fs.existsSync(path.join(mfeDir, 'node_modules'))) await run(npm, ['install', '--no-audit', '--no-fund'], mfeDir, log, env);
  await run(npm, ['exec', '--', 'mesh', 'build'], mfeDir, log, env);
  await run(npm, ['exec', '--', 'rspack', 'build'], mfeDir, log, env);
  await run(npm, ['run', 'build:server'], mfeDir, log, env);
}

/** Whether nothing listens on 127.0.0.1:port — a health check alone would happily talk to a stranger. */
export function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

/** The name recorded on comments and approvals: git's user.name, else the OS user. */
export function whoIsApproving(cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('git', ['config', 'user.name'], { cwd, encoding: 'utf8' }, (err, out) => {
      resolve(!err && out.trim() ? out.trim() : os.userInfo().username);
    });
  });
}

async function waitForHealth(url: string, child: ChildProcess, output: () => string, seconds = 60): Promise<void> {
  let exited: number | null = null;
  child.once('exit', (code) => (exited = code ?? 1));
  for (let i = 0; i < seconds * 4; i += 1) {
    if (exited !== null) throw new SystemError(`the workspace BFF exited (${exited}) before it was ready: ${output().trim().split('\n').slice(-5).join(' | ')}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new SystemError(`the workspace BFF did not answer ${url} within ${seconds}s`);
}

export interface WorkspaceOptions {
  proposalDir: string;
  evidenceDir?: string;
  port: number;
  who: string;
  commit: boolean;
  log: (line: string) => void;
  mfeDir?: string;
  /** The agent, or why there is none (ADR-117); the caller decides — this package never names a provider. */
  agent?: { agent: WorkspaceAgent } | { unavailable: string };
  /** Merged into every child process's environment: pass `BaseCommand.childTraceEnv()` (ADR-081). */
  childEnv?: ChildEnv;
}

export interface RunningWorkspace {
  url: string;
  api: string;
  bff: string;
  approvals: CommitResult[];
  /** "connected", or why not. */
  agent: string;
  close(): Promise<void>;
}

export async function startWorkspace(opts: WorkspaceOptions): Promise<RunningWorkspace> {
  const agentState = opts.agent ?? { unavailable: 'No agent is connected.' };
  const mfeDir = opts.mfeDir ?? MFE_DIR;
  const proposalDir = path.resolve(opts.proposalDir);
  if (!fs.existsSync(path.join(proposalDir, 'decomposition.yaml'))) {
    throw new ValidationError(`no decomposition.yaml in ${proposalDir} — run decompose:propose first`, 'proposal', 'decomposition.yaml');
  }
  const ready = preflight(mfeDir);
  if (!ready.ready) {
    throw new ValidationError(`the workspace MFE is not built (missing ${ready.missing.join(', ')}). Run: ${ready.fix}`, 'workspace', 'built');
  }

  for (const [port, what] of [
    [API_PORT, 'the workspace API'],
    [BFF_PORT, "the workspace MFE's BFF"],
    [opts.port, 'the workspace page'],
  ] as const) {
    if (!(await portIsFree(port))) {
      throw new SystemError(`port ${port} is in use — ${what} needs it. Stop whatever is on it (an earlier workspace?) and retry.`);
    }
  }

  const approvals: CommitResult[] = [];
  let api: RunningApi | undefined;
  let bff: ChildProcess | undefined;
  let front: RunningFront | undefined;
  /** Ask the BFF to stop, and make it stop: a page that edits a repository must not outlive the command. */
  const stopBff = async () => {
    const child = bff;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 3000);
    await exited;
    clearTimeout(force);
  };
  const killOnExit = () => {
    if (bff && bff.exitCode === null) bff.kill('SIGKILL');
  };
  process.once('exit', killOnExit);
  const close = async () => {
    await front?.close();
    await stopBff();
    await api?.close();
    process.removeListener('exit', killOnExit);
  };

  try {
    api = await startWorkspaceApi({
      proposalDir,
      evidenceDir: opts.evidenceDir,
      who: opts.who,
      port: API_PORT,
      ...('agent' in agentState ? { agent: agentState.agent } : { agentUnavailable: agentState.unavailable }),
      onApproved: async (by) => {
        if (!opts.commit) return;
        const result = await commitApproval(proposalDir, by, opts.childEnv);
        approvals.push(result);
        opts.log(result.committed ? `  ✓ approval by ${by} committed (${result.commit})` : `  ! approval by ${by} recorded, not committed: ${result.reason}`);
      },
    }).catch((err: NodeJS.ErrnoException) => {
      throw err.code === 'EADDRINUSE'
        ? new SystemError(`port ${API_PORT} is in use — the workspace API needs it (its BFF reaches it there). Stop whatever is on it and retry.`, err)
        : err;
    });

    let output = '';
    bff = spawn(process.execPath, ['server.js'], {
      cwd: mfeDir,
      env: { ...process.env, ...opts.childEnv, PORT: String(BFF_PORT), HOST: '127.0.0.1', NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    bff.stdout?.on('data', (d: Buffer) => (output += d.toString('utf8')));
    bff.stderr?.on('data', (d: Buffer) => (output += d.toString('utf8')));
    const bffUrl = `http://127.0.0.1:${BFF_PORT}`;
    await waitForHealth(`${bffUrl}/health`, bff, () => output);

    front = await startFront({ dist: path.join(mfeDir, 'dist'), bff: bffUrl, api: api.url, port: opts.port });
    const agent = 'agent' in agentState ? `connected${agentState.agent.model ? ` (${agentState.agent.model})` : ''}` : agentState.unavailable;
    return { url: front.url, api: api.url, bff: bffUrl, approvals, agent, close };
  } catch (err) {
    await close();
    throw err;
  }
}

#!/usr/bin/env node
/**
 * Reverse-engineer the RealWorld corpus (#442): run the decomposition toolchain
 * on apps nobody here wrote, and report what it reconstructs.
 *
 * For each app in corpus.yaml: clone it at its pinned commit, apply its one
 * setup change, start it against a seeded reference backend, then
 *
 *   decompose:capture → decompose:analyze → decompose:propose
 *     → propose --spec (the inferred OpenAPI scored against the published spec)
 *     → decompose:verify (the app against its own capture: are the journeys deterministic?)
 *
 * and write a summary: domains found, coverage, spec agreement, parity. Needs
 * git, Go (the backend), Node and a Chromium (set CHROMIUM_PATH if Playwright's
 * own is missing). Run `npm run build` first.
 *
 *   node scripts/corpus/realworld/run.mjs [--work <dir>] [--only <app>]
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { seed } from './seed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const corpus = yaml.load(fs.readFileSync(path.join(here, 'corpus.yaml'), 'utf8'));
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const work = path.resolve(arg('work') ?? path.join(os.tmpdir(), 'smt-corpus-realworld'));
const only = arg('only');
const CLOCK = '2026-10-24T12:00:00.000Z';
const children = [];

const log = (msg) => process.stderr.write(`${msg}\n`);
/** Stop every server started, its own children included (`npm start` → react-scripts → webpack). */
function stopAll() {
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}
function fail(msg) {
  log(`✗ ${msg}`);
  stopAll();
  process.exit(1);
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0 && !opts.allowFail) fail(`${cmd} ${args.join(' ')} exited ${r.status}`);
  return r.status;
}
/** A CLI call under --json: the envelope, whatever the exit code. */
function cli(args) {
  const r = spawnSync('node', [path.join(repoRoot, 'bin/run.js'), ...args, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout ?? '').trim().split('\n').pop() ?? '';
  try {
    return JSON.parse(line);
  } catch {
    fail(`${args[0]} printed no JSON envelope:\n${r.stderr}`);
  }
  return null;
}
function start(name, cmd, args, opts) {
  const out = fs.openSync(path.join(work, `${name}.log`), 'w');
  // Its own process group, so stopping it stops what it spawned.
  const child = spawn(cmd, args, { stdio: ['ignore', out, out], detached: true, ...opts });
  children.push(child);
  return child;
}
async function waitFor(url, seconds = 300) {
  for (let i = 0; i < seconds; i += 2) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail(`${url} did not come up in ${seconds}s`);
}
function clone(repo, commit, dir) {
  if (fs.existsSync(path.join(dir, '.git'))) return;
  fs.mkdirSync(dir, { recursive: true });
  run('git', ['init', '-q', dir]);
  run('git', ['-C', dir, 'fetch', '-q', '--depth', '1', `https://github.com/${repo}`, commit]);
  run('git', ['-C', dir, 'checkout', '-q', 'FETCH_HEAD']);
}

fs.mkdirSync(work, { recursive: true });
log(`corpus work directory: ${work}`);

// ---- spec and backend ---------------------------------------------------------------
const specDir = path.join(work, 'src', 'realworld');
clone(corpus.spec.repo, corpus.spec.commit, specDir);
const publishedSpec = path.join(specDir, corpus.spec.path);

const backendDir = path.join(work, 'src', 'backend');
clone(corpus.backend.repo, corpus.backend.commit, backendDir);
const backendBin = path.join(work, 'conduit-api');
if (!fs.existsSync(backendBin)) run('go', ['build', '-o', backendBin, '.'], { cwd: backendDir });
const db = path.join(work, 'conduit.db');
fs.rmSync(db, { force: true });
start('backend', backendBin, [], { env: { ...process.env, DB_PATH: db, PORT: String(corpus.backend.port), GIN_MODE: 'release' } });
const api = `http://localhost:${corpus.backend.port}/api`;
await waitFor(`${api}/tags`);
log(`seeded: ${JSON.stringify(await seed(api))}`);

// ---- apps ---------------------------------------------------------------------------
const rows = [];
for (const app of corpus.apps) {
  if (only && app.name !== only) continue;
  log(`\n===== ${app.name} (${app.stack})`);
  const dir = path.join(work, 'src', app.name);
  clone(app.repo, app.commit, dir);
  const { file, from, to } = app.setup.replace;
  const target = path.join(dir, file);
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(from, to));
  const pkgFile = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  pkg.proxy = `http://localhost:${corpus.backend.port}`;
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  if (!fs.existsSync(path.join(dir, 'node_modules'))) run('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps'], { cwd: dir });
  // Webpack 3/4 predate Node 17's OpenSSL 3.
  start(app.name, 'npm', ['start'], {
    cwd: dir,
    env: { ...process.env, BROWSER: 'none', PORT: String(app.port), NODE_OPTIONS: '--openssl-legacy-provider' },
  });
  const url = `http://localhost:${app.port}`;
  await waitFor(url);

  const ev = path.join(work, app.name, 'evidence');
  fs.rmSync(path.join(work, app.name), { recursive: true, force: true });
  const capture = cli(['decompose:capture', url, '--journeys', path.join(here, 'journeys.yaml'), '--explore', '12', '--clock', CLOCK, '--out', ev]);
  const analyze = cli(['decompose:analyze', dir, '--evidence', ev]);
  const propose = cli(['decompose:propose', path.join(ev, 'source'), '--name', 'conduit']);
  const scored = cli(['decompose:propose', '--from', path.join(ev, 'proposal', 'decomposition.yaml'), '--spec', `api=${publishedSpec}`]);
  const verify = cli(['decompose:verify', ev, '--out', path.join(work, app.name, 'verify')]);

  const c = capture.data?.stats;
  const j = analyze.data?.join;
  const spec = scored.data?.specs?.find((s) => s.backend === 'api');
  const inferred = propose.data?.specs?.find((s) => s.backend === 'api');
  rows.push({
    app: app.name,
    stack: app.stack,
    steps: c?.steps,
    mapped: c ? `${Math.round((100 * c.sourceCoverage.mappedToSource) / Math.max(1, c.sourceCoverage.visibleElements))}%` : '?',
    explained: j ? `${j.explained}/${j.observedEndpoints}` : '?',
    domains: (propose.data?.domains ?? []).map((d) => d.id).join(', '),
    operations: inferred?.operations,
    matchedPublished: spec?.differences ? `${spec.differences.operationsMatched}/${inferred?.operations}` : '?',
    notPublished: spec?.differences?.inferredOnly.length,
    parity: verify.ok ? `${verify.data.summary.stepsAtParity}/${verify.data.summary.steps}` : `not at parity (${verify.error?.message ?? 'see report'})`,
  });
}

stopAll();

const table = [
  '| App | Stack | Steps | Mapped to source | Calls explained by source | Domains | Inferred operations | Matching the published spec | Not in the spec | Parity with itself |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.app} | ${r.stack} | ${r.steps} | ${r.mapped} | ${r.explained} | ${r.domains} | ${r.operations} | ${r.matchedPublished} | ${r.notPublished} | ${r.parity} |`),
].join('\n');
fs.writeFileSync(path.join(work, 'summary.md'), `# RealWorld corpus run\n\n${table}\n`);
process.stdout.write(`${table}\n`);

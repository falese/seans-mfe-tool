/**
 * Validates what commands ACTUALLY return against what they publish.
 *
 * `json-contract.test.ts` has claimed since it was written that it "validates
 * every envelope against the CommandResult meta-schema plus the per-command
 * output schema from schemas/". It never did — `ajv.compile(ENVELOPE_SCHEMA)`
 * was the only compile, and that is why `remote:generate.preserved` and
 * `bff:validate.{manifest,meshConfig}` were absent from schemas declared
 * `additionalProperties: false` for months, silently rejecting every response
 * from a validating client.
 *
 * This is the check that was promised.
 *
 * It is a belt over the compiler's braces, not a replacement: output schemas
 * are derived from each command's declared result type, and TypeScript already
 * enforces that a command returns it. What this catches is the gap the type
 * system cannot see — a runtime `as` cast, a hand-built object literal that
 * escapes the declared type, a field added by a helper. Cheap insurance on a
 * link that is otherwise sound.
 *
 * Refs #139 · ADR-018 · ADR-077
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Ajv, { type ValidateFunction } from 'ajv';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const CLI_BIN = path.join(REPO_ROOT, 'bin', 'run.js');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');
const ABC_KIDS = path.join(REPO_ROOT, 'examples', 'abc-kids');

jest.setTimeout(180_000);

/**
 * A success-path invocation per command. `data` only exists on success, so a
 * command that cannot be driven to success here contributes nothing — which is
 * why each absence below is named with a reason rather than left implicit.
 */
interface Invocation {
  args: string[];
  cwd?: string;
  /** Filename this command writes; redirected into the temp dir via --output. */
  writesTo?: string;
}

const FLAPPY = path.join(ABC_KIDS, 'flappy');
/** An MFE with a `data:` section, so the BFF commands have a real mesh config. */
const BFF_MANIFEST = path.join(ABC_KIDS, 'multiplication-quiz', 'mfe-manifest.yaml');
const PETSTORE_SPEC = path.join(REPO_ROOT, 'examples', 'api-examples', 'petstore.yaml');

const INVOCATIONS: Record<string, Invocation> = {
  // Both walk up for docs/architecture-decisions, so they need the repo root.
  'adr:status':     { args: ['adr:status'], cwd: REPO_ROOT },
  'adr:validate':   { args: ['adr:validate'], cwd: REPO_ROOT },
  'build:check':    { args: ['build:check', '--framework', 'react'] },
  'mfe:validate':   { args: ['mfe:validate', FLAPPY] },
  'slots:validate': {
    args: [
      'slots:validate',
      '--rules', path.join(ABC_KIDS, 'control-plane', 'rules.json'),
      '--manifests', ABC_KIDS,
    ],
  },
  // Read-only: compiles the composition in memory and compares it with the
  // committed payload. --check makes it assert the fleet is current, so this
  // doubles as a guard that abc-kids' rules.json has not drifted (ADR-083).
  'compose:validate': { args: ['compose:validate', ABC_KIDS, '--check'] },
  // --dry-run so the success path reports without rewriting rules.json.
  'compose:build':    { args: ['compose:build', ABC_KIDS, '--dry-run'] },
  deploy:        { args: ['deploy', 'probe', '--type', 'remote', '--dry-run'] },
  'remote:init': { args: ['remote:init', 'probe-mfe', '--dry-run', '--skip-install'] },

  // --dry-run makes the mutating commands cheap: they plan and report without
  // writing, which is exactly the success-path payload we need to validate.
  // Verified to leave the working tree clean.
  'remote:generate':            { args: ['remote:generate', '--dry-run'], cwd: FLAPPY },
  'remote:generate:capability': { args: ['remote:generate:capability', 'PlayGame', '--dry-run'], cwd: FLAPPY },
  api: {
    args: ['api', 'probe-api', '--spec', PETSTORE_SPEC, '--database', 'sqlite', '--dry-run'],
  },
  'bff:init':  { args: ['bff:init', 'probe-bff', '--specs', PETSTORE_SPEC, '--dry-run'] },
  'bff:build': { args: ['bff:build', '--manifest', BFF_MANIFEST, '--dry-run'] },
  // Read-only: parses the manifest and mesh config and reports findings.
  'bff:validate': { args: ['bff:validate', '--manifest', BFF_MANIFEST] },
  // Without --build it only writes a Dockerfile from the framework plugin — no
  // Docker daemon involved. `--output` keeps it out of the source tree.
  'build:docker': { args: ['build:docker', '--cwd', FLAPPY], writesTo: 'Dockerfile' },
};

/**
 * The three commands with no success-path invocation cheap enough for a unit
 * suite. Each is an infrastructure cost, not an unknown contract — and the list
 * is deliberately short: seven commands that were on it are now exercised
 * above, because `--dry-run` or a read-only mode made them reachable after all.
 */
const NO_FIXTURE: Record<string, string> = {
  'build:dev': 'starts a long-lived dev server and only returns once it is listening',
  'bff:dev': 'starts a long-lived mesh server',
  'build:prod': 'needs an installed bundler in the target project (a full npm install per run)',
  'coder:compile': 'shells out to the external coder MLX model service (ADR-085/ADR-088) — an ~18GB Apple-Silicon dependency absent from CI',
};

function runCli(args: string[], cwd: string): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    const child = spawn('node', [CLI_BIN, ...args], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env },
      cwd,
    });
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
    child.on('close', (code) => resolve({ stdout, code: code ?? 1 }));
  });
}

const ajv = new Ajv({ strict: false, allErrors: true });

function outputValidator(commandId: string): ValidateFunction {
  const file = path.join(SCHEMAS_DIR, `${commandId.replace(/:/g, '-')}.json`);
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  return ajv.compile(schema.output);
}

const catalogued = fs
  .readdirSync(SCHEMAS_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.basename(f, '.json').replace(/-/g, ':'))
  .sort();

// ---------------------------------------------------------------------------

describe('every catalogued command is either exercised or has a named reason', () => {
  it('accounts for all of them', () => {
    const unaccounted = catalogued.filter((id) => !(id in INVOCATIONS) && !(id in NO_FIXTURE));
    expect(unaccounted).toEqual([]);
  });

  it('names nothing that is not catalogued', () => {
    const stale = [...Object.keys(INVOCATIONS), ...Object.keys(NO_FIXTURE)]
      .filter((id) => !catalogued.includes(id))
      .sort();
    expect(stale).toEqual([]);
  });
});

describe('command output matches its published schema', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'output-conformance-'));
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it.each(Object.entries(INVOCATIONS))('%s', async (commandId, invocation) => {
    const args = [
      ...invocation.args,
      ...(invocation.writesTo ? ['--output', path.join(tmp, invocation.writesTo)] : []),
      '--json',
    ];
    const { stdout, code } = await runCli(args, invocation.cwd ?? tmp);

    const envelope = JSON.parse(stdout.trim()) as {
      ok: boolean;
      data?: unknown;
      error?: { message: string };
    };

    // A command that failed carries no `data`; that is a fixture problem, not
    // a contract violation, and saying so beats a confusing schema error.
    expect({ command: commandId, ok: envelope.ok, why: envelope.error?.message ?? null })
      .toEqual({ command: commandId, ok: true, why: null });
    expect(code).toBe(0);

    const validate = outputValidator(commandId);
    if (!validate(envelope.data)) {
      throw new Error(
        `${commandId} returned data its published schema rejects:\n` +
        `${ajv.errorsText(validate.errors, { separator: '\n' })}\n\n` +
        `data: ${JSON.stringify(envelope.data, null, 2).slice(0, 1200)}`,
      );
    }
  });
});

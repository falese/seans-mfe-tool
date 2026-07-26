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
}

const INVOCATIONS: Record<string, Invocation> = {
  // Both walk up for docs/architecture-decisions, so they need the repo root.
  'adr:status':     { args: ['adr:status'], cwd: REPO_ROOT },
  'adr:validate':   { args: ['adr:validate'], cwd: REPO_ROOT },
  'build:check':    { args: ['build:check', '--framework', 'react'] },
  'mfe:validate':   { args: ['mfe:validate', path.join(ABC_KIDS, 'flappy')] },
  'slots:validate': {
    args: [
      'slots:validate',
      '--rules', path.join(ABC_KIDS, 'control-plane', 'rules.json'),
      '--manifests', ABC_KIDS,
    ],
  },
  deploy:        { args: ['deploy', 'probe', '--type', 'remote', '--dry-run'] },
  'remote:init': { args: ['remote:init', 'probe-mfe', '--dry-run', '--skip-install'] },
};

/**
 * Commands with no success-path invocation cheap enough to run in a unit
 * suite. Not a place to hide a broken contract — each is an infrastructure
 * cost, not an unknown.
 */
const NO_FIXTURE: Record<string, string> = {
  api: 'needs an OpenAPI spec fixture and writes a full project even under --dry-run',
  'build:dev': 'starts a long-lived dev server',
  'build:docker': 'needs a Docker daemon',
  'build:prod': 'needs an installed bundler in the target project',
  'remote:generate': 'needs a scaffolded MFE with node_modules in cwd',
  'remote:generate:capability': 'same as remote:generate',
  'bff:init': 'writes a project and resolves OpenAPI sources',
  'bff:build': 'needs a built BFF project',
  'bff:dev': 'starts a long-lived server',
  'bff:validate': 'needs a BFF project with a resolvable mesh config',
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
    const { stdout, code } = await runCli(
      [...invocation.args, '--json'],
      invocation.cwd ?? tmp,
    );

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

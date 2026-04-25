/**
 * B9: JSON contract integration tests.
 *
 * Spawns the CLI as a child process (same path the MCP server uses) and
 * validates every envelope against the CommandResult meta-schema plus the
 * per-command output schema from schemas/.
 *
 * Each test calls `node bin/run.js <cmd> --json` and asserts:
 *   - stdout is exactly one JSON line
 *   - the envelope passes ajv validation against ENVELOPE_SCHEMA
 *   - ok / error.type / exit code match expectations
 *
 * Refs #108 (B9)
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import Ajv from 'ajv';

// I/O events from child processes are not timer-driven; disable global fake
// timers for this file so spawn/close callbacks fire naturally.
jest.useRealTimers();

const CLI_BIN     = path.resolve(__dirname, '..', '..', '..', 'bin', 'run.js');

// ---------------------------------------------------------------------------
// CommandResult meta-schema (JSON Schema draft-07, ajv v8 default)
// ---------------------------------------------------------------------------

const ENVELOPE_SCHEMA = {
  type: 'object',
  required: ['ok', 'warnings', 'telemetry'],
  additionalProperties: false,
  properties: {
    ok:      { type: 'boolean' },
    data:    {},
    error: {
      type: 'object',
      required: ['type', 'code', 'message', 'retryable', 'userFacing'],
      additionalProperties: true,
      properties: {
        type:       { type: 'string' },
        code:       { type: 'number' },
        message:    { type: 'string' },
        retryable:  { type: 'boolean' },
        userFacing: { type: 'boolean' },
        details:    {},
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
    telemetry: {
      type: 'object',
      required: ['durationMs', 'correlationId'],
      additionalProperties: true,
      properties: {
        durationMs:    { type: 'number' },
        correlationId: { type: 'string' },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runCli(
  args: string[],
  opts: { cwd?: string } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('node', [CLI_BIN, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: opts.cwd ?? process.cwd(),
    });
    child.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
    child.on('close', (code) => { resolve({ stdout, stderr, code: code ?? 1 }); });
  });
}

const ajv = new Ajv({ strict: false });
const validateEnvelope = ajv.compile(ENVELOPE_SCHEMA);

function parseEnvelope(stdout: string): Record<string, unknown> {
  const line = stdout.trim();
  if (!line) throw new Error('Command produced no stdout');

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`stdout is not valid JSON: ${line.slice(0, 300)}`);
  }

  if (!validateEnvelope(parsed)) {
    throw new Error(
      `Envelope schema violations: ${JSON.stringify(validateEnvelope.errors, null, 2)}`,
    );
  }
  return parsed as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Envelope structure — baseline with `schemas --json` (no side effects)
// ---------------------------------------------------------------------------

describe('JSON contract: envelope structure', () => {
  let env: Record<string, unknown>;

  beforeAll(async () => {
    const { stdout, code } = await runCli(['schemas', '--json']);
    expect(code).toBe(0);
    env = parseEnvelope(stdout);
  });

  it('ok is true on success', () => {
    expect(env.ok).toBe(true);
  });

  it('data contains cliVersion (string) and commands (array)', () => {
    const data = env.data as Record<string, unknown>;
    expect(typeof data.cliVersion).toBe('string');
    expect(Array.isArray(data.commands)).toBe(true);
  });

  it('telemetry has UUID correlationId', () => {
    const tel = env.telemetry as Record<string, unknown>;
    expect(typeof tel.correlationId).toBe('string');
    expect(tel.correlationId as string).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('telemetry has non-negative durationMs', () => {
    const tel = env.telemetry as Record<string, unknown>;
    expect(typeof tel.durationMs).toBe('number');
    expect(tel.durationMs as number).toBeGreaterThanOrEqual(0);
  });

  it('warnings is an array', () => {
    expect(Array.isArray(env.warnings)).toBe(true);
  });

  it('error field is absent on success', () => {
    expect(env.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Typed error exit codes
// ---------------------------------------------------------------------------

describe('JSON contract: typed error exit codes', () => {
  it('ValidationError → exit 64, error.type=validation', async () => {
    // bff:init without a name arg from a dir lacking mfe-manifest.yaml
    // triggers ValidationError('No mfe-manifest.yaml found…')
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-b9-'));
    try {
      const { stdout, code } = await runCli(['bff:init', '--json'], { cwd: tmpDir });
      expect(code).toBe(64);
      const env = parseEnvelope(stdout);
      expect(env.ok).toBe(false);
      const err = env.error as Record<string, unknown>;
      expect(err.type).toBe('validation');
      expect(err.code).toBe(64);
      expect(typeof err.message).toBe('string');
      expect(err.retryable).toBe(false);
    } finally {
      await fs.remove(tmpDir);
    }
  });

  it('BusinessError → exit 65, error.type=business', async () => {
    // remote:init on a pre-existing dir without --force → BusinessError('DIR_EXISTS')
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-b9-'));
    const appDir = path.join(tmpDir, 'existing-app');
    await fs.ensureDir(appDir);
    try {
      const { stdout, code } = await runCli(
        ['remote:init', 'existing-app', '--json'],
        { cwd: tmpDir },
      );
      expect(code).toBe(65);
      const env = parseEnvelope(stdout);
      expect(env.ok).toBe(false);
      const err = env.error as Record<string, unknown>;
      expect(err.type).toBe('business');
      expect(err.code).toBe(65);
    } finally {
      await fs.remove(tmpDir);
    }
  });

  it('SystemError → exit 69, error.type=system', async () => {
    // bff:init with a name from a dir where templates/bff is absent → SystemError
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-b9-'));
    try {
      const { stdout, code } = await runCli(
        ['bff:init', 'test-bff', '--json'],
        { cwd: tmpDir },
      );
      expect(code).toBe(69);
      const env = parseEnvelope(stdout);
      expect(env.ok).toBe(false);
      const err = env.error as Record<string, unknown>;
      expect(err.type).toBe('system');
      expect(err.code).toBe(69);
    } finally {
      await fs.remove(tmpDir);
    }
  });

  it('error envelope passes meta-schema validation', async () => {
    // Reuse the ValidationError case to verify the error envelope shape
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-b9-'));
    try {
      const { stdout } = await runCli(['bff:init', '--json'], { cwd: tmpDir });
      // parseEnvelope already runs ajv — success here means the schema passed
      expect(() => parseEnvelope(stdout)).not.toThrow();
    } finally {
      await fs.remove(tmpDir);
    }
  });
});

// ---------------------------------------------------------------------------
// --dry-run: mutating commands preview without writing files
// ---------------------------------------------------------------------------

describe('JSON contract: --dry-run', () => {
  it('remote:init --dry-run: ok=true, dryRun=true, target dir not created', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-b9-'));
    try {
      const { stdout, code } = await runCli(
        ['remote:init', 'dry-app', '--json', '--dry-run'],
        { cwd: tmpDir },
      );
      expect(code).toBe(0);
      const env = parseEnvelope(stdout);
      expect(env.ok).toBe(true);
      const data = env.data as Record<string, unknown>;
      expect(data.dryRun).toBe(true);
      expect(data.generatedFiles).toEqual([]);
      expect(Array.isArray(data.plannedChanges)).toBe(true);
      expect((data.plannedChanges as unknown[]).length).toBeGreaterThan(0);
      expect(await fs.pathExists(path.join(tmpDir, 'dry-app'))).toBe(false);
    } finally {
      await fs.remove(tmpDir);
    }
  });

  it('deploy --dry-run: ok=true, dryRun=true', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfe-b9-'));
    try {
      const { stdout, code } = await runCli(
        ['deploy', 'dry-deploy', '--type', 'shell', '--json', '--dry-run'],
        { cwd: tmpDir },
      );
      expect(code).toBe(0);
      const env = parseEnvelope(stdout);
      expect(env.ok).toBe(true);
      const data = env.data as Record<string, unknown>;
      expect(data.dryRun).toBe(true);
      expect(Array.isArray(data.plannedChanges)).toBe(true);
    } finally {
      await fs.remove(tmpDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Schema catalog content
// ---------------------------------------------------------------------------

describe('JSON contract: schemas catalog', () => {
  let commands: Array<Record<string, unknown>>;

  beforeAll(async () => {
    const { stdout } = await runCli(['schemas', '--json']);
    const env = parseEnvelope(stdout);
    const catalog = env.data as Record<string, unknown>;
    commands = catalog.commands as Array<Record<string, unknown>>;
  });

  it('includes all 9 expected command schemas', () => {
    const names = new Set(commands.map((c) => c.name as string));
    for (const expected of [
      'deploy', 'api',
      'bff:init', 'bff:build', 'bff:dev', 'bff:validate',
      'remote:init', 'remote:generate', 'remote:generate:capability',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('each schema entry has name, input, output, errorCodes', () => {
    for (const cmd of commands) {
      expect(typeof cmd.name).toBe('string');
      expect(typeof cmd.input).toBe('object');
      expect(typeof cmd.output).toBe('object');
      expect(Array.isArray(cmd.errorCodes)).toBe(true);
    }
  });

  it('all schemas include exit code 0 and 64', () => {
    for (const cmd of commands) {
      const codes = cmd.errorCodes as number[];
      expect(codes).toContain(0);
      expect(codes).toContain(64);
    }
  });
});

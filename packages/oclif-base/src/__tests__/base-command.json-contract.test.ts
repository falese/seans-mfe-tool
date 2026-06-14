/**
 * Locks the --json stdout contract against silent drift (CA-2, issue #230).
 *
 * Contract: under --json, stdout receives exactly ONE newline-terminated JSON
 * line — the CommandResult<T> envelope.  Everything else goes to stderr.
 * Exit codes must match EXIT_CODES for both success and every error type.
 *
 * Refs #230 · Refs #219 (CA-2)
 */

// json-output side-effects (chalk suppression, stdout redirect) are irrelevant
// to the envelope contract and would fight the test environment.  Mock them out
// so we can call BaseCommand.run() in-process.
jest.mock('../json-output', () => ({
  suppressChalk: jest.fn(),
  redirectStdoutToStderr: jest.fn(),
  blockInteractivePrompts: jest.fn(),
  writeJsonLine: jest.fn(),
}));

import type { Config } from '@oclif/core';
import { ValidationError, NetworkError, EXIT_CODES } from '@seans-mfe/contracts';
import type { CommandResult } from '@seans-mfe/contracts';
import { BaseCommand } from '../BaseCommand';
import { writeJsonLine } from '../json-output';

const writeMock = jest.mocked(writeJsonLine);

// BaseCommand.run() only uses this.argv (set from the constructor arg).
// Config is used by oclif internals that we bypass by calling run() directly.
const FAKE_CONFIG = {} as unknown as Config;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Concrete test commands
// ---------------------------------------------------------------------------

class SuccessCmd extends BaseCommand<{ name: string }> {
  protected async runCommand() {
    return { name: 'test' };
  }
}

class WarnCmd extends BaseCommand<{ count: number }> {
  protected async runCommand() {
    this.warnings.push('deprecated usage');
    return { count: 1 };
  }
}

class ValidationFailCmd extends BaseCommand<never> {
  protected async runCommand(): Promise<never> {
    throw new ValidationError('name is required', 'name', 'required');
  }
}

class NetworkFailCmd extends BaseCommand<never> {
  protected async runCommand(): Promise<never> {
    throw new NetworkError('upstream unreachable', 503);
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Run the given command in --json mode, capture the envelope written to
 * stdout and the process exit code, then return both.
 *
 * process.exit is already replaced by a throwing jest.fn() in jest.setup.js,
 * so we just catch the thrown error and read the recorded call arg.
 */
async function runJsonMode(
  Cmd: new (argv: string[], config: Config) => BaseCommand,
): Promise<{ envelope: CommandResult<unknown>; exitCode: number }> {
  // Make writeJsonLine call the resolve callback so the awaited Promise in
  // BaseCommand.run() settles before process.exit is called.
  writeMock.mockImplementation((_json: string, cb?: () => void) => {
    cb?.();
  });

  const cmd = new Cmd(['--json'], FAKE_CONFIG);

  try {
    await cmd.run();
  } catch {
    // process.exit() mock throws — this is expected
  }

  expect(writeMock).toHaveBeenCalledTimes(1);
  const [json] = writeMock.mock.calls[0] as [string, ...unknown[]];

  // Contract: json must not contain embedded newlines; writeJsonLine appends its own \n
  expect(json).not.toMatch(/\n/);

  const envelope = JSON.parse(json) as CommandResult<unknown>;
  const exitCode = (process.exit as jest.Mock).mock.calls[0]?.[0] as number;

  return { envelope, exitCode };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseCommand --json stdout contract (CA-2)', () => {
  beforeEach(() => {
    writeMock.mockImplementation((_json: string, cb?: () => void) => {
      cb?.();
    });
  });

  describe('success path', () => {
    it('emits exactly one parseable JSON line on stdout', async () => {
      const { envelope } = await runJsonMode(SuccessCmd);
      expect(envelope).toBeDefined();
    });

    it('envelope shape: ok=true, data present, no error', async () => {
      const { envelope } = await runJsonMode(SuccessCmd);
      expect(envelope.ok).toBe(true);
      expect(envelope.data).toEqual({ name: 'test' });
      expect(envelope.error).toBeUndefined();
    });

    it('envelope has warnings array and telemetry with valid correlationId', async () => {
      const { envelope } = await runJsonMode(SuccessCmd);
      expect(Array.isArray(envelope.warnings)).toBe(true);
      expect(typeof envelope.telemetry.durationMs).toBe('number');
      expect(envelope.telemetry.correlationId).toMatch(UUID_V4);
    });

    it('exits with code 0 (EXIT_CODES.ok)', async () => {
      const { exitCode } = await runJsonMode(SuccessCmd);
      expect(exitCode).toBe(EXIT_CODES.ok);
    });

    it('warnings pushed by the command appear in the envelope', async () => {
      const { envelope } = await runJsonMode(WarnCmd);
      expect(envelope.warnings).toEqual(['deprecated usage']);
    });
  });

  describe('error path', () => {
    it('emits exactly one parseable JSON line on error', async () => {
      const { envelope } = await runJsonMode(ValidationFailCmd);
      expect(envelope).toBeDefined();
    });

    it('envelope shape: ok=false, no data', async () => {
      const { envelope } = await runJsonMode(ValidationFailCmd);
      expect(envelope.ok).toBe(false);
      expect(envelope.data).toBeUndefined();
    });

    it('error.type is a string and error.code is a number', async () => {
      const { envelope } = await runJsonMode(ValidationFailCmd);
      expect(typeof envelope.error?.type).toBe('string');
      expect(typeof envelope.error?.code).toBe('number');
    });

    it('validation error → type=validation, code=64, exit=64', async () => {
      const { envelope, exitCode } = await runJsonMode(ValidationFailCmd);
      expect(envelope.error?.type).toBe('validation');
      expect(envelope.error?.code).toBe(EXIT_CODES.validation);
      expect(exitCode).toBe(EXIT_CODES.validation);
    });

    it('network error → type=network, code=66, exit=66', async () => {
      const { envelope, exitCode } = await runJsonMode(NetworkFailCmd);
      expect(envelope.error?.type).toBe('network');
      expect(envelope.error?.code).toBe(EXIT_CODES.network);
      expect(exitCode).toBe(EXIT_CODES.network);
    });

    it('exit code always matches envelope error.code', async () => {
      const { envelope, exitCode } = await runJsonMode(ValidationFailCmd);
      expect(exitCode).toBe(envelope.error?.code);
    });

    it('error envelope has telemetry with valid correlationId', async () => {
      const { envelope } = await runJsonMode(ValidationFailCmd);
      expect(envelope.telemetry.correlationId).toMatch(UUID_V4);
    });
  });
});

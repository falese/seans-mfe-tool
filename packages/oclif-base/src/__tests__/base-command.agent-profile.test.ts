/**
 * Locks the "agent profile" half of ADR-077 that --json alone never delivered.
 *
 * Two contracts:
 *   1. --no-interactive is a flag in its own right.  Before this, the only way
 *      to get non-interactive execution was to also switch to JSON output, so
 *      an agent that wanted human-readable stderr had no way to guarantee the
 *      command would not block on a prompt.
 *   2. Typed errors carry their sysexits code on EVERY failure path, not only
 *      under --json.  ADR-077's rule is "a typed code (64-124) for every
 *      failure class"; human mode was exiting 1 for all of them.
 *
 * Refs #139 · ADR-077 · ADR-017 · ADR-030
 */

jest.mock('../json-output', () => ({
  suppressChalk: jest.fn(),
  redirectStdoutToStderr: jest.fn(),
  blockInteractivePrompts: jest.fn(),
  writeJsonLine: jest.fn(),
}));

import type { Config } from '@oclif/core';
import { ValidationError, NetworkError, SecurityError, EXIT_CODES } from '@falese/smt-contracts';
import { BaseCommand } from '../BaseCommand';
import {
  blockInteractivePrompts,
  suppressChalk,
  redirectStdoutToStderr,
  writeJsonLine,
} from '../json-output';

const blockMock = jest.mocked(blockInteractivePrompts);
const chalkMock = jest.mocked(suppressChalk);
const redirectMock = jest.mocked(redirectStdoutToStderr);
const writeMock = jest.mocked(writeJsonLine);

const FAKE_CONFIG = {} as unknown as Config;

class SuccessCmd extends BaseCommand<{ ok: boolean }> {
  protected async runCommand() {
    return { ok: true };
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

class SecurityFailCmd extends BaseCommand<never> {
  protected async runCommand(): Promise<never> {
    throw new SecurityError('token rejected');
  }
}

class UntypedFailCmd extends BaseCommand<never> {
  protected async runCommand(): Promise<never> {
    throw new Error('something we never classified');
  }
}

class AlreadyCodedFailCmd extends BaseCommand<never> {
  protected async runCommand(): Promise<never> {
    const err = new Error('bad flag') as Error & { oclif?: { exit: number } };
    err.oclif = { exit: 2 };
    throw err;
  }
}

/** Run in human mode and return the error that escaped run(). */
async function runHuman(
  Cmd: new (argv: string[], config: Config) => BaseCommand,
  argv: string[] = [],
): Promise<Error & { oclif?: { exit: number } }> {
  const cmd = new Cmd(argv, FAKE_CONFIG);
  try {
    await cmd.run();
  } catch (err) {
    return err as Error & { oclif?: { exit: number } };
  }
  throw new Error('expected run() to throw');
}

beforeEach(() => {
  jest.clearAllMocks();
  writeMock.mockImplementation((_json: string, cb?: () => void) => cb?.());
});

// ---------------------------------------------------------------------------
// 1. --no-interactive
// ---------------------------------------------------------------------------

describe('--no-interactive flag', () => {
  it('is declared on baseFlags so every command inherits it', () => {
    expect(BaseCommand.baseFlags).toHaveProperty('interactive');
    expect(BaseCommand.baseFlags.interactive.allowNo).toBe(true);
    expect(BaseCommand.baseFlags.interactive.default).toBe(true);
  });

  it('blocks interactive prompts without requiring --json', async () => {
    await new SuccessCmd(['--no-interactive'], FAKE_CONFIG).run();
    expect(blockMock).toHaveBeenCalled();
  });

  it('leaves human output intact — no chalk suppression, no stdout redirect', async () => {
    await new SuccessCmd(['--no-interactive'], FAKE_CONFIG).run();
    expect(chalkMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('does not block prompts when neither flag is passed', async () => {
    await new SuccessCmd([], FAKE_CONFIG).run();
    expect(blockMock).not.toHaveBeenCalled();
  });

  it('--json still implies non-interactive (unchanged behaviour)', async () => {
    try {
      await new SuccessCmd(['--json'], FAKE_CONFIG).run();
    } catch {
      // process.exit mock throws
    }
    expect(blockMock).toHaveBeenCalled();
  });

  it('--json=true is recognised as JSON mode', async () => {
    try {
      await new SuccessCmd(['--json=true'], FAKE_CONFIG).run();
    } catch {
      // process.exit mock throws
    }
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Typed exit codes in human mode
// ---------------------------------------------------------------------------

describe('typed exit codes on every failure path', () => {
  it('validation error exits 64 in human mode', async () => {
    const err = await runHuman(ValidationFailCmd);
    expect(err.oclif?.exit).toBe(EXIT_CODES.validation);
  });

  it('network error exits 66 in human mode', async () => {
    const err = await runHuman(NetworkFailCmd);
    expect(err.oclif?.exit).toBe(EXIT_CODES.network);
  });

  it('security error exits 77 in human mode', async () => {
    const err = await runHuman(SecurityFailCmd);
    expect(err.oclif?.exit).toBe(EXIT_CODES.security);
  });

  it('re-throws the original error so oclif still renders its message', async () => {
    const err = await runHuman(ValidationFailCmd);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('name is required');
  });

  it('leaves unclassified errors to oclif — no invented exit code', async () => {
    const err = await runHuman(UntypedFailCmd);
    expect(err.oclif).toBeUndefined();
  });

  it('never overrides an exit code the error already carries', async () => {
    const err = await runHuman(AlreadyCodedFailCmd);
    expect(err.oclif?.exit).toBe(2);
  });

  it('human-mode failure does not emit a JSON envelope', async () => {
    await runHuman(ValidationFailCmd);
    expect(writeMock).not.toHaveBeenCalled();
  });
});

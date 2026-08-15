/**
 * BaseCommand observability (ADR-081).
 *
 * Two behaviours, both of which were missing and one of which was a live bug.
 *
 * 1. Every invocation emits a `cli.command` span on the same trace as its
 *    envelope, in **both** modes. Nothing recorded a command's own execution
 *    before this; the CLI could only be observed from outside.
 *
 * 2. `postrun` hooks actually run under `--json`. They did not: `run()` calls
 *    `process.exit()` once the envelope is written, and oclif fires `postrun`
 *    after the command returns — so the process was gone first. Measured
 *    against the real CLI with an unreachable daemon:
 *
 *      human mode  → postrun RAN (offline cache written)
 *      --json mode → postrun did NOT run
 *
 *    That silently disabled the daemon telemetry on the whole `--json` path,
 *    which is the MCP path (ADR-019 spawns `seans-mfe-tool <cmd> --json` per
 *    tool call) and the CI path — the traffic most worth observing.
 */

jest.mock('../json-output', () => ({
  suppressChalk: jest.fn(),
  redirectStdoutToStderr: jest.fn(),
  blockInteractivePrompts: jest.fn(),
  writeJsonLine: jest.fn(),
}));

import type { Config } from '@oclif/core';
import { ValidationError } from '@falese/smt-contracts';
import type { CommandResult, PlatformEvent } from '@falese/smt-contracts';
import { BaseCommand } from '../BaseCommand';
import { writeJsonLine } from '../json-output';

const writeMock = jest.mocked(writeJsonLine);

function fakeConfig(runHook?: jest.Mock): Config {
  return { runHook: runHook ?? jest.fn().mockResolvedValue({ successes: [], failures: [] }) } as
    unknown as Config;
}

class SuccessCmd extends BaseCommand<{ name: string }> {
  static id = 'demo:succeed';
  protected async runCommand() {
    return { name: 'test' };
  }
}

class FailCmd extends BaseCommand<never> {
  static id = 'demo:fail';
  protected async runCommand(): Promise<never> {
    throw new ValidationError('name is required', 'name', 'required');
  }
}

/** Capture stderr without touching console — the emitter writes there directly. */
function captureStderr(): { events: () => PlatformEvent[]; restore: () => void } {
  const original = process.stderr.write.bind(process.stderr);
  const chunks: string[] = [];
  (process.stderr as NodeJS.WriteStream).write = ((chunk: string | Uint8Array): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stderr.write;

  return {
    events: () =>
      chunks
        .join('')
        .split('\n')
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as PlatformEvent];
          } catch {
            return []; // non-event stderr output is not our business
          }
        }),
    restore: () => {
      (process.stderr as NodeJS.WriteStream).write = original;
    },
  };
}

describe('BaseCommand observability', () => {
  let stderr: ReturnType<typeof captureStderr>;
  const savedTraceparent = process.env['TRACEPARENT'];

  beforeEach(() => {
    delete process.env['TRACEPARENT'];
    writeMock.mockReset();
    writeMock.mockImplementation((_json: string, cb?: () => void) => cb?.());
    stderr = captureStderr();
  });

  afterEach(() => {
    stderr.restore();
    if (savedTraceparent === undefined) delete process.env['TRACEPARENT'];
    else process.env['TRACEPARENT'] = savedTraceparent;
  });

  async function runJson(Cmd: new (argv: string[], config: Config) => BaseCommand, config?: Config) {
    const cmd = new Cmd(['--json'], config ?? fakeConfig());
    try {
      await cmd.run();
    } catch {
      // the process.exit mock throws — expected
    }
    const [json] = (writeMock.mock.calls[0] ?? []) as [string];
    return json ? (JSON.parse(json) as CommandResult<unknown>) : undefined;
  }

  describe('the command span', () => {
    it('emits one under --json, on the envelope trace', async () => {
      const envelope = await runJson(SuccessCmd);

      const span = stderr.events().find((e) => e.name === 'cli.command');
      expect(span).toBeDefined();
      expect(span!.status).toBe('ok');
      expect(typeof span!.duration).toBe('number');
      expect(span!.traceId).toBe(envelope!.telemetry.traceId);
    });

    it('emits one in human mode too, where there is no envelope at all', async () => {
      const cmd = new SuccessCmd([], fakeConfig());
      await cmd.run();

      const span = stderr.events().find((e) => e.name === 'cli.command');
      expect(span).toBeDefined();
      expect(span!.status).toBe('ok');
    });

    it('names the command it ran', async () => {
      await runJson(SuccessCmd);
      const span = stderr.events().find((e) => e.name === 'cli.command')!;
      expect(span.attributes).toEqual(
        expect.objectContaining({ 'cli.command': 'demo:succeed', 'service.name': 'seans-mfe-tool' }),
      );
    });

    it('records a failure as an error span carrying the error type', async () => {
      await runJson(FailCmd);

      const span = stderr.events().find((e) => e.name === 'cli.command')!;
      expect(span.status).toBe('error');
      expect(span.statusMessage).toBe('name is required');
      expect(span.attributes).toEqual(expect.objectContaining({ 'error.type': 'validation' }));
    });

    it('still emits the envelope when the command fails', async () => {
      const envelope = await runJson(FailCmd);
      expect(envelope!.ok).toBe(false);
      expect(envelope!.telemetry.traceId).toBeDefined();
    });
  });

  describe('trace propagation to hooks and children', () => {
    it('publishes TRACEPARENT so postrun hooks and spawned processes share the trace', async () => {
      let seenDuringRun: string | undefined;
      const runHook = jest.fn().mockImplementation(async () => {
        seenDuringRun = process.env['TRACEPARENT'];
      });

      const envelope = await runJson(SuccessCmd, fakeConfig(runHook));

      expect(seenDuringRun).toBeDefined();
      expect(seenDuringRun).toContain(envelope!.telemetry.traceId!);
    });

    it('adopts an inherited TRACEPARENT rather than replacing it', async () => {
      process.env['TRACEPARENT'] = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

      const envelope = await runJson(SuccessCmd);

      expect(envelope!.telemetry.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    });
  });

  describe('postrun under --json (the bug)', () => {
    it('runs postrun hooks before exiting', async () => {
      const runHook = jest.fn().mockResolvedValue({ successes: [], failures: [] });

      await runJson(SuccessCmd, fakeConfig(runHook));

      expect(runHook).toHaveBeenCalledWith(
        'postrun',
        expect.objectContaining({ Command: SuccessCmd, argv: ['--json'] }),
      );
    });

    it('runs them on the failure path too', async () => {
      const runHook = jest.fn().mockResolvedValue({ successes: [], failures: [] });

      await runJson(FailCmd, fakeConfig(runHook));

      expect(runHook).toHaveBeenCalledWith('postrun', expect.objectContaining({ Command: FailCmd }));
    });

    it('passes the result through so a hook can see what the command produced', async () => {
      const runHook = jest.fn().mockResolvedValue({ successes: [], failures: [] });

      await runJson(SuccessCmd, fakeConfig(runHook));

      const [, options] = runHook.mock.calls[0] as [string, { result?: unknown }];
      expect(options.result).toEqual({ name: 'test' });
    });

    it('does not run them in human mode, where oclif runs them itself', async () => {
      const runHook = jest.fn().mockResolvedValue({ successes: [], failures: [] });

      await new SuccessCmd([], fakeConfig(runHook)).run();

      expect(runHook).not.toHaveBeenCalled();
    });

    it('never lets a broken hook take down the command', async () => {
      const runHook = jest.fn().mockRejectedValue(new Error('hook exploded'));

      const envelope = await runJson(SuccessCmd, fakeConfig(runHook));

      // The envelope is still written and still reports success.
      expect(envelope!.ok).toBe(true);
    });

    it('tolerates a config with no hook runner at all', async () => {
      const envelope = await runJson(SuccessCmd, {} as unknown as Config);
      expect(envelope!.ok).toBe(true);
    });
  });
});

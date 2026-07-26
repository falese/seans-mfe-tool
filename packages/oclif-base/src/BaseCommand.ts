import { Command, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';
import {
  formatSuccess,
  formatError,
  exitCodeFor,
  EXIT_CODES,
} from '@seans-mfe/contracts';
import {
  suppressChalk,
  redirectStdoutToStderr,
  blockInteractivePrompts,
  writeJsonLine,
} from './json-output';

export abstract class BaseCommand<T = unknown> extends Command {
  static baseFlags = {
    json: Flags.boolean({
      description: 'Format output as json.',
      default: false,
    }),
  };

  /** Commands push human-facing advisory messages here; envelope.warnings mirrors it. */
  protected warnings: string[] = [];

  protected abstract runCommand(): Promise<T>;

  /**
   * Orchestrates the JSON envelope lifecycle.
   *
   * JSON mode (--json):
   *   - Suppresses chalk and redirects stdout → stderr so the envelope is
   *     the only thing on stdout.
   *   - Blocks interactive prompts (throws SystemError instead of hanging).
   *   - Wraps runCommand() in try/catch; emits CommandResult<T> to stdout.
   *   - Calls process.exit with the correct sysexits code.
   *
   * Human mode (no --json):
   *   - Calls runCommand() unchanged.
   *   - Re-throws any error so oclif's default error handler takes over.
   */
  public async run(): Promise<void> {
    const jsonMode = this.argv.includes('--json');
    const startTime = Date.now();
    const correlationId = randomUUID();

    if (jsonMode) {
      suppressChalk();
      redirectStdoutToStderr();
      blockInteractivePrompts();
    }

    try {
      const result = await this.runCommand();

      if (jsonMode) {
        const envelope = formatSuccess(result as T, this.warnings, {
          durationMs: Date.now() - startTime,
          correlationId,
        });
        await new Promise<void>((resolve) => writeJsonLine(JSON.stringify(envelope), resolve));
        // The --json envelope contract (ADR-018) requires a specific sysexits
        // code; oclif's default error handler would pick its own. This is the
        // one place responsible for that translation.
        // eslint-disable-next-line no-process-exit
        process.exit(EXIT_CODES.ok);
      }
    } catch (err) {
      if (jsonMode) {
        const envelope = formatError(err, correlationId, startTime);
        await new Promise<void>((resolve) => writeJsonLine(JSON.stringify(envelope), resolve));
        // eslint-disable-next-line no-process-exit -- same envelope exit-code contract as above
        process.exit(exitCodeFor(envelope.error?.type ?? 'unknown'));
      }
      throw err;
    }
  }
}

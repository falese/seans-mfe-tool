import { Command, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';
import {
  formatSuccess,
  formatError,
  exitCodeFor,
  classifyError,
  EXIT_CODES,
} from '@seans-mfe/contracts';
import type { CommandResult } from '@seans-mfe/contracts';
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
    // allowNo gives oclif's `--no-interactive` for free. This is the agent
    // profile switch named by ADR-077; it is deliberately separable from
    // --json so a caller can have human-readable stderr AND a guarantee that
    // nothing will block on a prompt.
    interactive: Flags.boolean({
      description: 'Allow interactive prompts. Use --no-interactive to fail instead of prompting.',
      default: true,
      allowNo: true,
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
   *   - Re-throws any error so oclif's default error handler renders it, but
   *     stamps the sysexits code onto err.oclif.exit first so the failure
   *     class is still branchable (ADR-077). oclif's handle() reads
   *     err.oclif?.exit ?? 1.
   *
   * --no-interactive is honoured in both modes.
   */
  public async run(): Promise<void> {
    const jsonMode = this.argv.some((a) => a === '--json' || a.startsWith('--json='));
    const nonInteractive = jsonMode || this.argv.includes('--no-interactive');
    const startTime = Date.now();
    const correlationId = randomUUID();

    if (jsonMode) {
      suppressChalk();
      redirectStdoutToStderr();
    }
    if (nonInteractive) {
      blockInteractivePrompts();
    }

    // Exactly one envelope reaches stdout, so the writes below sit OUTSIDE the
    // try. Emitting the success envelope inside it meant any throw from the
    // write or from process.exit fell into the catch, which emitted a second
    // envelope — breaking the one-line contract this class exists to keep.
    let outcome: { envelope: CommandResult<T | never>; exit: number };

    try {
      const result = await this.runCommand();
      if (!jsonMode) return;
      outcome = {
        envelope: formatSuccess(result as T, this.warnings, {
          durationMs: Date.now() - startTime,
          correlationId,
        }),
        exit: EXIT_CODES.ok,
      };
    } catch (err) {
      if (!jsonMode) throw this.withTypedExitCode(err);
      const envelope = formatError(err, correlationId, startTime);
      outcome = { envelope, exit: exitCodeFor(envelope.error?.type ?? 'unknown') };
    }

    await new Promise<void>((resolve) =>
      writeJsonLine(JSON.stringify(outcome.envelope), resolve),
    );
    // The --json envelope contract (ADR-018) requires a specific sysexits code;
    // oclif's default handler would pick its own. This is the one place
    // responsible for that translation.
    // eslint-disable-next-line no-process-exit
    process.exit(outcome.exit);
  }

  /**
   * Stamp the sysexits code for a typed error onto `err.oclif.exit` so oclif's
   * handler exits with it instead of a flat 1, while still printing the error
   * normally.
   *
   * Two deliberate non-actions:
   *   - An error that already carries an exit code (oclif's own CLIErrors —
   *     usage errors, parse failures) is left alone; it knows better than we do.
   *   - An error we cannot classify is left alone rather than being given the
   *     `unknown` code. Inventing 70 for every stray Error would relabel plain
   *     crashes as a typed failure class, which is the opposite of what the
   *     branchable-error contract is for.
   */
  private withTypedExitCode(err: unknown): unknown {
    if (!(err instanceof Error)) return err;

    const e = err as Error & { oclif?: { exit: number } };
    if (e.oclif?.exit !== undefined) return e;

    const { type } = classifyError(e, { types: [] });
    if (type === 'unknown') return e;

    e.oclif = { ...e.oclif, exit: exitCodeFor(type) };
    return e;
  }
}

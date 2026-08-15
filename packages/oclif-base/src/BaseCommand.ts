import { Command, Flags } from '@oclif/core';
import { randomUUID } from 'crypto';
import {
  formatSuccess,
  formatError,
  exitCodeFor,
  classifyError,
  EXIT_CODES,
} from '@falese/smt-contracts';
import { traceContextFromEnv, formatTraceparent } from '@falese/smt-contracts';
import type { CommandResult, TraceContext } from '@falese/smt-contracts';
import { createLogger, type Logger } from './logger';
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

  /**
   * The shared `--dry-run` ADR-016 called for, for commands that mutate.
   *
   * Opt-in rather than part of `baseFlags`, because a dry run means nothing on
   * `mfe:validate` or `adr:status` — a flag offered where it does nothing is
   * its own kind of lie. Mutating commands spread it:
   *
   *   static flags = { ...BaseCommand.baseFlags, ...BaseCommand.mutatingFlags, … }
   *
   * Deliberately no `char`. Six commands used to declare this by hand and the
   * copies had already drifted: `-D` on api/deploy, `-d` on the four remote:*
   * commands — while `-d` on api is `--database`, which takes a value. Someone
   * who learned `-d` meant "preview, don't write" and typed it on `api` did not
   * get a dry run; the flag ate the next token and the command ran for real.
   * Any single choice of char breaks one group or the other, and a short form
   * that means "preview" on one mutating command and "here comes a value" on
   * another is the hazard itself. `--dry-run` is short enough to type in full.
   */
  static mutatingFlags = {
    'dry-run': Flags.boolean({
      description: 'Preview changes without writing them',
      default: false,
    }),
  };

  /** Commands push human-facing advisory messages here; envelope.warnings mirrors it. */
  protected warnings: string[] = [];

  /**
   * The trace this invocation belongs to (ADR-081). Adopted from `TRACEPARENT`
   * when a caller set one — so a command run by CI, or an MCP child process
   * (ADR-019), is a child of whatever spawned it — and minted fresh otherwise.
   */
  protected readonly trace: TraceContext = traceContextFromEnv(process.env);

  /**
   * Structured emitter for this command, on this command's trace.
   *
   * For platform events, not for the human-readable rendering a command does:
   * `this.log()` remains the right call for that (ADR-081 §5).
   */
  protected readonly logger: Logger = createLogger({
    context: this.trace,
    attributes: { 'service.name': 'seans-mfe-tool' },
  });

  /**
   * The `traceparent` a child process should inherit. Spread into a spawn's
   * env — `{ ...process.env, ...this.childTraceEnv() }` — so work done in
   * `mesh build` or `npm install` stays attributable to this command.
   */
  protected childTraceEnv(): { TRACEPARENT: string } {
    return { TRACEPARENT: formatTraceparent(this.trace) };
  }

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

    // Publish the trace so `postrun` hooks — which receive only Command and
    // argv, no instance — and any spawned child land on it (ADR-081).
    process.env['TRACEPARENT'] = formatTraceparent(this.trace);

    // Exactly one envelope reaches stdout, so the writes below sit OUTSIDE the
    // try. Emitting the success envelope inside it meant any throw from the
    // write or from process.exit fell into the catch, which emitted a second
    // envelope — breaking the one-line contract this class exists to keep.
    let outcome: { envelope: CommandResult<T | never>; exit: number };
    let result: T | undefined;

    try {
      // The span covers runCommand only. Envelope serialisation and exit are
      // this class's own bookkeeping, not the command's work.
      result = await this.logger.span('cli.command', () => this.runCommand(), {
        'cli.command': this.commandId(),
      });
      if (!jsonMode) return;
      outcome = {
        envelope: formatSuccess(result as T, this.warnings, {
          durationMs: Date.now() - startTime,
          correlationId,
          traceId: this.trace.traceId,
        }),
        exit: EXIT_CODES.ok,
      };
    } catch (err) {
      if (!jsonMode) throw this.withTypedExitCode(err);
      const envelope = formatError(err, correlationId, startTime, this.trace.traceId);
      outcome = { envelope, exit: exitCodeFor(envelope.error?.type ?? 'unknown') };
    }

    await new Promise<void>((resolve) =>
      writeJsonLine(JSON.stringify(outcome.envelope), resolve),
    );

    // oclif fires postrun after the command returns — but the exit below means
    // we never return, so under --json the hooks simply never ran. That
    // silently disabled them on the MCP path (ADR-019 spawns each tool call as
    // `<cmd> --json`) and in CI. Run them here instead; human mode still
    // returns normally and lets oclif do it, so they fire exactly once either
    // way.
    await this.runPostrunHooks(result);

    // The --json envelope contract (ADR-018) requires a specific sysexits code;
    // oclif's default handler would pick its own. This is the one place
    // responsible for that translation.
    // eslint-disable-next-line no-process-exit
    process.exit(outcome.exit);
  }

  /** This command's oclif id, falling back to the class name for ad-hoc subclasses. */
  private commandId(): string {
    return (this.constructor as { id?: string }).id ?? this.constructor.name;
  }

  /**
   * Fire `postrun` for the --json path.
   *
   * Swallows everything: a hook exists to observe the command, and an observer
   * that can fail the thing it observes is worse than no observer. `config` is
   * duck-typed because tests construct commands with a bare object.
   */
  private async runPostrunHooks(result: T | undefined): Promise<void> {
    const config = this.config as unknown as
      | { runHook?: (event: string, opts: Record<string, unknown>) => Promise<unknown> }
      | undefined;
    if (typeof config?.runHook !== 'function') return;

    try {
      await config.runHook('postrun', {
        Command: this.constructor as unknown as Command.Class,
        argv: this.argv,
        ...(result !== undefined ? { result } : {}),
      });
    } catch {
      // Never fail a command because its telemetry failed.
    }
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

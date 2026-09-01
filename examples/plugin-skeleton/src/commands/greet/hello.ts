/**
 * The smallest command that satisfies docs/PLUGIN-CONTRACT.md.
 *
 * Copy this file's SHAPE, not its behaviour. Four rules carry over to every
 * command you write, and each exists because breaking it breaks a machine
 * consumer rather than a human one:
 *
 *   1. Extend `BaseCommand<T>` and implement `runCommand()`. Never override
 *      `run()` — `run()` is what emits the envelope, maps typed errors to exit
 *      codes and starts the telemetry span (ADR-016).
 *   2. Return a typed result. Under `--json` it becomes exactly one
 *      `CommandResult<T>` line on stdout (ADR-018); anything you print goes to
 *      stderr so it can never corrupt that line.
 *   3. Throw typed errors from `@seans-mfe/contracts` — never `throw new
 *      Error()`. The error class decides the exit code, and an agent branches
 *      on it (ADR-017).
 *   4. Do not call `process.exit()`. It skips the envelope entirely.
 */

import { Flags } from '@oclif/core';
import { BaseCommand } from '@seans-mfe/oclif-base';
import { ValidationError } from '@seans-mfe/contracts';

/**
 * The command's typed result. Declaring it is what lets the CLI derive this
 * command's JSON Schema from the implementation instead of hand-writing one
 * that drifts.
 */
export interface GreetHelloResult {
  greeting: string;
  target: string;
}

export default class GreetHello extends BaseCommand<GreetHelloResult> {
  static description = 'Greet a target — the starter plugin\'s example command.';

  static examples = [
    '<%= config.bin %> greet:hello --name world',
    '<%= config.bin %> greet:hello --name world --json',
  ];

  static flags = {
    name: Flags.string({
      description: 'Who to greet.',
      required: true,
    }),
  };

  protected async runCommand(): Promise<GreetHelloResult> {
    const { flags } = await this.parse(GreetHello);

    // `required: true` makes oclif reject a missing --name before we get here,
    // but it still types as `string | undefined`. Narrow it rather than
    // asserting with `!`: the repo forbids `any` and discourages assertions,
    // and the narrowing is where the typed error belongs anyway.
    const name = flags.name?.trim();
    if (!name) {
      // Typed, so the caller gets a validation exit code rather than exit 1.
      throw new ValidationError('--name must not be empty', 'name', 'required');
    }

    // Human-facing output. Under --json this is redirected to stderr, which is
    // why it cannot break the single-line envelope contract.
    this.log(`Hello, ${name}!`);

    return { greeting: 'Hello', target: name };
  }
}

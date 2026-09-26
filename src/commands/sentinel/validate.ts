/**
 * sentinel:validate — run the Sentinel kernel over an MFE through SMT's ports
 * (PDR-010, ADR-089, #384).
 *
 * The kernel's four ports were proven against SMT's machinery (n1-proof.test.ts)
 * but nothing on a production path ran them. This command does: it locates the
 * manifest, validates it, materializes it to learn ownership, and runs every
 * HardenedCheck through the kernel's own `verify`. It is the kernel-shaped twin
 * of mfe:validate's migration rule, and what a second host's command would look
 * like with its own adapters in place of `smtPorts`.
 *
 * The orchestration lives in `src/sentinel/validate.ts`; this is the I/O shell.
 */

import { Args } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { sentinelValidate } from '../../sentinel/validate';
import type { SentinelValidateResult } from '../../oclif/results';

export default class SentinelValidate extends BaseCommand<SentinelValidateResult> {
  static description =
    'Run the Sentinel governance kernel over an MFE through SMT\'s port adapters (ADR-089): locate ' +
    'the manifest, validate it, materialize it to learn which files the generator owns, and run every ' +
    'hardened check over the developer-owned rest. Exits non-zero on an invalid manifest; check hits ' +
    'are reported with a file, line and fix but do not fail the run. Read-only.';

  static args = {
    dir: Args.string({
      description: 'Directory holding the artifact (default: current directory)',
      required: false,
    }),
  };

  static examples = [
    '$ seans-mfe-tool sentinel:validate',
    '$ seans-mfe-tool sentinel:validate ./examples/abc-kids/flappy',
    '$ seans-mfe-tool sentinel:validate ./examples/abc-kids/flappy --json',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
  };

  protected async runCommand(): Promise<SentinelValidateResult> {
    const { args } = await this.parse(SentinelValidate);
    const result = await sentinelValidate(args.dir ?? process.cwd());

    console.log(chalk.blue(`\nSentinel: ${result.artifacts.map((a) => a.path).join(', ')}\n`));
    console.log(`  ${chalk.green('✓')} validate`);
    console.log(
      `  ${result.hits.length === 0 ? chalk.green('✓') : chalk.yellow('⚠')} ` +
        `${result.checks} hardened check(s) over ${result.scanned} developer-owned file(s)`,
    );
    for (const hit of result.hits) {
      console.log(chalk.yellow(`      - [${hit.check}] ${hit.message}`) + ` ${chalk.gray(hit.location)}`);
      console.log(chalk.gray(`        fix: ${hit.fix}`));
      // Mirror into the envelope (ADR-018) so an agent sees it without parsing stdout.
      this.warnings.push(`${hit.location}: [${hit.check}] ${hit.message} — ${hit.fix}`);
    }
    console.log('');

    return result;
  }
}

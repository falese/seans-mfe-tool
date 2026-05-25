import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { remoteInitCommand } from './init';
import type { RemoteInitResult } from '../../oclif/results';

/**
 * Deprecated — use `remote:init --framework angular` instead.
 *
 * This command delegates to the unified remoteInitCommand with
 * framework='angular'. It will be removed in a future release.
 */
export default class RemoteInitAngular extends BaseCommand<RemoteInitResult> {
  static description = '[DEPRECATED] Initialize an Angular remote MFE. Use remote:init --framework angular instead.'

  static examples = [
    '$ seans-mfe-tool remote:init --framework angular my-feature  # preferred',
    '$ seans-mfe-tool remote:init-angular my-feature              # deprecated',
  ]

  static args = {
    name: Args.string({ description: 'Remote MFE name', required: true }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    port: Flags.string({
      char: 'p',
      description: 'Port number for the remote MFE',
    }),
    template: Flags.string({
      char: 't',
      description: 'Path to DSL template file',
    }),
    'skip-install': Flags.boolean({
      description: 'Skip npm install',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing files',
      default: false,
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Preview changes without writing',
      default: false,
    }),
  }

  protected async runCommand(): Promise<RemoteInitResult> {
    const { args, flags } = await this.parse(RemoteInitAngular);

    console.error(
      chalk.yellow(
        '⚠ remote:init-angular is deprecated. Use: remote:init --framework angular',
      ),
    );

    return remoteInitCommand(args.name, {
      port: flags.port ? parseInt(flags.port, 10) : undefined,
      template: flags.template,
      skipInstall: flags['skip-install'],
      force: flags.force,
      dryRun: flags['dry-run'],
      framework: 'angular',
    });
  }
}

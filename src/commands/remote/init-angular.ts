import { Args, Flags } from '@oclif/core';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import { createMinimalManifest, writeManifest, generateEndpoints } from '../../dsl/parser';
import { BaseCommand } from '../../oclif/BaseCommand';
import { BusinessError, SystemError } from '@seans-mfe/contracts';
import type { RemoteInitResult, PlannedChange } from '../../oclif/results';
import type { RemoteInitOptions, DSLManifest } from '../../dsl/schema';

/**
 * Scaffold the manifest for an Angular + webpack remote MFE.
 *
 * Parallel to remoteInitCommand (React + rspack). Writes mfe-manifest.yaml
 * tagged with framework: 'angular' + bundler: 'webpack' so that the
 * downstream `remote:generate` command picks the angular-webpack codegen
 * variant in UnifiedGenerator.
 */
export async function remoteInitAngularCommand(
  name: string,
  options: RemoteInitOptions & { dryRun?: boolean } = {}
): Promise<RemoteInitResult> {
  const port = options.port || 3101;
  const targetDir = path.resolve(process.cwd(), name);
  const generatedFiles: string[] = [];
  const plannedChanges: PlannedChange[] = [];

  try {
    console.log(chalk.blue(`\nCreating DSL-based Angular + webpack remote MFE: ${name}`));
    console.log(chalk.gray(`Target directory: ${targetDir}`));

    if (await fs.pathExists(targetDir)) {
      if (!options.force) {
        throw new BusinessError(
          `Directory "${name}" already exists. Use --force to overwrite.`,
          'DIR_EXISTS',
          { name, targetDir },
        );
      }
      console.log(chalk.yellow(`⚠ Overwriting existing directory`));
    }

    const manifestFile = path.join(targetDir, 'mfe-manifest.yaml');
    const dirs = [
      targetDir,
      path.join(targetDir, 'src'),
      path.join(targetDir, 'src', 'features'),
      path.join(targetDir, 'src', 'app'),
      path.join(targetDir, 'public'),
    ];

    if (options.dryRun) {
      for (const d of dirs) {
        plannedChanges.push({ op: 'create', target: path.relative(process.cwd(), d), detail: 'directory' });
      }
      plannedChanges.push({ op: 'create', target: path.relative(process.cwd(), manifestFile) });
      console.log(chalk.yellow('\n[DRY RUN] Would create:'));
      for (const c of plannedChanges) {
        console.log(`  ${c.op} ${c.target}${c.detail ? ` (${c.detail})` : ''}`);
      }
      return { name, port, targetDir, generatedFiles: [], dryRun: true, plannedChanges };
    }

    console.log(chalk.blue('\nCreating project structure...'));
    for (const d of dirs.slice(1)) {
      try {
        await fs.ensureDir(d);
      } catch (err) {
        throw new SystemError(`Failed to create directory: ${d}`, err as Error);
      }
    }

    console.log(chalk.blue('Generating mfe-manifest.yaml...'));
    const manifest = createMinimalManifest(name, {
      type: 'remote',
      language: 'typescript',
      framework: 'angular',
      bundler: 'webpack',
    });
    const endpoints = generateEndpoints(name, port);
    const fullManifest: DSLManifest = { ...manifest, ...endpoints };
    await writeManifest(fullManifest, manifestFile);
    generatedFiles.push(path.relative(process.cwd(), manifestFile));
    console.log(chalk.green('✓ mfe-manifest.yaml'));

    console.log(chalk.green('\n✓ Angular remote MFE manifest created!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. ${chalk.cyan(`cd ${name}`)}`);
    console.log(`  2. Edit ${chalk.cyan('mfe-manifest.yaml')} to add capabilities`);
    console.log(`  3. Run ${chalk.cyan('seans-mfe-tool remote:generate')} to scaffold the project`);
    console.log(`  4. Run ${chalk.cyan('npm install && npm run dev')} to start development`);
    console.log(`\nRemote will be available at: ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log(`remoteEntry.js: ${chalk.cyan(`http://localhost:${port}/remoteEntry.js`)}`);

    return { name, port, targetDir, generatedFiles, dryRun: false };

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create Angular remote MFE:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class RemoteInitAngular extends BaseCommand<RemoteInitResult> {
  static description = 'Initialize a new DSL-first Angular + webpack remote MFE project'

  static examples = [
    '$ seans-mfe-tool remote:init-angular my-feature',
    '$ seans-mfe-tool remote:init-angular my-feature --port 3105',
    '$ seans-mfe-tool remote:init-angular my-feature --dry-run',
  ]

  static args = {
    name: Args.string({ description: 'Remote MFE name', required: true }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    port: Flags.string({
      char: 'p',
      description: 'Port number for the remote MFE',
      default: '3101',
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
    const { args, flags } = await this.parse(RemoteInitAngular)
    return remoteInitAngularCommand(args.name, {
      port: flags.port ? parseInt(flags.port, 10) : 3101,
      template: flags.template,
      skipInstall: flags['skip-install'],
      force: flags.force,
      dryRun: flags['dry-run'],
    })
  }
}

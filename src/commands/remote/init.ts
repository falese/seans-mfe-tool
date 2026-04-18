import { Args, Flags } from '@oclif/core';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import { execSync } from 'child_process';
import { createMinimalManifest, writeManifest, generateEndpoints } from '../../dsl/parser';
import { processTemplates } from '../../utils/templateProcessor';
import { BaseCommand } from '../../oclif/BaseCommand';
import type { RemoteInitOptions, DSLManifest } from '../../dsl/schema';

export async function remoteInitCommand(
  name: string,
  options: RemoteInitOptions = {}
): Promise<void> {
  const port = options.port || 3001;
  const targetDir = path.resolve(process.cwd(), name);

  try {
    console.log(chalk.blue(`\nCreating DSL-based remote MFE: ${name}`));
    console.log(chalk.gray(`Target directory: ${targetDir}`));

    if (await fs.pathExists(targetDir)) {
      if (!options.force) {
        throw new Error(`Directory "${name}" already exists. Use --force to overwrite.`);
      }
      console.log(chalk.yellow(`⚠ Overwriting existing directory`));
    }

    console.log(chalk.blue('\nCreating project structure...'));
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'features'));
    await fs.ensureDir(path.join(targetDir, 'public'));

    console.log(chalk.blue('Generating mfe-manifest.yaml...'));
    const manifest = createMinimalManifest(name, { type: 'remote', language: 'typescript' });
    const endpoints = generateEndpoints(name, port);
    const fullManifest: DSLManifest = { ...manifest, ...endpoints };
    await writeManifest(fullManifest, path.join(targetDir, 'mfe-manifest.yaml'));
    console.log(chalk.green('✓ mfe-manifest.yaml'));

    console.log(chalk.green('\n✓ Remote MFE manifest created!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. ${chalk.cyan(`cd ${name}`)}`);
    console.log(`  2. Edit ${chalk.cyan('mfe-manifest.yaml')} to add capabilities`);
    console.log(`  3. Run ${chalk.cyan('mfe remote:generate')} to scaffold features and platform files`);
    console.log(`  4. Run ${chalk.cyan('npm run dev')} to start development`);
    console.log(`\nRemote will be available at: ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log(`remoteEntry.js: ${chalk.cyan(`http://localhost:${port}/remoteEntry.js`)}`);

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create remote MFE:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class RemoteInit extends BaseCommand<void> {
  static description = 'Initialize a new DSL-first remote MFE project'

  static examples = [
    '$ seans-mfe-tool remote:init my-feature',
    '$ seans-mfe-tool remote:init my-feature --port 3005',
    '$ seans-mfe-tool remote:init my-feature --template ./custom-dsl.yaml',
  ]

  static args = {
    name: Args.string({ description: 'Remote MFE name', required: true }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    port: Flags.string({
      char: 'p',
      description: 'Port number for the remote MFE',
      default: '3001',
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
  }

  protected async runCommand(): Promise<void> {
    const { args, flags } = await this.parse(RemoteInit)
    await remoteInitCommand(args.name, {
      port: flags.port ? parseInt(flags.port, 10) : 3001,
      template: flags.template,
      skipInstall: flags['skip-install'],
      force: flags.force,
    })
  }
}

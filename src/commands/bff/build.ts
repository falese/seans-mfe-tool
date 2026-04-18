import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { execSync } from 'child_process';
import * as path from 'path';
import { BaseCommand } from '../../oclif/BaseCommand';
import { writeMeshConfig } from './_shared';
import { bffValidateCommand } from './validate';
import type { BFFCommandOptions } from './_shared';

export async function bffBuildCommand(options: BFFCommandOptions = {}): Promise<void> {
  try {
    console.log(chalk.blue('Building BFF...'));

    const { meshConfig } = await bffValidateCommand(options);
    const targetDir = options.cwd || process.cwd();

    console.log(chalk.blue('\nExtracting Mesh configuration...'));
    await writeMeshConfig(meshConfig, targetDir);

    console.log(chalk.blue('\nRunning mesh build...'));

    try {
      execSync('npx mesh build', { cwd: targetDir, stdio: 'inherit', env: { ...process.env } });
    } catch (meshError) {
      if ((meshError as Error).message.includes('mesh') || (meshError as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(chalk.yellow('\nGraphQL Mesh CLI not found. Installing...'));
        execSync('npm install @graphql-mesh/cli @graphql-mesh/openapi', { cwd: targetDir, stdio: 'inherit' });
        execSync('npx mesh build', { cwd: targetDir, stdio: 'inherit' });
      } else {
        throw meshError;
      }
    }

    console.log(chalk.green('\n✓ BFF build complete'));
    console.log(chalk.blue('\nGenerated artifacts:'));
    console.log('  .meshrc.yaml    - Mesh configuration');
    console.log('  .mesh/          - Generated Mesh runtime');

  } catch (error) {
    console.error(chalk.red('\n✗ BFF build failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class BffBuild extends BaseCommand<void> {
  static description = 'Build BFF artifacts from mfe-manifest.yaml'

  static examples = [
    'This command:\n  1. Reads the data: section from mfe-manifest.yaml\n  2. Extracts Mesh configuration to .meshrc.yaml\n  3. Runs \'mesh build\' to generate GraphQL runtime\n\nFollowing REQ-BFF-001: DSL Data Section as Mesh Configuration',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to mfe-manifest.yaml',
      default: 'mfe-manifest.yaml',
    }),
  }

  protected async runCommand(): Promise<void> {
    const { flags } = await this.parse(BffBuild)
    await bffBuildCommand({ manifest: flags.manifest })
  }
}

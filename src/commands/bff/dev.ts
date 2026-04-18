import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { spawn, ChildProcess } from 'child_process';
import { BaseCommand } from '../../oclif/BaseCommand';
import { writeMeshConfig } from './_shared';
import { bffValidateCommand } from './validate';
import type { BFFCommandOptions } from './_shared';

export async function bffDevCommand(options: BFFCommandOptions = {}): Promise<void> {
  try {
    console.log(chalk.blue('Starting BFF development server...'));

    const { meshConfig } = await bffValidateCommand(options);
    const targetDir = options.cwd || process.cwd();

    await writeMeshConfig(meshConfig, targetDir);

    console.log(chalk.blue('\nStarting mesh dev...'));

    const meshDev: ChildProcess = spawn('npx', ['mesh', 'dev'], {
      cwd: targetDir,
      stdio: 'inherit',
      shell: true
    });

    meshDev.on('error', (error: Error) => {
      console.error(chalk.red('Failed to start mesh dev:'), error.message);
    });

    meshDev.on('close', (code: number | null) => {
      if (code !== 0) {
        console.log(chalk.yellow(`mesh dev exited with code ${code}`));
      }
    });

    process.on('SIGINT', () => { meshDev.kill('SIGINT'); });

  } catch (error) {
    console.error(chalk.red('\n✗ BFF dev failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class BffDev extends BaseCommand<void> {
  static description = 'Start BFF development server with hot reload'

  static examples = [
    'Starts GraphQL Mesh in development mode with hot reload.\nChanges to mfe-manifest.yaml data: section will be reflected immediately.',
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
    const { flags } = await this.parse(BffDev)
    await bffDevCommand({ manifest: flags.manifest })
  }
}

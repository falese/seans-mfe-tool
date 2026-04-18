import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { spawn } from 'child_process';
import { BaseCommand } from '../../oclif/BaseCommand';
import { writeMeshConfig } from './_shared';
import { bffValidateCommand } from './validate';
import type { BFFCommandOptions } from './_shared';
import type { BffDevResult } from '../../oclif/results';

export async function bffDevCommand(options: BFFCommandOptions = {}): Promise<BffDevResult> {
  try {
    console.log(chalk.blue('Starting BFF development server...'));

    const { meshConfig } = await bffValidateCommand(options);
    const targetDir = options.cwd || process.cwd();
    const meshConfigPath = `${targetDir}/.meshrc.yaml`;

    await writeMeshConfig(meshConfig, targetDir);

    console.log(chalk.blue('\nStarting mesh dev...'));

    const meshDev = spawn('npx', ['mesh', 'dev'], {
      cwd: targetDir,
      stdio: 'inherit',
      shell: true,
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

    return { port: options.port || 4000, meshConfigPath };

  } catch (error) {
    console.error(chalk.red('\n✗ BFF dev failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class BffDev extends BaseCommand<BffDevResult> {
  static description = 'Start BFF development server with hot reload'

  static flags = {
    ...BaseCommand.baseFlags,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to mfe-manifest.yaml',
      default: 'mfe-manifest.yaml',
    }),
  }

  protected async runCommand(): Promise<BffDevResult> {
    const { flags } = await this.parse(BffDev)
    return bffDevCommand({ manifest: flags.manifest })
  }
}

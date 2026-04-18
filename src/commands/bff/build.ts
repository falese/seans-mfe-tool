import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { execSync } from 'child_process';
import { BaseCommand } from '../../oclif/BaseCommand';
import { SystemError, NetworkError } from '../../runtime/errors';
import { writeMeshConfig } from './_shared';
import { bffValidateCommand } from './validate';
import type { BFFCommandOptions } from './_shared';
import type { BffBuildResult, PlannedChange } from '../../oclif/results';

export async function bffBuildCommand(options: BFFCommandOptions & { dryRun?: boolean } = {}): Promise<BffBuildResult> {
  try {
    console.log(chalk.blue('Building BFF...'));

    const { meshConfig } = await bffValidateCommand(options);
    const targetDir = options.cwd || process.cwd();
    const meshConfigPath = `${targetDir}/.meshrc.yaml`;

    if (options.dryRun) {
      const plannedChanges: PlannedChange[] = [
        { op: 'create', target: '.meshrc.yaml', detail: 'GraphQL Mesh configuration' },
        { op: 'spawn', target: 'npx mesh build', detail: 'generate .mesh/ runtime artifacts' },
      ];
      console.log(chalk.yellow('\n[DRY RUN] Would:'));
      for (const c of plannedChanges) {
        console.log(`  ${c.op} ${c.target}${c.detail ? ` — ${c.detail}` : ''}`);
      }
      return { meshConfigPath, generatedFiles: [], dryRun: true, plannedChanges };
    }

    console.log(chalk.blue('\nExtracting Mesh configuration...'));
    await writeMeshConfig(meshConfig, targetDir);

    console.log(chalk.blue('\nRunning mesh build...'));

    try {
      execSync('npx mesh build', { cwd: targetDir, stdio: 'inherit', env: { ...process.env } });
    } catch (meshError: any) {
      if (meshError.message?.includes('mesh') || meshError.code === 'ENOENT') {
        console.log(chalk.yellow('\nGraphQL Mesh CLI not found. Installing...'));
        try {
          execSync('npm install @graphql-mesh/cli @graphql-mesh/openapi', { cwd: targetDir, stdio: 'inherit' });
          execSync('npx mesh build', { cwd: targetDir, stdio: 'inherit' });
        } catch (installErr) {
          throw new NetworkError('Failed to install or run @graphql-mesh/cli', 1);
        }
      } else {
        throw new SystemError('mesh build failed', meshError);
      }
    }

    console.log(chalk.green('\n✓ BFF build complete'));
    console.log(chalk.blue('\nGenerated artifacts:'));
    console.log('  .meshrc.yaml    - Mesh configuration');
    console.log('  .mesh/          - Generated Mesh runtime');

    return { meshConfigPath, generatedFiles: ['.meshrc.yaml', '.mesh/'], dryRun: false };

  } catch (error) {
    console.error(chalk.red('\n✗ BFF build failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class BffBuild extends BaseCommand<BffBuildResult> {
  static description = 'Build BFF artifacts from mfe-manifest.yaml'

  static flags = {
    ...BaseCommand.baseFlags,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to mfe-manifest.yaml',
      default: 'mfe-manifest.yaml',
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Preview what would be built without executing',
      default: false,
    }),
  }

  protected async runCommand(): Promise<BffBuildResult> {
    const { flags } = await this.parse(BffBuild)
    return bffBuildCommand({ manifest: flags.manifest, dryRun: flags['dry-run'] })
  }
}

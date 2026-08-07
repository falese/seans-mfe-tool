import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { execSync } from 'child_process';
import { BaseCommand } from '@falese/smt-oclif-base';
import { NetworkError, childStdio } from '@falese/smt-contracts';
import { writeMeshConfig, ensureMockSwitchFiles } from '../../shared';
import { bffValidateCommand } from './validate';
import type { BFFCommandOptions } from '../../shared';
import type { BffBuildResult, PlannedChange } from '../../types';

export async function bffBuildCommand(
  options: BFFCommandOptions & { dryRun?: boolean } = {}
): Promise<BffBuildResult> {
  try {
    console.log(chalk.blue('Building BFF...'));

    const { meshConfig, manifest } = await bffValidateCommand(options);
    const targetDir = options.cwd || process.cwd();
    const meshConfigPath = `${targetDir}/.meshrc.yaml`;
    const mockSwitchEnabled = !!manifest.data?.mockSwitch?.enabled;

    if (options.dryRun) {
      const plannedChanges: PlannedChange[] = [
        { op: 'create', target: '.meshrc.yaml', detail: 'GraphQL Mesh configuration' },
        ...(mockSwitchEnabled
          ? [
              {
                op: 'create' as const,
                target: 'mock-switch.js',
                detail: 'demo-mode composer (ADR-052)',
              },
              {
                op: 'create' as const,
                target: 'mocks.json',
                detail: 'demo-mode fixtures — kept if already present',
              },
            ]
          : []),
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

    // Before `mesh build`, never after: the config now names a composer, and
    // Mesh resolves that reference at build time (ADR-052, #199).
    const demoModeFiles = mockSwitchEnabled ? await ensureMockSwitchFiles(targetDir) : [];

    console.log(chalk.blue('\nRunning mesh build...'));

    try {
      execSync('npx mesh build', { cwd: targetDir, stdio: childStdio(), env: { ...process.env } });
    } catch (meshError: unknown) {
      const err = meshError as { message?: string; code?: string };
      if (err.message?.includes('mesh') || err.code === 'ENOENT') {
        console.log(chalk.yellow('\nGraphQL Mesh CLI not found. Installing...'));
        try {
          execSync('npm install @graphql-mesh/cli @graphql-mesh/openapi', {
            cwd: targetDir,
            stdio: childStdio(),
          });
          execSync('npx mesh build', { cwd: targetDir, stdio: childStdio() });
        } catch (installErr: unknown) {
          const detail = installErr instanceof Error ? installErr.message : String(installErr);
          throw new NetworkError(`Failed to install or run @graphql-mesh/cli: ${detail}`, 1);
        }
      } else {
        throw meshError;
      }
    }

    console.log(chalk.green('\n✓ BFF build complete'));
    console.log(chalk.blue('\nGenerated artifacts:'));
    console.log('  .meshrc.yaml    - Mesh configuration');
    console.log('  .mesh/          - Generated Mesh runtime');

    return {
      meshConfigPath,
      generatedFiles: ['.meshrc.yaml', '.mesh/', ...demoModeFiles],
      dryRun: false,
    };
  } catch (error) {
    console.error(chalk.red('\n✗ BFF build failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class BffBuild extends BaseCommand<BffBuildResult> {
  static description = 'Build BFF artifacts from mfe-manifest.yaml';

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
  };

  protected async runCommand(): Promise<BffBuildResult> {
    const { flags } = await this.parse(BffBuild);
    return bffBuildCommand({ manifest: flags.manifest, dryRun: flags['dry-run'] });
  }
}

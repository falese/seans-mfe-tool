import { Args, Flags } from '@oclif/core';
import * as path from 'path';
import chalk = require('chalk');
import { parseAndValidateDirectory, formatErrorsForCLI } from '../../../dsl';
import { generateAllFiles, writeGeneratedFiles } from '../../../codegen/UnifiedGenerator/unified-generator';
import { BaseCommand } from '../../../oclif/BaseCommand';
import type { RemoteGenerateOptions } from '../../../dsl/schema';

export async function remoteGenerateCapabilityCommand(
  capabilityName: string,
  options: RemoteGenerateOptions = {}
): Promise<void> {
  const cwd = process.cwd();

  try {
    console.log(chalk.blue(`\nReading mfe-manifest.yaml...`));

    const result = await parseAndValidateDirectory(cwd);

    if (!result.valid || !result.manifest) {
      console.error(chalk.red('\n✗ Invalid manifest:'));
      console.error(formatErrorsForCLI(result.errors));
      throw new Error('Manifest validation failed');
    }

    const manifest = result.manifest;
    console.log(chalk.green(`✓ Validated: ${manifest.name} v${manifest.version}`));

    // Filter capabilities to the named one only
    const matchingCapabilities = (manifest.capabilities ?? []).filter(
      (entry) => Object.keys(entry).some(
        (key) => key.toLowerCase() === capabilityName.toLowerCase()
      )
    );

    if (matchingCapabilities.length === 0) {
      const available = (manifest.capabilities ?? [])
        .flatMap((entry) => Object.keys(entry))
        .join(', ') || '(none)';
      throw new Error(
        `Capability "${capabilityName}" not found in manifest.\nAvailable: ${available}`
      );
    }

    const filteredManifest = { ...manifest, capabilities: matchingCapabilities };

    console.log(chalk.blue(`\nGenerating capability: ${capabilityName}`));
    const allFiles = await generateAllFiles(filteredManifest, cwd, { force: true });

    if (options.dryRun) {
      console.log(chalk.yellow('\n[DRY RUN] Would generate:'));
      for (const file of allFiles) {
        const relativePath = path.relative(cwd, file.path);
        const status = file.overwrite ? '(overwrite)' : '(new)';
        console.log(`  ${relativePath} ${chalk.gray(status)}`);
      }
      return;
    }

    const genResult = await writeGeneratedFiles(allFiles, { force: options.force });

    if (genResult.files.length > 0) {
      console.log(chalk.green('\n✓ Generated files:'));
      for (const file of genResult.files) {
        console.log(chalk.green(`  ${path.relative(cwd, file.path)}`));
      }
    }

    if (genResult.skipped.length > 0) {
      console.log(chalk.yellow('\nSkipped (already exist):'));
      for (const file of genResult.skipped) {
        console.log(chalk.yellow(`  ${path.relative(cwd, file)}`));
      }
      console.log(chalk.gray('  Use --force to overwrite'));
    }

    if (genResult.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      for (const error of genResult.errors) {
        console.log(chalk.red(`  ${error}`));
      }
    }

    const totalGenerated = genResult.files.length;
    if (totalGenerated > 0) {
      console.log(chalk.green(`\n✓ Capability "${capabilityName}" generation complete!`));
      console.log(chalk.blue('Run npm run dev to see your changes.'));
    }

  } catch (error) {
    console.error(chalk.red('\n✗ Capability generation failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class RemoteGenerateCapability extends BaseCommand<void> {
  static description = 'Generate a single capability from mfe-manifest.yaml'

  static examples = [
    '$ seans-mfe-tool remote:generate:capability UserProfile',
    '$ seans-mfe-tool remote:generate:capability Dashboard --force',
  ]

  static args = {
    name: Args.string({ description: 'Capability name to generate', required: true }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Show what would be generated without writing',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing files',
      default: false,
    }),
  }

  protected async runCommand(): Promise<void> {
    const { args, flags } = await this.parse(RemoteGenerateCapability)
    await remoteGenerateCapabilityCommand(args.name, {
      dryRun: flags['dry-run'],
      force: flags.force,
    })
  }
}

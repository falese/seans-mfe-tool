import { Flags } from '@oclif/core';
import * as path from 'path';
import chalk = require('chalk');
import { parseAndValidateDirectory, formatErrorsForCLI } from '../../dsl';
import { generateAllFiles, writeGeneratedFiles } from '../../codegen/UnifiedGenerator/unified-generator';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError } from '@seans-mfe/contracts';
import type { RemoteGenerateResult, PlannedChange } from '../../oclif/results';
import type { RemoteGenerateOptions } from '../../dsl/schema';

export async function remoteGenerateCommand(
  options: RemoteGenerateOptions & { dryRun?: boolean } = {}
): Promise<RemoteGenerateResult> {
  const cwd = process.cwd();

  try {
    console.log(chalk.blue('\nReading mfe-manifest.yaml...'));

    const result = await parseAndValidateDirectory(cwd);

    if (!result.valid || !result.manifest) {
      console.error(chalk.red('\n✗ Invalid manifest:'));
      console.error(formatErrorsForCLI(result.errors));
      throw new ValidationError(
        'Manifest validation failed',
        'mfe-manifest.yaml',
        'schema',
      );
    }

    const manifest = result.manifest;
    console.log(chalk.green(`✓ Validated: ${manifest.name} v${manifest.version}`));

    console.log(chalk.blue('\nGenerating files...'));
    const allFiles = await generateAllFiles(manifest, cwd, { force: true });

    if (options.dryRun) {
      const plannedChanges: PlannedChange[] = allFiles.map((file) => ({
        op: file.overwrite ? 'overwrite' : 'create',
        target: path.relative(cwd, file.path),
      }));
      console.log(chalk.yellow('\n[DRY RUN] Would generate:'));
      for (const file of allFiles) {
        const relativePath = path.relative(cwd, file.path);
        const status = file.overwrite ? '(overwrite)' : '(new)';
        console.log(`  ${relativePath} ${chalk.gray(status)}`);
      }
      return { generated: [], skipped: [], errors: [], dryRun: true, plannedChanges };
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

    console.log(chalk.blue('\nSummary:'));
    console.log(`  Generated: ${genResult.files.length}`);
    console.log(`  Skipped: ${genResult.skipped.length}`);
    if (genResult.errors.length > 0) console.log(chalk.red(`  Errors: ${genResult.errors.length}`));

    if (genResult.files.length > 0) {
      console.log(chalk.green('\n✓ Generation complete!'));
      console.log(chalk.blue('Run npm run dev to see your changes.'));
    }

    return {
      generated: genResult.files.map((f) => path.relative(cwd, f.path)),
      skipped:   genResult.skipped.map((f) => path.relative(cwd, f)),
      errors:    genResult.errors,
      dryRun:    false,
    };

  } catch (error) {
    console.error(chalk.red('\n✗ Generation failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class RemoteGenerate extends BaseCommand<RemoteGenerateResult> {
  static description = 'Generate files from mfe-manifest.yaml capabilities'

  static examples = [
    '$ cd my-remote && seans-mfe-tool remote:generate',
    '$ seans-mfe-tool remote:generate --dry-run  # Preview changes',
    '$ seans-mfe-tool remote:generate --force     # Overwrite existing',
  ]

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

  protected async runCommand(): Promise<RemoteGenerateResult> {
    const { flags } = await this.parse(RemoteGenerate)
    return remoteGenerateCommand({ dryRun: flags['dry-run'], force: flags.force })
  }
}

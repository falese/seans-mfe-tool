/**
 * remote:generate Command
 * Following ADR-048: Incremental TypeScript migration
 * Implements REQ-REMOTE-003: Generate files from DSL
 */

import * as path from 'path';
import chalk = require('chalk');
import { 
  parseAndValidateDirectory, 
  formatErrorsForCLI 
} from '../dsl';
import { generateAllFiles, writeGeneratedFiles } from '../dsl/unified-generator';
import * as fs from 'fs-extra';
import type { RemoteGenerateOptions } from '../dsl/schema';

// =============================================================================
// Main Command
// =============================================================================

/**
 * Generate files from mfe-manifest.yaml
 * 
 * @param options - Command options
 */
export async function remoteGenerateCommand(
  options: RemoteGenerateOptions = {}
): Promise<void> {
  const cwd = process.cwd();

  try {
    console.log(chalk.blue('\nReading mfe-manifest.yaml...'));

    // Parse and validate manifest
    const result = await parseAndValidateDirectory(cwd);

    if (!result.valid || !result.manifest) {
      console.error(chalk.red('\n✗ Invalid manifest:'));
      console.error(formatErrorsForCLI(result.errors));
      throw new Error('Manifest validation failed');
    }

    const manifest = result.manifest;
    console.log(chalk.green(`✓ Validated: ${manifest.name} v${manifest.version}`));


    // Generate all files (capabilities + platform) using unified generator
    console.log(chalk.blue('\nGenerating files...'));
    const allFiles = await generateAllFiles(manifest, cwd, { force: true });

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

    // Report results
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

    // Summary
    const totalGenerated = genResult.files.length;
    const totalSkipped = genResult.skipped.length;
    const totalErrors = genResult.errors.length;

    console.log(chalk.blue('\nSummary:'));
    console.log(`  Generated: ${totalGenerated}`);
    console.log(`  Skipped: ${totalSkipped}`);
    if (totalErrors > 0) {
      console.log(chalk.red(`  Errors: ${totalErrors}`));
    }

    if (totalGenerated > 0) {
      console.log(chalk.green('\n✓ Generation complete!'));
      console.log(chalk.blue('Run npm run dev to see your changes.'));
    }

  } catch (error) {
    console.error(chalk.red('\n✗ Generation failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}



/**
 * Generate a single capability (for targeted generation)
 */
export async function remoteGenerateCapabilityCommand(
  capabilityName: string,
  options: RemoteGenerateOptions = {}
): Promise<void> {
  const cwd = process.cwd();

  try {
    console.log(chalk.blue(`\nGenerating capability: ${capabilityName}`));

    // Parse and validate manifest
    const result = await parseAndValidateDirectory(cwd);

    if (!result.valid || !result.manifest) {
      console.error(chalk.red('\n✗ Invalid manifest:'));
      console.error(formatErrorsForCLI(result.errors));
      throw new Error('Manifest validation failed');
    }

    const manifest = result.manifest;

    // Find the specific capability
    let foundConfig: import('../dsl/schema').CapabilityConfig | undefined;
    for (const entry of manifest.capabilities) {
      if (capabilityName in entry) {
        foundConfig = entry[capabilityName];
        break;
      }
    }

    if (!foundConfig) {
      throw new Error(
        `Capability "${capabilityName}" not found in manifest. ` +
        `Available: ${manifest.capabilities.flatMap(e => Object.keys(e)).join(', ') || 'none'}`
      );
    }

    // Import generator function
    const { generateCapabilityFiles } = await import('../dsl/generator');
    const files = generateCapabilityFiles(capabilityName, foundConfig, cwd);

    if (options.dryRun) {
      console.log(chalk.yellow('\n[DRY RUN] Would generate:'));
      for (const file of files) {
        console.log(`  ${path.relative(cwd, file.path)}`);
      }
      return;
    }

    const genResult = await writeGeneratedFiles(files, { force: options.force });

    if (genResult.files.length > 0) {
      console.log(chalk.green('\n✓ Generated:'));
      for (const file of genResult.files) {
        console.log(chalk.green(`  ${path.relative(cwd, file.path)}`));
      }
    }

    if (genResult.skipped.length > 0) {
      console.log(chalk.yellow('\nSkipped (already exist):'));
      for (const file of genResult.skipped) {
        console.log(chalk.yellow(`  ${path.relative(cwd, file)}`));
      }
    }

    // Update rspack config
    // rspack.config.js is now generated via EJS template in unified generator

    console.log(chalk.green(`\n✓ Capability "${capabilityName}" generated!`));

  } catch (error) {
    console.error(chalk.red('\n✗ Generation failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export { remoteGenerateCommand as default };

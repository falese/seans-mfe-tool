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
} from '@seans-mfe-tool/dsl';
import { generateAllFiles, writeGeneratedFiles } from '@seans-mfe-tool/codegen';
import * as fs from 'fs-extra';
import type { RemoteGenerateOptions } from '@seans-mfe-tool/dsl';
import { createLogger } from '@seans-mfe-tool/logger';

// Logger for remote-generate commands
const logger = createLogger({ context: 'remote-generate' });

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
    logger.info('\nReading mfe-manifest.yaml...');

    // Parse and validate manifest
    const result = await parseAndValidateDirectory(cwd);

    if (!result.valid || !result.manifest) {
      logger.error('\n✗ Invalid manifest:');
      console.error(formatErrorsForCLI(result.errors));
      throw new Error('Manifest validation failed');
    }

    const manifest = result.manifest;
    logger.success(`Validated: ${manifest.name} v${manifest.version}`);


    // Generate all files (capabilities + platform) using unified generator
    logger.info('\nGenerating files...');
    const allFiles = await generateAllFiles(manifest, cwd, { force: true });

    if (options.dryRun) {
      logger.warn('\n[DRY RUN] Would generate:');
      for (const file of allFiles) {
        const relativePath = path.relative(cwd, file.path);
        const status = file.overwrite ? '(overwrite)' : '(new)';
        logger.info(`  ${relativePath} ${chalk.gray(status)}`);
      }
      return;
    }

    const genResult = await writeGeneratedFiles(allFiles, { force: options.force });

    // Report results
    if (genResult.files.length > 0) {
      logger.info(chalk.green('\n✓ Generated files:'));
      for (const file of genResult.files) {
        logger.info(chalk.green(`  ${path.relative(cwd, file.path)}`));
      }
    }

    if (genResult.skipped.length > 0) {
      logger.info(chalk.yellow('\nSkipped (already exist):'));
      for (const file of genResult.skipped) {
        logger.info(chalk.yellow(`  ${path.relative(cwd, file)}`));
      }
      logger.info(chalk.gray('  Use --force to overwrite'));
    }

    if (genResult.errors.length > 0) {
      logger.info(chalk.red('\nErrors:'));
      for (const error of genResult.errors) {
        logger.info(chalk.red(`  ${error}`));
      }
    }

    // Summary
    const totalGenerated = genResult.files.length;
    const totalSkipped = genResult.skipped.length;
    const totalErrors = genResult.errors.length;

    logger.info('\nSummary:');
    logger.info(`  Generated: ${totalGenerated}`);
    logger.info(`  Skipped: ${totalSkipped}`);
    if (totalErrors > 0) {
      logger.info(chalk.red(`  Errors: ${totalErrors}`));
    }

    if (totalGenerated > 0) {
      logger.info(chalk.green('\n✓ Generation complete!'));
      logger.info('Run npm run dev to see your changes.');
    }

  } catch (error) {
    logger.error('\n✗ Generation failed:');
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}





export { remoteGenerateCommand as default };

/**
 * remote:init Command
 * Following ADR-048: Incremental TypeScript migration
 * Implements REQ-REMOTE-002: Scaffold new DSL-based remote
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import { execSync } from 'child_process';
import { 
  createMinimalManifest, 
  writeManifest, 
  generateEndpoints 
} from '@seans-mfe-tool/dsl';
import { processTemplates } from '../utils/templateProcessor';
import type { RemoteInitOptions, DSLManifest } from '@seans-mfe-tool/dsl';
import { createLogger } from '@seans-mfe-tool/logger';

// Logger for remote-init commands
const logger = createLogger({ context: 'remote-init' });


// =============================================================================
// Main Command
// =============================================================================

/**
 * Initialize a new DSL-based remote MFE project
 * 
 * @param name - Project name (kebab-case)
 * @param options - Command options
 */
export async function remoteInitCommand(
  name: string,
  options: RemoteInitOptions = {}
): Promise<void> {
  const port = options.port || 3001;
  const targetDir = path.resolve(process.cwd(), name);

  try {
    logger.info(`\nCreating DSL-based remote MFE: ${name}`);
    logger.info(chalk.gray(`Target directory: ${targetDir}`));

    // Check if directory exists
    if (await fs.pathExists(targetDir)) {
      if (!options.force) {
        throw new Error(
          `Directory "${name}" already exists. Use --force to overwrite.`
        );
      }
      logger.warn(`⚠ Overwriting existing directory`);
    }

    // Create directory structure
    logger.info('\nCreating project structure...');
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'features'));
    await fs.ensureDir(path.join(targetDir, 'public'));

    // Create manifest only
    logger.info('Generating mfe-manifest.yaml...');
    const manifest = createMinimalManifest(name, {
      type: 'remote',
      language: 'typescript'
    });
    const endpoints = generateEndpoints(name, port);
    const fullManifest: DSLManifest = {
      ...manifest,
      ...endpoints
    };
    await writeManifest(fullManifest, path.join(targetDir, 'mfe-manifest.yaml'));
    logger.success('mfe-manifest.yaml');

    // Success message
    logger.info(chalk.green('\n✓ Remote MFE manifest created!'));
    logger.info('\nNext steps:');
    logger.info(`  1. ${chalk.cyan(`cd ${name}`)}`);
    logger.info(`  2. Edit ${chalk.cyan('mfe-manifest.yaml')} to add capabilities`);
    logger.info(`  3. Run ${chalk.cyan('mfe remote:generate')} to scaffold features and platform files`);
    logger.info(`  4. Run ${chalk.cyan('npm run dev')} to start development`);
    logger.info(`\nRemote will be available at: ${chalk.cyan(`http://localhost:${port}`)}`);
    logger.info(`remoteEntry.js: ${chalk.cyan(`http://localhost:${port}/remoteEntry.js`)}`);

  } catch (error) {
    logger.error('\n✗ Failed to create remote MFE:');
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export { remoteInitCommand as default };

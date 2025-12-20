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
} from '../dsl/parser';
import { processTemplates } from '../utils/templateProcessor';
import type { RemoteInitOptions, DSLManifest } from '../dsl/schema';


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
    console.log(chalk.blue(`\nCreating DSL-based remote MFE: ${name}`));
    console.log(chalk.gray(`Target directory: ${targetDir}`));

    // Check if directory exists
    if (await fs.pathExists(targetDir)) {
      if (!options.force) {
        throw new Error(
          `Directory "${name}" already exists. Use --force to overwrite.`
        );
      }
      console.log(chalk.yellow(`⚠ Overwriting existing directory`));
    }

    // Create directory structure
    console.log(chalk.blue('\nCreating project structure...'));
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'features'));
    await fs.ensureDir(path.join(targetDir, 'public'));

    // Create manifest only
    console.log(chalk.blue('Generating mfe-manifest.yaml...'));
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
    console.log(chalk.green('✓ mfe-manifest.yaml'));

    // Success message
    console.log(chalk.green('\n✓ Remote MFE manifest created!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. ${chalk.cyan(`cd ${name}`)}`);
    console.log(`  2. Edit ${chalk.cyan('mfe-manifest.yaml')} to add capabilities`);
    console.log(`  3. Run ${chalk.cyan('mfe remote:generate')} to scaffold features and platform files`);
    console.log(`  4. Run ${chalk.cyan('npm run dev')} to start development`);
    console.log(`\nRemote will be available at: ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log(`remoteEntry.js: ${chalk.cyan(`http://localhost:${port}/remoteEntry.js`)}`);

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create remote MFE:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export { remoteInitCommand as default };

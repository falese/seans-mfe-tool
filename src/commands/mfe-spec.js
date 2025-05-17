// src/commands/mfe-spec.js
const path = require('path');
const chalk = require('chalk');
const { run } = require('../utils/MFEGenerator');

/**
 * MFE Spec command handler
 * Generates or updates an MFE project based on a YAML specification
 * 
 * @param {string} command - 'generate' or 'update' command
 * @param {string} specFile - Path to the YAML specification file
 * @param {Object} options - Command options
 * @param {string} options.output - Output directory (default: current directory)
 * @param {boolean} options.dryRun - Show changes without applying them
 */
async function mfeSpecCommand(command, specFile, options) {
  try {
    console.log(chalk.blue(`MFE Spec ${command} - ${specFile}`));
    
    // Prepare arguments for the generator
    const args = [
      command,
      path.resolve(process.cwd(), specFile)
    ];
    
    // Add output option if specified
    if (options.output && options.output !== process.cwd()) {
      args.push(`--output=${options.output}`);
    }
    
    // Add dry-run option if enabled
    if (options.dryRun) {
      args.push('--dry-run');
    }
    
    // Run the generator
    await run(args);
    
  } catch (error) {
    console.error(chalk.red(`\n✗ Command failed:`));
    console.error(chalk.red(error.message));
    if (process.env.DEBUG && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = mfeSpecCommand;

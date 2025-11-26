const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { processTemplates } = require('../utils/templateProcessor');

function validatePort(port) {
  const n = typeof port === 'string' ? Number(port) : port;
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error('Invalid port');
  }
  return n;
}

async function createShellCommand(name, options) {
  try {
    console.log(chalk.blue(`Creating shell application "${name}"...`));

    // Resolve paths
    const targetDir = path.resolve(process.cwd(), name);
    const templateDir = path.resolve(__dirname, '..', 'templates', 'react', 'shell');

    console.log('Target directory:', targetDir);
    console.log('Template directory:', templateDir);

    // Verify template directory exists
    if (!fs.existsSync(templateDir)) {
      throw new Error(`Template directory not found: ${templateDir}`);
    }

    // Create target directory if it doesn't exist
    await fs.ensureDir(targetDir);

    // Copy template to target directory
    await fs.copy(templateDir, targetDir);

    // Validate and normalize inputs
    const port = validatePort(options.port || 3000);
    const remotes = options.remotes || '{}';

    // Process templates
    console.log('\nProcessing template files...');
    await processTemplates(targetDir, { name, port, remotes });

    // Install dependencies
    console.log(chalk.blue('\nInstalling dependencies...'));
    execSync('npm install', { 
      cwd: targetDir, 
      stdio: 'inherit',
      env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
    });

    console.log(chalk.green('\n✓ Shell application created successfully!'));
    console.log('\nNext steps:');
    console.log(chalk.blue(`1. cd ${name}`));
    console.log(chalk.blue('2. npm start'));
    console.log(`\nYour application will be available at: http://localhost:${port}`);

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create shell application:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    throw error;
  }
}

module.exports = {
  createShellCommand
};

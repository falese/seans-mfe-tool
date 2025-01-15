const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const { processTemplates } = require('../utils/templateProcessor');

async function createRemoteCommand(name, options) {
  try {
    console.log(chalk.blue(`Creating remote MFE "${name}"...`));

    // Resolve paths
    const targetDir = path.resolve(process.cwd(), name);
    const templateDir = path.resolve(__dirname, '..', 'templates', 'react', 'remote');

    // Validate MUI version format
    const muiVersion = options.muiVersion || '5.15.0';
    if (!/^\d+\.\d+\.\d+$/.test(muiVersion)) {
      throw new Error('Invalid MUI version format. Expected x.y.z');
    }

    // Parse and validate port
    let port = options.port || 3001; // default port
    if (options.port) {
      port = parseInt(options.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error('Invalid port number. Must be between 1 and 65535');
      }
    }

    // Create target directory if it doesn't exist
    await fs.ensureDir(targetDir);

    // Copy template to target directory
    await fs.copy(templateDir, targetDir);

    // Process templates
    console.log('\nProcessing template files...');
    await processTemplates(targetDir, {
      name,
      port,
      muiVersion,
      exposedName: name.toLowerCase().replace(/[^a-z0-9]/g, '')
    });

    // Install dependencies
    console.log(chalk.blue('\nInstalling dependencies...'));
    execSync('npm install', { 
      cwd: targetDir, 
      stdio: 'inherit',
      env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
    });

    console.log(chalk.green('\n✓ Remote MFE created successfully!'));
    console.log('\nNext steps:');
    console.log(chalk.blue(`1. cd ${name}`));
    console.log(chalk.blue('2. npm start'));
    console.log(`\nYour MFE will be available at: http://localhost:${port}`);

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create remote MFE:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

module.exports = {
  createRemoteCommand
};

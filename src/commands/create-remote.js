const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

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

    const port = parseInt(options.port || '3001', 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Invalid port number. Must be between 1 and 65535');
    }

    // Create target directory if it doesn't exist
    await fs.ensureDir(targetDir);

    // Copy template to target directory
    await fs.copy(templateDir, targetDir);

    // Process templates
    console.log('\nProcessing template files...');
    await processTemplates(targetDir, {
      name,
      port: options.port || 3001,
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
    console.log(`\nYour MFE will be available at: http://localhost:${options.port || 3001}`);

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create remote MFE:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function processTemplates(targetDir, vars) {
  const processFile = async (filePath) => {
    console.log('Processing:', filePath);
    const content = await fs.readFile(filePath, 'utf8');
    const processedContent = content
      .replace(/__PROJECT_NAME__/g, vars.name)
      .replace(/__PORT__/g, vars.port)
      .replace(/__MUI_VERSION__/g, vars.muiVersion)
      .replace(/__EXPOSED_NAME__/g, vars.exposedName);
    await fs.writeFile(filePath, processedContent);
  };

  // Process each configuration file
  await processFile(path.join(targetDir, 'package.json'));
  await processFile(path.join(targetDir, 'rspack.config.js'));
  await fs.ensureDir(path.join(targetDir, 'public'));
  await processFile(path.join(targetDir, 'public', 'index.html'));
  await processFile(path.join(targetDir, 'src', 'App.jsx'));
  await processFile(path.join(targetDir, 'src', 'bootstrap.jsx'));
  
}


module.exports = {
  createRemoteCommand
};

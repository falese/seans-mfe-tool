const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

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

    // Process templates
    console.log('\nProcessing template files...');
    await processTemplates(targetDir, {
      name,
      port: options.port || 3000,
      remotes: options.remotes || '{}'
    });

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
    console.log(`\nYour application will be available at: http://localhost:${options.port || 3000}`);

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create shell application:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function processTemplates(targetDir, vars) {
  try {
    // Process each file individually
    const processFile = async (filePath) => {
      console.log('Processing:', filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const processedContent = content
        .replace(/__PROJECT_NAME__/g, vars.name)
        .replace(/__PORT__/g, vars.port)
        .replace(/__REMOTES__/g, vars.remotes);
      await fs.writeFile(filePath, processedContent);
    };

    // Process package.json
    await processFile(path.join(targetDir, 'package.json'));

    // Process rspack.config.js
    await processFile(path.join(targetDir, 'rspack.config.js'));

    // Process index.html
    await processFile(path.join(targetDir, 'public', 'index.html'));

    // Process App.jsx
    await processFile(path.join(targetDir, 'src', 'App.jsx'));

  } catch (error) {
    console.error('Error processing templates:', error);
    throw error;
  }
}

module.exports = {
  createShellCommand
};
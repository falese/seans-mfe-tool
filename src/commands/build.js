const { BuildManager } = require('../build/BuildManager');
const chalk = require('chalk');

async function buildCommand(options) {
  try {
    const manager = new BuildManager(options);
    await manager.initialize();
    
    if (options.serve) {
      await manager.serve();
    } else {
      await manager.build();
    }
  } catch (error) {
    console.error(chalk.red('\n✗ Command failed:'));
    console.error(chalk.red(error.message));
    if (process.env.DEBUG && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { buildCommand };
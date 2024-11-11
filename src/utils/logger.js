const chalk = require('chalk');

function logSuccess(message) {
  console.log(chalk.green('✓'), message);
}

function logError(message, error) {
  console.error(chalk.red('✗'), message);
  if (error) {
    console.error(chalk.red(error.message));
  }
}

module.exports = {
  logSuccess,
  logError
};

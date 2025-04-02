const chalk = require('chalk');
const readline = require('readline');

class BaseServer {
  constructor(options, context) {
    this.options = options;
    this.context = context;
    this.port = options.port || 3000;
    this.isShuttingDown = false;
    
    // Enable raw mode for better keyboard handling
    this.setupProcessHandling();
  }

  setupProcessHandling() {
    // Make sure we only set this up once
    if (!process.stdin.isTTY) return;

    // Enable raw mode
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Handle keyboard input
    process.stdin.on('data', async (key) => {
      // Convert buffer to string and get first character
      const char = key.toString();

      // Ctrl+C handling
      if (char === '\u0003') {
        await this.handleShutdown('SIGINT');
        return;
      }

      // Other keyboard controls
      switch (char) {
        case 'q':
          await this.handleShutdown('QUIT');
          break;
        case 'r':
          await this.restart();
          break;
        case 'h':
          this.showHelp();
          break;
        default:
          // Handle any additional keys in child classes
          break;
      }
    });

    // Handle process signals
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
      process.on(signal, async () => {
        await this.handleShutdown(signal);
      });
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('\nUncaught Exception:'));
      console.error(error);
      await this.handleShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error(chalk.red('\nUnhandled Rejection at:'), promise);
      console.error(chalk.red('Reason:'), reason);
      await this.handleShutdown('UNHANDLED_REJECTION');
    });
  }

  async handleShutdown(signal) {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log(chalk.yellow(`\nReceived ${signal}, shutting down...`));
    
    try {
      await this.stop();
      console.log(chalk.green('✓ Server stopped successfully'));
    } catch (error) {
      console.error(chalk.red('✗ Error during shutdown:'));
      console.error(error);
    } finally {
      // Force exit after 3 seconds if graceful shutdown fails
      setTimeout(() => {
        console.log(chalk.yellow('Forcing exit...'));
        process.exit(1);
      }, 3000);
      
      process.exit(0);
    }
  }

  showHelp() {
    console.log(chalk.blue('\nAvailable commands:'));
    console.log(chalk.gray('- Press Ctrl+C to stop the server'));
    console.log(chalk.gray('- Press q to quit'));
    console.log(chalk.gray('- Press r to restart the server'));
    console.log(chalk.gray('- Press h to show this help'));
  }

  // Abstract methods to be implemented by child classes
  async start() {
    throw new Error('start() must be implemented by server template');
  }

  async stop() {
    throw new Error('stop() must be implemented by server template');
  }

  async restart() {
    console.log(chalk.yellow('\nRestarting server...'));
    try {
      await this.stop();
      await this.start();
      console.log(chalk.green('✓ Server restarted successfully'));
    } catch (error) {
      console.error(chalk.red('✗ Error restarting server:'));
      console.error(error);
    }
  }
}

module.exports = { BaseServer };
const { BaseServer } = require('../BaseServer');
const { RspackDevServer } = require('@rspack/dev-server');
const chalk = require('chalk');

class RspackServer extends BaseServer {
  constructor(options, context) {
    super(options, context);
    this.server = null;
  }

  async start() {
    const devServerOptions = {
      host: 'localhost',
      port: this.port,
      client: {
        overlay: {
          errors: true,
          warnings: false
        },
        progress: true
      },
      static: {
        directory: this.context
      },
      hot: true
    };

    this.server = new RspackDevServer(devServerOptions, this.options.compiler);
    await this.server.start();
    
    console.log(chalk.green(`\n✓ Development server started at http://localhost:${this.port}`));
    this.showHelp();
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        const cleanup = () => {
          this.server = null;
          resolve();
        };

        try {
          this.server.stop(cleanup);
        } catch (error) {
          console.error(chalk.yellow('Warning: Error while stopping server:'), error);
          cleanup();
        }

        // Force cleanup after 2 seconds
        setTimeout(cleanup, 2000);
      });
    }
  }
}

module.exports = {RspackServer};
const { BaseServer } = require('../BaseServer');
const nodemon = require('nodemon');
const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');

class NodemonServer extends BaseServer {
  constructor(options, context) {
    super(options, context);
    this.nodemon = null;
    this.debugMode = options.debug || false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      // Start nodemon with the --inspect flag if in debug mode
      const scriptPath = path.join(this.context, 'src/index.js');
      
      // Enhanced environment variables
      const env = {
        ...process.env,
        NODE_ENV: this.options.mode,
        PORT: this.port,
        // Add any additional env vars needed for development
        CORS_ENABLED: 'true',
        CORS_ORIGIN: '*',
        BODY_PARSER_LIMIT: '50mb',
        REQUEST_TIMEOUT: '60000'
      };

      // Configure nodemon with proper signal handling
      this.nodemon = nodemon({
        script: scriptPath,
        watch: [
          path.join(this.context, 'src'),
          path.join(this.context, 'config')
        ],
        ext: 'js,json',
        env,
        // Ignore test files and node_modules
        ignore: ['*.test.js', '*.spec.js', 'node_modules/*'],
        // Ensure proper signal handling
        signal: 'SIGTERM',
        // Add --inspect flag if in debug mode
        exec: this.debugMode ? 'node --inspect' : 'node'
      });

      let serverStarted = false;

      this.nodemon
        .on('start', () => {
          if (!serverStarted) {
            console.log(chalk.green(`\n✓ API server started at http://localhost:${this.port}`));
            if (this.debugMode) {
              console.log(chalk.blue(`\n🔍 Debug mode enabled at: chrome://inspect`));
            }
            this.showHelp();
            serverStarted = true;
            resolve();
          }
        })
        .on('restart', (files) => {
          console.log(chalk.yellow('\nAPI Server restarting...'));
          if (files) {
            console.log(chalk.gray('Changes detected in:'));
            files.forEach(file => console.log(chalk.gray(`- ${path.relative(this.context, file)}`)));
          }
        })
        .on('crash', () => {
          console.error(chalk.red('\n✗ API Server crashed'));
          console.log(chalk.gray('Waiting for changes to restart...'));
        })
        .on('quit', () => {
          console.log(chalk.yellow('\nAPI Server stopped'));
        })
        .on('stderr', (data) => {
          // Filter out common development logs
          const logLine = data.toString();
          if (!logLine.includes('Listening on port') && 
              !logLine.includes('Compiled successfully') &&
              !logLine.includes('Starting compilation')) {
            console.error(chalk.red(logLine));
          }
        })
        .on('stdout', (data) => {
          // Enhanced request logging
          const logLine = data.toString();
          if (logLine.includes('HTTP') || logLine.includes('Request')) {
            const isError = logLine.includes('Error') || logLine.includes('Failed');
            console.log(isError ? chalk.red(logLine) : chalk.gray(logLine));
          }
        });

      // Handle process level errors
      process.on('uncaughtException', (err) => {
        console.error(chalk.red('\nUncaught Exception:'));
        console.error(err);
        this.restart();
      });

      process.on('unhandledRejection', (reason, promise) => {
        console.error(chalk.red('\nUnhandled Rejection at:'), promise);
        console.error(chalk.red('Reason:'), reason);
        this.restart();
      });

      // Enhanced keyboard controls
      process.stdin.on('data', async (data) => {
        const key = data.toString().trim();
        
        switch(key) {
          case 'd':
            this.debugMode = !this.debugMode;
            console.log(chalk.blue(`\nDebug mode ${this.debugMode ? 'enabled' : 'disabled'}`));
            await this.restart();
            break;
          case 'l':
            // Toggle request logging
            env.DEBUG = env.DEBUG ? '' : '*';
            console.log(chalk.blue(`\nDetailed logging ${env.DEBUG ? 'enabled' : 'disabled'}`));
            await this.restart();
            break;
          case 'c':
            // Clear console
            console.clear();
            this.showHelp();
            break;
          case 't':
            // Test all endpoints
            this.testEndpoints();
            break;
        }
      });
    });
  }

  async testEndpoints() {
    console.log(chalk.blue('\nTesting endpoints...'));
    
    const testRequests = [
      { method: 'GET', path: '/health' },
      { method: 'GET', path: '/api/test' },
      { method: 'POST', path: '/api/test', body: { test: 'data' } },
      { method: 'PUT', path: '/api/test', body: { test: 'data' } },
      { method: 'DELETE', path: '/api/test' },
      { method: 'PATCH', path: '/api/test', body: { test: 'data' } },
      { method: 'OPTIONS', path: '/api/test' }
    ];

    const curl = async (method, path, body) => {
      let cmd = `curl -X ${method} http://localhost:${this.port}${path} -i`;
      if (body) {
        cmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(body)}'`;
      }
      
      try {
        const { stdout, stderr } = await new Promise((resolve, reject) => {
          exec(cmd, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve({ stdout, stderr });
          });
        });

        return stdout;
      } catch (error) {
        return `Error: ${error.message}`;
      }
    };

    for (const request of testRequests) {
      const response = await curl(request.method, request.path, request.body);
      const statusCode = response.match(/HTTP\/[\d.]+ (\d+)/)?.[1];
      const success = statusCode && statusCode[0] === '2';
      
      console.log(
        success ? chalk.green('✓') : chalk.red('✗'),
        chalk.gray(`${request.method.padEnd(7)} ${request.path.padEnd(15)}`),
        success ? chalk.green(statusCode) : chalk.red(statusCode || 'Failed')
      );
    }
  }

  async stop() {
    if (this.nodemon) {
      return new Promise((resolve) => {
        this.nodemon.once('quit', () => {
          console.log(chalk.green('✓ Server stopped'));
          resolve();
        });
        this.nodemon.emit('quit');
      });
    }
  }

  async restart() {
    if (this.nodemon) {
      console.log(chalk.yellow('\nRestarting API server...'));
      await this.stop();
      await this.start();
    }
  }

  showHelp() {
    super.showHelp();
    console.log(chalk.gray('- Press d to toggle debug mode'));
    console.log(chalk.gray('- Press l to toggle detailed logging'));
    console.log(chalk.gray('- Press c to clear console'));
    console.log(chalk.gray('- Press t to test all endpoints'));
  }
}

module.exports = {NodemonServer};
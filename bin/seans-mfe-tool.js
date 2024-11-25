#!/usr/bin/env node

const { program } = require('commander');
const { createShellCommand } = require('../src/commands/create-shell');
const { createRemoteCommand } = require('../src/commands/create-remote');
const { deployCommand } = require('../src/commands/deploy');
const { createApiCommand } = require('../src/commands/create-api')
const { buildCommand } = require('../src/commands/build');
const { version } = require('../package.json');

program
  .version(version)
  .description('Create and manage Module Federation applications with React and MUI');

program
  .command('shell')
  .description('Create a new shell (container) application')
  .argument('<name>', 'Shell application name')
  .option('-p, --port <port>', 'Port number for the shell application', '3000')
  .option('-r, --remotes <remotes>', 'Remote MFEs configuration as JSON string')
  .action((name, options) => {
    createShellCommand(name, options);
  });

program
  .command('remote')
  .description('Create a new remote MFE')
  .argument('<name>', 'Remote MFE name')
  .option('-p, --port <port>', 'Port number for the remote MFE', '3001')
  .option('-m, --mui-version <version>', 'Material UI version', '5.15.0')
  .action((name, options) => {
    createRemoteCommand(name, options);
  });

  program
  .command('deploy')
  .description('Deploy an application')
  .argument('<name>', 'Application name')
  .requiredOption('-t, --type <type>', 'Application type (shell, remote, or api)')
  .option('-e, --env <environment>', 'Deployment environment (development or production)', 'development')
  .option('-p, --port <port>', 'Port number for development deployment', '8080')
  .option('-r, --registry <url>', 'Docker registry URL for production deployment')
  .option('-m, --memory <limit>', 'Memory limit for API containers', '256Mi')
  .option('-c, --cpu <limit>', 'CPU limit for API containers', '0.5')
  .option('--replicas <count>', 'Number of API replicas', '2')
  .action((name, options) => {
    if (!['shell', 'remote', 'api'].includes(options.type)) {
      console.error('Type must be shell, remote, or api');
      process.exit(1);
    }
    deployCommand({ name, ...options });
  });

program
  .command('init')
  .description('Initialize a new Module Federation workspace')
  .argument('<name>', 'Project name')
  .option('-p, --package-manager <manager>', 'Package manager to use (npm, yarn, or pnpm)', 'pnpm')
  .action((name, options) => {
    console.log('Creating new workspace:', name);
    console.log('Options:', options);
  });

  program
  .command('api')
  .description('Create a new API from OpenAPI specification')
  .argument('<name>', 'API name')
  .option('-p, --port <port>', 'Port number for the API', '3001')
  .option('-s, --spec <path>', 'Path to OpenAPI specification file or URL', 'openapi.yaml')
  .option('-d, --database <type>', 'Database type to use (mongodb or sqlite)', 'sqlite')
  .addHelpText('after', `
Examples:
  $ seans-mfe-tool api my-store --spec store.yaml --database mongodb
  $ seans-mfe-tool api pet-store --spec https://petstore3.swagger.io/api/v3/openapi.json --database sqlite

Database Options:
  mongodb    Uses MongoDB with MongoDB Memory Server for development
  sqlite     Uses SQLite with file-based storage (default)

Notes:
  - MongoDB option will use in-memory database for development and testing
  - SQLite option will create a local database file in src/data/
  - Both options can be configured for production use through environment variables`)
  .action((name, options) => {
    // Validate database option
    const validDatabases = ['mongodb', 'mongo', 'sqlite', 'sql'];
    if (!validDatabases.includes(options.database.toLowerCase())) {
      console.error(chalk.red(`Error: Invalid database type '${options.database}'.`));
      console.log(chalk.blue('Valid options are: mongodb, sqlite'));
      process.exit(1);
    }
    
    createApiCommand(name, options);
  });


  program
  .command('build')
  .description('Build an application')
  .argument('<name>', 'Application name')
  .requiredOption('-t, --type <type>', 'Application type (shell, remote, or api)')
  .option('-m, --mode <mode>', 'Build mode (development or production)', 'development')
  .option('-p, --port <port>', 'Port number for development server')
  .option('-s, --serve', 'Start development server')
  .option('--analyze', 'Enable bundle analysis')
  .action((name, options) => {
    if (!['shell', 'remote', 'api'].includes(options.type)) {
      console.error(chalk.red('Error: Type must be shell, remote, or api'));
      process.exit(1);
    }
    buildCommand({ name, ...options });
  });
program.parse(process.argv);
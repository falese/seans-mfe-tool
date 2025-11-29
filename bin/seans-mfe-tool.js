#!/usr/bin/env node

// Enable TypeScript imports via ts-node (ADR-048: Incremental TypeScript migration)
// Use custom compiler options to avoid tsconfig conflicts
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node',
    target: 'ES2020',
    esModuleInterop: true,
    allowJs: true,
    resolveJsonModule: true
  }
});

const chalk = require('chalk');
const { program } = require('commander');
const { createShellCommand } = require('../src/commands/create-shell');
const { createRemoteCommand } = require('../src/commands/create-remote');
const { deployCommand } = require('../src/commands/deploy');
const { createApiCommand } = require('../src/commands/create-api')
const { buildCommand } = require('../src/commands/build');
const { initCommand } = require('../src/commands/init');
const { bffBuildCommand, bffDevCommand, bffValidateCommand, bffInitCommand } = require('../src/commands/bff');
const { remoteInitCommand } = require('../src/commands/remote-init');
const { remoteGenerateCommand, remoteGenerateCapabilityCommand } = require('../src/commands/remote-generate');
const { version } = require('../package.json');


program
  .command('generate <file>')
  .description('[DEPRECATED] Generate a new MFE project from a YAML specification')
  .option('-o, --output <dir>', 'Output directory', process.cwd())
  .option('-d, --dry-run', 'Show changes without applying them', false)
  .action((file, options) => {
    console.warn(
      chalk.yellow('\n[DEPRECATION WARNING] The "generate" command is deprecated and will be removed in a future release. Please use "init", "shell", "remote", or "api" commands instead. See documentation for migration guidance.')
    );
    require('../src/commands/mfe-spec')('generate', file, options);
  });


program
  .command('update <file>')
  .description('[DEPRECATED] Update an existing MFE project from a YAML specification')
  .option('-o, --output <dir>', 'Output directory', process.cwd())
  .option('-d, --dry-run', 'Show changes without applying them', false)
  .action((file, options) => {
    console.warn(
      chalk.yellow('\n[DEPRECATION WARNING] The "update" command is deprecated and will be removed in a future release. Please use "init", "shell", "remote", or "api" commands instead. See documentation for migration guidance.')
    );
    require('../src/commands/mfe-spec')('update', file, options);
  });



program
  .command('spec')
  .description('[DEPRECATED] Generate or update MFE project based on YAML specification')
  .argument('<command>', 'Command to execute (generate or update)')
  .argument('<file>', 'Path to the YAML specification file')
  .option('-o, --output <dir>', 'Output directory', process.cwd())
  .option('-d, --dry-run', 'Show changes without applying them', false)
  .action((command, file, options) => {
    console.warn(
      chalk.yellow('\n[DEPRECATION WARNING] The "spec" command is deprecated and will be removed in a future release. Please use "init", "shell", "remote", or "api" commands instead. See documentation for migration guidance.')
    );
    const mfeSpecCommand = require('../src/commands/mfe-spec');
    mfeSpecCommand(command, file, options);
  });


program
  .version(version)
  .description('Create and manage Module Federation applications with React and MUI');

  // 'analyze' command removed per ADR-021 (immediate removal). Historical reference only.



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
    .option('--mode <mode>', 'Production deployment mode (docker-compose or kubernetes)', 'docker-compose')
    .option('-n, --namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('-d, --domain <domain>', 'Domain name for production deployment')
    .option('--tag <tag>', 'Docker image tag', 'latest')
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
    initCommand(name, options);
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

// BFF Commands - Following ADR-046: GraphQL Mesh with DSL-embedded configuration
program
  .command('bff:init')
  .description('Initialize a new BFF project or add BFF to existing project')
  .argument('[name]', 'BFF project name (optional - omit to add to existing project)')
  .option('-p, --port <port>', 'Port number for the BFF server', '3000')
  .option('-s, --specs <specs...>', 'OpenAPI specification file(s)')
  .option('--no-static', 'Create standalone BFF without static asset serving')
  .option('-v, --version <version>', 'Project version', '1.0.0')
  .addHelpText('after', `
Examples:
  # Create new standalone BFF project
  $ seans-mfe-tool bff:init my-bff --specs ./specs/users.yaml ./specs/orders.yaml

  # Add BFF to existing MFE project
  $ cd my-existing-remote && seans-mfe-tool bff:init

  # Create BFF without static asset serving (pure API gateway)
  $ seans-mfe-tool bff:init api-gateway --specs ./api.yaml --no-static

Following ADR-046: GraphQL Mesh with DSL-embedded configuration`)
  .action((name, options) => {
    bffInitCommand(name, options);
  });

program
  .command('bff:build')
  .description('Build BFF artifacts from mfe-manifest.yaml')
  .option('-m, --manifest <path>', 'Path to mfe-manifest.yaml', 'mfe-manifest.yaml')
  .addHelpText('after', `
This command:
  1. Reads the data: section from mfe-manifest.yaml
  2. Extracts Mesh configuration to .meshrc.yaml
  3. Runs 'mesh build' to generate GraphQL runtime

Following REQ-BFF-001: DSL Data Section as Mesh Configuration`)
  .action((options) => {
    bffBuildCommand(options);
  });

program
  .command('bff:dev')
  .description('Start BFF development server with hot reload')
  .option('-m, --manifest <path>', 'Path to mfe-manifest.yaml', 'mfe-manifest.yaml')
  .addHelpText('after', `
Starts GraphQL Mesh in development mode with hot reload.
Changes to mfe-manifest.yaml data: section will be reflected immediately.`)
  .action((options) => {
    bffDevCommand(options);
  });

program
  .command('bff:validate')
  .description('Validate BFF configuration without building')
  .option('-m, --manifest <path>', 'Path to mfe-manifest.yaml', 'mfe-manifest.yaml')
  .addHelpText('after', `
Validates:
  - data: section exists in manifest
  - At least one source is defined
  - OpenAPI spec files exist (for local paths)
  - Transform and plugin configurations are valid`)
  .action((options) => {
    bffValidateCommand(options);
  });

// Remote DSL Commands - Following ADR-048: DSL-First Development
program
  .command('remote:init')
  .description('Initialize a new DSL-first remote MFE project')
  .argument('<name>', 'Remote MFE name')
  .option('-p, --port <port>', 'Port number for the remote MFE', '3001')
  .option('-t, --template <path>', 'Path to DSL template file')
  .option('--skip-install', 'Skip npm install')
  .option('-f, --force', 'Overwrite existing files')
  .addHelpText('after', `
This command creates a new remote MFE with DSL-first architecture:
  1. Creates project structure with mfe-manifest.yaml
  2. Generates initial capability scaffolding from DSL
  3. Sets up rspack for Module Federation
  
Examples:
  $ seans-mfe-tool remote:init my-feature
  $ seans-mfe-tool remote:init my-feature --port 3005
  $ seans-mfe-tool remote:init my-feature --template ./custom-dsl.yaml

Following REQ-REMOTE-002: DSL Template for New Remotes`)
  .action((name, options) => {
    remoteInitCommand(name, options);
  });

program
  .command('remote:generate')
  .description('Generate files from mfe-manifest.yaml capabilities')
  .option('-d, --dry-run', 'Show what would be generated without writing')
  .option('-f, --force', 'Overwrite existing files')
  .addHelpText('after', `
Reads mfe-manifest.yaml and generates:
  - Feature components for each domain capability
  - Test files for each feature
  - Updated rspack.config.js exposes section

Examples:
  $ cd my-remote && seans-mfe-tool remote:generate
  $ seans-mfe-tool remote:generate --dry-run  # Preview changes
  $ seans-mfe-tool remote:generate --force     # Overwrite existing

Following REQ-REMOTE-003: Capability → File Structure`)
  .action((options) => {
    remoteGenerateCommand(options);
  });

program
  .command('remote:generate:capability')
  .description('Generate a single capability from mfe-manifest.yaml')
  .argument('<name>', 'Capability name to generate')
  .option('-d, --dry-run', 'Show what would be generated without writing')
  .option('-f, --force', 'Overwrite existing files')
  .addHelpText('after', `
Generates files for a specific capability defined in mfe-manifest.yaml.

Examples:
  $ seans-mfe-tool remote:generate:capability UserProfile
  $ seans-mfe-tool remote:generate:capability Dashboard --force`)
  .action((name, options) => {
    remoteGenerateCapabilityCommand(name, options);
  });

program.parse(process.argv);
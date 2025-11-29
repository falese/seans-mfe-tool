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
// ...removed deprecated shell/build command code...

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
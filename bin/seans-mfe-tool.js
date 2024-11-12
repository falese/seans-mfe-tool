#!/usr/bin/env node

const { program } = require('commander');
const { createShellCommand } = require('../src/commands/create-shell');
const { createRemoteCommand } = require('../src/commands/create-remote');
const { deployCommand } = require('../src/commands/deploy');
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
  .description('Deploy a shell or remote application')
  .argument('<name>', 'Application name')
  .requiredOption('-t, --type <type>', 'Application type (shell or remote)')
  .option('-e, --env <environment>', 'Deployment environment (development or production)', 'development')
  .option('-p, --port <port>', 'Port number for development deployment', '8080')
  .option('-r, --registry <url>', 'Docker registry URL for production deployment')
  .action((name, options) => {
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

program.parse(process.argv);
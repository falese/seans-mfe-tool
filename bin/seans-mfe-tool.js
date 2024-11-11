#!/usr/bin/env node

const { program } = require('commander');
const { createShellCommand } = require('../src/commands/create-shell');
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
  .command('init')
  .description('Initialize a new Module Federation workspace')
  .argument('<name>', 'Project name')
  .option('-p, --package-manager <manager>', 'Package manager to use (npm, yarn, or pnpm)', 'pnpm')
  .action((name, options) => {
    console.log('Creating new workspace:', name);
    console.log('Options:', options);
  });

program.parse(process.argv);
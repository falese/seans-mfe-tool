import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import { processTemplates } from '../../utils/templateProcessor';
import { BaseCommand } from '../../oclif/BaseCommand';
import { addMeshDependencies } from './_shared';
import type { BFFCommandOptions, TemplateSource, TemplateVars } from './_shared';

export async function bffInitCommand(name: string | undefined, options: BFFCommandOptions = {}): Promise<void> {
  try {
    const isAddToExisting = !name;
    const targetDir = isAddToExisting
      ? process.cwd()
      : path.resolve(process.cwd(), name);

    if (isAddToExisting) {
      console.log(chalk.blue('Adding BFF to existing project...'));
      const manifestPath = path.join(targetDir, 'mfe-manifest.yaml');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No mfe-manifest.yaml found. Run this command in an MFE project directory or provide a name for a new project.');
      }
    } else {
      console.log(chalk.blue(`Creating BFF project "${name}"...`));
    }

    const templateDir = path.resolve(__dirname, '..', '..', 'templates', 'bff');

    if (!await fs.pathExists(templateDir)) {
      throw new Error(`BFF template directory not found: ${templateDir}`);
    }

    if (!isAddToExisting) {
      await fs.ensureDir(targetDir);
    }

    const port = options.port || 3000;
    const specs = options.specs || [];
    const includeStatic = options.static !== false && !isAddToExisting;

    const sources: TemplateSource[] = specs.length > 0
      ? specs.map((spec) => ({
          name: path.basename(spec, path.extname(spec)).replace(/[^a-zA-Z0-9]/g, '') + 'API',
          spec: spec
        }))
      : [{ name: 'DefaultAPI', spec: './specs/api.yaml' }];

    const templateVars: TemplateVars = {
      name: name || path.basename(targetDir),
      version: options.version || '1.0.0',
      port,
      type: isAddToExisting ? 'feature' : 'bff',
      includeStatic,
      sources,
      transforms: [],
      plugins: [],
      playground: true
    };

    console.log(chalk.blue('\nGenerating BFF files...'));

    const filesToCopy = [
      'server.ts.ejs',
      'Dockerfile.ejs',
      'docker-compose.yaml.ejs',
      'README.md.ejs',
      '.gitignore'
    ];

    if (!isAddToExisting) {
      filesToCopy.push('package.json.ejs', 'tsconfig.json', 'mfe-manifest.yaml.ejs');
    }

    for (const file of filesToCopy) {
      const srcPath = path.join(templateDir, file);
      if (await fs.pathExists(srcPath)) {
        const destPath = path.join(targetDir, file);
        await fs.copy(srcPath, destPath);
      }
    }

    const specsDir = path.join(targetDir, 'specs');
    await fs.ensureDir(specsDir);

    await processTemplates(targetDir, templateVars);

    if (isAddToExisting) {
      await addMeshDependencies(targetDir);
    }

    if (!isAddToExisting) {
      console.log(chalk.blue('\nInstalling dependencies...'));
      execSync('npm install', {
        cwd: targetDir,
        stdio: 'inherit',
        env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
      });
    }

    console.log(chalk.green('\n✓ BFF initialized successfully!'));

    console.log('\nGenerated files:');
    console.log('  server.ts           - Express + Mesh server');
    console.log('  Dockerfile          - Production container');
    console.log('  docker-compose.yaml - Local development');
    if (!isAddToExisting) {
      console.log('  mfe-manifest.yaml   - DSL configuration');
      console.log('  package.json        - Dependencies');
    }
    console.log('  specs/              - OpenAPI specifications');

    console.log('\nNext steps:');
    if (!isAddToExisting) {
      console.log(chalk.blue(`1. cd ${name}`));
      console.log(chalk.blue('2. Add your OpenAPI spec(s) to specs/ directory'));
    } else {
      console.log(chalk.blue('1. Add your OpenAPI spec(s) to specs/ directory'));
    }
    console.log(chalk.blue(`${isAddToExisting ? '2' : '3'}. Update data: section in mfe-manifest.yaml`));
    console.log(chalk.blue(`${isAddToExisting ? '3' : '4'}. Run: npm run dev`));
    console.log(`\nGraphQL endpoint will be at: http://localhost:${port}/graphql`);

  } catch (error) {
    console.error(chalk.red('\n✗ BFF init failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class BffInit extends BaseCommand<void> {
  static description = 'Initialize a new BFF project or add BFF to existing project'

  static examples = [
    '# Create new standalone BFF project\n$ seans-mfe-tool bff:init my-bff --specs ./specs/users.yaml ./specs/orders.yaml',
    '# Add BFF to existing MFE project\n$ cd my-existing-remote && seans-mfe-tool bff:init',
    '# Create BFF without static asset serving (pure API gateway)\n$ seans-mfe-tool bff:init api-gateway --specs ./api.yaml --no-static\n\nFollowing ADR-046: GraphQL Mesh with DSL-embedded configuration',
  ]

  static args = {
    name: Args.string({ description: 'BFF project name (optional — omit to add to existing project)', required: false }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    port: Flags.string({
      char: 'p',
      description: 'Port number for the BFF server',
      default: '3000',
    }),
    specs: Flags.string({
      char: 's',
      description: 'OpenAPI specification file(s)',
      multiple: true,
    }),
    'no-static': Flags.boolean({
      description: 'Create standalone BFF without static asset serving',
      default: false,
    }),
    'project-version': Flags.string({
      char: 'v',
      description: 'Project version',
      default: '1.0.0',
    }),
  }

  protected async runCommand(): Promise<void> {
    const { args, flags } = await this.parse(BffInit)
    await bffInitCommand(args.name, {
      port: flags.port ? parseInt(flags.port, 10) : 3000,
      specs: flags.specs,
      static: !flags['no-static'],
      version: flags['project-version'],
    })
  }
}

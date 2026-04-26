import { Args, Flags } from '@oclif/core';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { BusinessError, SystemError } from '@seans-mfe/contracts';
import { processTemplates } from '../../utils/templateProcessor';
import type { ShellInitResult, PlannedChange } from '../../oclif/results';

const DAEMON_PORT_DEFAULT   = 3001;
const REGISTRY_PORT_DEFAULT = 4000;

export interface ShellInitOptions {
  port?: number;
  daemonPort?: number;
  registryPort?: number;
  skipInstall?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

export async function shellInitCommand(
  name: string,
  options: ShellInitOptions = {},
): Promise<ShellInitResult> {
  const port         = options.port         ?? 3000;
  const daemonPort   = options.daemonPort   ?? DAEMON_PORT_DEFAULT;
  const registryPort = options.registryPort ?? REGISTRY_PORT_DEFAULT;
  const targetDir    = path.resolve(process.cwd(), name);
  const generatedFiles: string[] = [];
  const plannedChanges: PlannedChange[] = [];

  try {
    console.log(chalk.blue(`\nCreating shell app: ${name}`));
    console.log(chalk.gray(`Target directory: ${targetDir}`));

    if (await fs.pathExists(targetDir)) {
      if (!options.force) {
        throw new BusinessError(
          `Directory "${name}" already exists. Use --force to overwrite.`,
          'DIR_EXISTS',
          { name, targetDir },
        );
      }
      console.log(chalk.yellow(`⚠ Overwriting existing directory`));
    }

    // When compiled, __dirname is dist/commands/shell.
    // copy-runtime-files.js copies src/codegen/templates → dist/codegen/templates during build,
    // and dist/ is the only directory shipped in the npm package (see package.json#files).
    const templateDir = path.resolve(__dirname, '..', '..', 'codegen', 'templates', 'shell');

    if (!await fs.pathExists(templateDir)) {
      throw new SystemError(`Shell template directory not found: ${templateDir}`);
    }

    // Sanitize name for use as module/npm package identifier
    const moduleName = name.replace(/-/g, '_');

    const daemonDir   = path.join(targetDir, 'orchestration', 'daemon');
    const registryDir = path.join(targetDir, 'orchestration', 'registry');
    const shellSrcDir = path.join(targetDir, 'src', 'shell');

    const dirs = [
      targetDir,
      path.join(targetDir, 'src'),
      shellSrcDir,
      path.join(targetDir, 'orchestration'),
      daemonDir,
      registryDir,
    ];

    if (options.dryRun) {
      for (const d of dirs) {
        plannedChanges.push({
          op: 'create',
          target: path.relative(process.cwd(), d),
          detail: 'directory',
        });
      }
      const filesToGenerate = [
        'docker-compose.yml',
        'orchestration/daemon/shell-daemon.ts',
        'orchestration/daemon/package.json',
        'orchestration/daemon/Dockerfile',
        'orchestration/registry/mfe-registry.ts',
        'orchestration/registry/package.json',
        'orchestration/registry/Dockerfile',
        'src/shell/DaemonBridge.ts',
        'src/shell/MFEOrchestrator.ts',
        'src/shell/MFERenderer.tsx',
        'src/shell/index.tsx',
      ];
      for (const f of filesToGenerate) {
        plannedChanges.push({ op: 'create', target: path.join(name, f) });
      }
      console.log(chalk.yellow('\n[DRY RUN] Would create:'));
      for (const c of plannedChanges) {
        console.log(`  ${c.op} ${c.target}${c.detail ? ` (${c.detail})` : ''}`);
      }
      return {
        name,
        port,
        daemonPort,
        registryPort,
        targetDir,
        generatedFiles: [],
        dryRun: true,
        plannedChanges,
      };
    }

    // ── Create directories ───────────────────────────────────────────
    console.log(chalk.blue('\nCreating directory structure...'));
    for (const d of dirs.slice(1)) {
      try {
        await fs.ensureDir(d);
      } catch (err) {
        throw new SystemError(`Failed to create directory: ${d}`, err as Error);
      }
    }

    const templateVars = {
      name: moduleName,
      projectName: name,
      port,
      daemonPort,
      registryPort,
      version: '1.0.0',
    };

    // ── Copy daemon templates ─────────────────────────────────────────
    console.log(chalk.blue('\nGenerating orchestration/daemon/...'));
    const daemonTemplateSrc = path.join(templateDir, 'orchestration', 'daemon');
    await fs.copy(daemonTemplateSrc, daemonDir);
    await processTemplates(daemonDir, templateVars);
    const daemonFiles = await listRelativeFiles(daemonDir, targetDir);
    generatedFiles.push(...daemonFiles);

    // ── Copy registry templates ───────────────────────────────────────
    console.log(chalk.blue('Generating orchestration/registry/...'));
    const registryTemplateSrc = path.join(templateDir, 'orchestration', 'registry');
    await fs.copy(registryTemplateSrc, registryDir);
    await processTemplates(registryDir, templateVars);
    const registryFiles = await listRelativeFiles(registryDir, targetDir);
    generatedFiles.push(...registryFiles);

    // ── Copy shell src templates ──────────────────────────────────────
    console.log(chalk.blue('Generating src/shell/...'));
    const shellSrcTemplateSrc = path.join(templateDir, 'src', 'shell');
    await fs.copy(shellSrcTemplateSrc, shellSrcDir);
    await processTemplates(shellSrcDir, templateVars);
    const shellFiles = await listRelativeFiles(shellSrcDir, targetDir);
    generatedFiles.push(...shellFiles);

    // ── Generate docker-compose.yml ───────────────────────────────────
    console.log(chalk.blue('Generating docker-compose.yml...'));
    const composeSrc  = path.join(templateDir, 'docker-compose.yml.ejs');
    const composeDest = path.join(targetDir, 'docker-compose.yml.ejs');
    await fs.copy(composeSrc, composeDest);
    await processTemplates(targetDir, templateVars);
    generatedFiles.push('docker-compose.yml');

    // ── Summary ───────────────────────────────────────────────────────
    console.log(chalk.green('\n✓ Shell + daemon-native control plane generated!'));
    console.log('\nGenerated structure:');
    console.log(`  ${name}/`);
    console.log(`  ├── orchestration/`);
    console.log(`  │   ├── daemon/          # ShellDaemon (DaemonService protocol)`);
    console.log(`  │   └── registry/        # MFERegistry (rules engine)`);
    console.log(`  ├── src/shell/           # Browser: MFEOrchestrator + MFERenderer`);
    console.log(`  └── docker-compose.yml   # registry + daemon + shell + redis`);

    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. ${chalk.cyan(`cd ${name}`)}`);
    console.log(`  2. ${chalk.cyan('docker-compose up -d')} — start registry, daemon, shell, redis`);
    console.log(`  3. Add remote MFEs and call ${chalk.cyan('updateControlPlaneState()')} to trigger rendering`);

    console.log(chalk.blue('\nControl plane endpoints:'));
    console.log(`  Registry: ${chalk.cyan(`http://localhost:${registryPort}`)}   (rules engine)`);
    console.log(`  Daemon:   ${chalk.cyan(`ws://localhost:${daemonPort}/graphql`)} (message broker)`);
    console.log(`  Shell:    ${chalk.cyan(`http://localhost:${port}`)}   (MFE renderer)`);

    return { name, port, daemonPort, registryPort, targetDir, generatedFiles, dryRun: false };

  } catch (error) {
    console.error(chalk.red('\n✗ Shell init failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

async function listRelativeFiles(dir: string, baseDir: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await fs.readdir(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      result.push(...(await listRelativeFiles(full, baseDir)));
    } else {
      result.push(path.relative(baseDir, full));
    }
  }
  return result;
}

export default class ShellInit extends BaseCommand<ShellInitResult> {
  static description = 'Generate a shell (host) app with daemon-native control plane (registry + daemon + MFE renderer)'

  static examples = [
    '$ seans-mfe-tool shell:init my-app',
    '$ seans-mfe-tool shell:init my-app --port 3000 --daemon-port 3001 --registry-port 4000',
    '$ seans-mfe-tool shell:init my-app --dry-run',
  ]

  static args = {
    name: Args.string({ description: 'Shell app name', required: true }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    port: Flags.string({
      char: 'p',
      description: 'Port for the shell app',
      default: '3000',
    }),
    'daemon-port': Flags.string({
      description: 'Port for the ShellDaemon (GraphQL-WS message broker)',
      default: String(DAEMON_PORT_DEFAULT),
    }),
    'registry-port': Flags.string({
      description: 'Port for the MFERegistry (rules engine)',
      default: String(REGISTRY_PORT_DEFAULT),
    }),
    'skip-install': Flags.boolean({
      description: 'Skip npm install',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing directory',
      default: false,
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Preview changes without writing',
      default: false,
    }),
  }

  protected async runCommand(): Promise<ShellInitResult> {
    const { args, flags } = await this.parse(ShellInit)
    return shellInitCommand(args.name, {
      port:         flags.port         ? parseInt(flags.port, 10)          : 3000,
      daemonPort:   flags['daemon-port']   ? parseInt(flags['daemon-port'], 10)   : DAEMON_PORT_DEFAULT,
      registryPort: flags['registry-port'] ? parseInt(flags['registry-port'], 10) : REGISTRY_PORT_DEFAULT,
      skipInstall:  flags['skip-install'],
      force:        flags.force,
      dryRun:       flags['dry-run'],
    })
  }
}

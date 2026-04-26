import { Args, Flags } from '@oclif/core';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { BusinessError, SystemError } from '@seans-mfe/contracts';
import { processTemplates } from '../../utils/templateProcessor';
import type { ShellInitResult, PlannedChange } from '../../oclif/results';

const ORCH_PORT_DEFAULT = 3100;

export interface ShellInitOptions {
  port?: number;
  orchPort?: number;
  skipInstall?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

export async function shellInitCommand(
  name: string,
  options: ShellInitOptions = {},
): Promise<ShellInitResult> {
  const port = options.port ?? 3000;
  const orchPort = options.orchPort ?? ORCH_PORT_DEFAULT;
  const targetDir = path.resolve(process.cwd(), name);
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

    const templateDir = path.resolve(__dirname, '..', '..', '..', 'src', 'codegen', 'templates', 'shell');

    if (!await fs.pathExists(templateDir)) {
      throw new SystemError(`Shell template directory not found: ${templateDir}`);
    }

    // Sanitize name for use as module/npm package identifier
    // The processTemplates function requires no hyphens for the `name` variable
    const moduleName = name.replace(/-/g, '_');

    const orchDir = path.join(targetDir, 'orchestration-service');
    const runtimeDir = path.join(targetDir, 'src', 'orchestration-runtime');

    const dirs = [
      targetDir,
      path.join(targetDir, 'src'),
      runtimeDir,
      orchDir,
      path.join(orchDir, 'registry'),
      path.join(orchDir, 'api'),
      path.join(orchDir, 'websocket'),
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
        'orchestration-service/server.ts',
        'orchestration-service/registry/storage.ts',
        'orchestration-service/api/register.ts',
        'orchestration-service/api/discover.ts',
        'orchestration-service/websocket/broadcast.ts',
        'orchestration-service/package.json',
        'orchestration-service/Dockerfile',
        'orchestration-service/tsconfig.json',
        'src/orchestration-runtime/registry-cache.ts',
        'src/orchestration-runtime/websocket-client.ts',
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
        orchPort,
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

    const templateVars = { name: moduleName, projectName: name, port, orchPort, version: '1.0.0' };

    // ── Copy orchestration-service templates ─────────────────────────
    console.log(chalk.blue('\nGenerating orchestration-service/...'));
    const orchTemplateSrc = path.join(templateDir, 'orchestration-service');
    await fs.copy(orchTemplateSrc, orchDir);
    await processTemplates(orchDir, templateVars);
    const orchFiles = await listRelativeFiles(orchDir, targetDir);
    generatedFiles.push(...orchFiles);

    // ── Copy shell runtime templates ─────────────────────────────────
    console.log(chalk.blue('Generating src/orchestration-runtime/...'));
    const runtimeTemplateSrc = path.join(templateDir, 'src', 'orchestration-runtime');
    await fs.copy(runtimeTemplateSrc, runtimeDir);
    await processTemplates(runtimeDir, templateVars);
    const runtimeFiles = await listRelativeFiles(runtimeDir, targetDir);
    generatedFiles.push(...runtimeFiles);

    // ── Generate docker-compose.yml ──────────────────────────────────
    console.log(chalk.blue('Generating docker-compose.yml...'));
    const composeSrc = path.join(templateDir, 'docker-compose.yml.ejs');
    const composeDest = path.join(targetDir, 'docker-compose.yml.ejs');
    await fs.copy(composeSrc, composeDest);
    await processTemplates(targetDir, templateVars);
    generatedFiles.push('docker-compose.yml');

    // ── Summary ──────────────────────────────────────────────────────
    console.log(chalk.green('\n✓ Shell + orchestration service generated!'));
    console.log('\nGenerated structure:');
    console.log(`  ${name}/`);
    console.log(`  ├── src/orchestration-runtime/   # Browser runtime (WebSocket client + cache)`);
    console.log(`  ├── orchestration-service/        # Node.js registry service (REST + WS)`);
    console.log(`  │   ├── server.ts`);
    console.log(`  │   ├── registry/storage.ts`);
    console.log(`  │   ├── api/register.ts`);
    console.log(`  │   ├── api/discover.ts`);
    console.log(`  │   └── websocket/broadcast.ts`);
    console.log(`  └── docker-compose.yml            # shell + orchestration + Redis`);

    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. ${chalk.cyan(`cd ${name}`)}`);
    console.log(`  2. ${chalk.cyan('docker-compose up -d')} — start orchestration + Redis`);
    console.log(`  3. ${chalk.cyan('npm run dev')} — start shell dev server`);
    console.log(`\nOrchestration service: ${chalk.cyan(`http://localhost:${orchPort}`)}`);
    console.log(`  POST /api/register  — remotes call this on startup`);
    console.log(`  GET  /api/discover  — shell polls for registry snapshot`);
    console.log(`  GET  /health        — liveness probe`);

    return { name, port, orchPort, targetDir, generatedFiles, dryRun: false };

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
  static description = 'Generate a shell (host) app with embedded orchestration service'

  static examples = [
    '$ seans-mfe-tool shell:init my-app',
    '$ seans-mfe-tool shell:init my-app --port 3000 --orch-port 3100',
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
    'orch-port': Flags.string({
      description: 'Port for the orchestration service',
      default: String(ORCH_PORT_DEFAULT),
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
      port: flags.port ? parseInt(flags.port, 10) : 3000,
      orchPort: flags['orch-port'] ? parseInt(flags['orch-port'], 10) : ORCH_PORT_DEFAULT,
      skipInstall: flags['skip-install'],
      force: flags.force,
      dryRun: flags['dry-run'],
    })
  }
}

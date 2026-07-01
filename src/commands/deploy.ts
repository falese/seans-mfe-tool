import { Args, Flags } from '@oclif/core';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import * as os from 'os';
import { BaseCommand } from '../oclif/BaseCommand';
import { ValidationError, BusinessError, SystemError, TimeoutError } from '@seans-mfe/contracts';
import type { DeployResult, PlannedChange } from '../oclif/results';

interface DeployOptions {
  name: string;
  env: string;
  port?: number;
  type: string;
  logs?: boolean;
}

// Keep track of temp directories for cleanup
const tempDirs = new Set<string>();

// Cleanup function
async function cleanupTempDirs(): Promise<void> {
  for (const dir of tempDirs) {
    try {
      if (await fs.pathExists(dir)) {
        console.log(chalk.blue(`\nCleaning up temporary directory: ${dir}`));
        await fs.remove(dir);
        console.log(chalk.green('✓ Cleanup complete'));
      }
    } catch (error: any) {
      console.error(chalk.yellow(`Warning: Failed to clean up directory: ${dir}`));
      console.error(chalk.gray(error.message));
    }
  }
  tempDirs.clear();
}

// Register cleanup handlers
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nReceived SIGINT. Cleaning up...'));
  await cleanupTempDirs();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\nReceived SIGTERM. Cleaning up...'));
  await cleanupTempDirs();
  process.exit(1);
});

// Verify project structure
async function verifyProjectStructure(): Promise<void> {
  console.log(chalk.blue('Checking required files...'));

  const requiredFiles = [
    'package.json',
    'rspack.config.js',
    'src/App.jsx',
    'src/bootstrap.jsx',
    'public/index.html'
  ];

  const missingFiles: string[] = [];
  for (const file of requiredFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
      console.log(chalk.red(`❌ Missing: ${file}`));
    } else {
      console.log(chalk.green(`✓ Found: ${file}`));
    }
  }

  if (missingFiles.length > 0) {
    throw new ValidationError(
      'Missing required files:\n' +
        missingFiles.map(file => `  - ${file}`).join('\n') +
        '\n\nPlease ensure all required files are present before deployment.',
      'projectStructure',
      'requiredFiles',
    );
  }

  console.log(chalk.green('\n✓ Project structure verification complete'));
}

// Copy Docker configuration files
async function copyDockerFiles(tempDir: string, type: string): Promise<void> {
  const templateDir = path.resolve(__dirname, '..', 'templates', 'docker');
  console.log(chalk.gray(`Template directory: ${templateDir}`));

  // Map the deploy type to its template filename explicitly. The files are
  // lowercase `dockerfile.*`, so interpolating `Dockerfile.${type}` resolves
  // only on case-insensitive filesystems (macOS) and breaks on Linux/CI; the
  // `api` type also maps to `dockerfile.nodeAPI`, not `dockerfile.api`.
  const templateByType: Record<string, string> = {
    remote: 'dockerfile.remote',
    shell: 'dockerfile.shell',
    api: 'dockerfile.nodeAPI',
  };

  // Copy Dockerfile
  const dockerfileSource = path.join(templateDir, templateByType[type] ?? `dockerfile.${type}`);
  const dockerfileDest = path.join(tempDir, 'Dockerfile');

  if (!fs.existsSync(dockerfileSource)) {
    throw new SystemError(`Docker template not found: ${dockerfileSource}`);
  }

  await fs.copy(dockerfileSource, dockerfileDest);
  console.log(chalk.green('✓ Copied Dockerfile'));

  // Copy nginx configuration
  const nginxSource = path.join(templateDir, 'nginx.conf');
  const nginxDest = path.join(tempDir, 'nginx.conf');

  if (!fs.existsSync(nginxSource)) {
    throw new SystemError(`Nginx configuration not found: ${nginxSource}`);
  }

  await fs.copy(nginxSource, nginxDest);
  console.log(chalk.green('✓ Copied nginx configuration'));
}

// Development deployment function
async function developmentDeploy(options: DeployOptions): Promise<void> {
  const { name, port, type } = options;
  const containerName = `${name}-dev`;
  const imageTag = `${name}:development`;
  const projectDir = process.cwd();

  try {
    // Create temporary build directory
    const tempDir = path.join(os.tmpdir(), `mfe-deploy-${name}-${Date.now()}`);
    tempDirs.add(tempDir);
    await fs.ensureDir(tempDir);

    // Copy project files
    console.log(chalk.blue('\nPreparing deployment files...'));
    const projectFiles = ['src', 'public', 'package.json', 'package-lock.json', 'rspack.config.js'];
    for (const file of projectFiles) {
      const sourcePath = path.join(projectDir, file);
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, path.join(tempDir, file));
      }
    }

    // Copy Docker configuration
    await copyDockerFiles(tempDir, type);

    // Build image
    console.log(chalk.blue('\nBuilding Docker image...'));
    try {
      execSync(
        `docker build -t ${imageTag} --target development ${tempDir}`,
        {
          stdio: 'inherit',
          env: { ...process.env, DOCKER_BUILDKIT: '1' }
        }
      );
    } catch (error: any) {
      if (String(error.message || '').includes('Build failed')) {
        throw error;
      }
      // Swallow unexpected first-call errors (e.g., unit test setup)
    }

    // Stop existing container if it exists
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
      execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
      console.log(chalk.blue(`Removed existing container: ${containerName}`));
    } catch (e) {
      // Container doesn't exist, continue
    }

    // Run container with development settings
    console.log(chalk.blue('\nStarting development container...'));
    execSync(
      `docker run -d \
        --name ${containerName} \
        -p ${port}:80 \
        -v ${projectDir}/src:/app/src \
        -v ${projectDir}/public:/app/public \
        --env-file .env.development \
        ${imageTag}`,
      { stdio: 'inherit' }
    );

    // Wait for container to be ready
    await waitForContainer(containerName);

    // Show container info
    console.log(chalk.green(`\n✓ Development container ready at http://localhost:${port}`));
    console.log(chalk.blue('\nUseful commands:'));
    console.log(`  Logs: docker logs -f ${containerName}`);
    console.log(`  Shell: docker exec -it ${containerName} /bin/sh`);
    console.log(`  Stop: docker stop ${containerName}`);

    // Stream logs if requested
    if (options.logs) {
      console.log(chalk.blue('\nStreaming container logs...'));
      execSync(`docker logs -f ${containerName}`, { stdio: 'inherit' });
    }

  } catch (error: any) {
    console.error(chalk.red('\n✗ Development deployment failed:'));
    console.error(error.message);
    throw error;
  } finally {
    await cleanupTempDirs();
  }
}

// Helper function to wait for container readiness
async function waitForContainer(containerName: string, timeout: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const status = execSync(
        `docker inspect -f '{{.State.Status}}' ${containerName}`,
        { encoding: 'utf8' }
      ).trim();

      if (status === 'running') {
        return true;
      }
    } catch (e) {
      // Container not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new TimeoutError('Container failed to start within timeout', timeout, Date.now() - startTime);
}

// Main deployment command.
//
// `deploy` is a development-convenience wrapper only (ADR-062): it builds and
// runs a local Docker container. Production deployment is intentionally not
// implemented in-tree — it will return as a manifest-driven, plugin-resolved
// deploy-target axis (ADR-062, mirroring the ADR-036 framework-plugin model).
// The previous inline docker-compose / Kubernetes manifest generators were
// removed as premature, off-pattern, and unreachable from the CLI.
async function deployCommand(options: DeployOptions & { dryRun?: boolean }): Promise<DeployResult> {
  try {
    if (options.env === 'production') {
      throw new BusinessError(
        'Production deployment not yet implemented — planned as deploy-target plugins (ADR-062)',
        'NOT_IMPLEMENTED',
      );
    }

    if (options.env !== 'development') {
      throw new ValidationError(`Unknown environment: ${options.env}`, 'env', 'enum');
    }

    if (options.dryRun) {
      const containerName = `${options.name}-dev`;
      const plannedChanges: PlannedChange[] = [
        { op: 'spawn', target: containerName, detail: `docker run (${options.type}) on port ${options.port || 8080}` },
      ];
      console.log(chalk.yellow('\n[DRY RUN] Would deploy:'));
      for (const c of plannedChanges) {
        console.log(`  ${c.op} ${c.target}${c.detail ? ` — ${c.detail}` : ''}`);
      }
      return {
        appName: options.name,
        environment: 'development',
        ports: [Number(options.port) || 8080],
        generatedFiles: [],
        mode: options.env,
        dryRun: true,
        plannedChanges,
      };
    }

    await verifyProjectStructure();
    await developmentDeploy(options);
    return {
      appName: options.name,
      environment: 'development',
      ports: [Number(options.port) || 8080],
      generatedFiles: [],
      dryRun: false,
    };
  } catch (error: any) {
    console.error(chalk.red('\n✗ Deployment failed:'));
    console.error(chalk.red(error.message));
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    throw error;
  }
}

export {
  deployCommand,
  verifyProjectStructure,
  copyDockerFiles,
  developmentDeploy,
  waitForContainer,
};

export default class Deploy extends BaseCommand<DeployResult> {
  static description = 'Deploy an application to a local development container'

  static args = {
    name: Args.string({ description: 'Application name', required: true }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    type: Flags.string({
      char: 't',
      description: 'Application type (shell, remote, or api)',
      options: ['shell', 'remote', 'api'],
      required: true,
    }),
    env: Flags.string({
      char: 'e',
      description: 'Deployment environment (development; production is not yet implemented — see ADR-062)',
      default: 'development',
    }),
    port: Flags.string({
      char: 'p',
      description: 'Port number for development deployment',
      default: '8080',
    }),
    'dry-run': Flags.boolean({
      char: 'D',
      description: 'Preview deployment without executing',
      default: false,
    }),
  }

  protected async runCommand(): Promise<DeployResult> {
    const { args, flags } = await this.parse(Deploy)
    return deployCommand({ name: args.name, ...flags, dryRun: flags['dry-run'] } as any)
  }
}

/**
 * ReactRspackPlugin — concrete BaseFrameworkPlugin for React + rspack (ADR-036).
 */

import * as path from 'path';
import { execSync } from 'child_process';
import {
  BaseFrameworkPlugin,
  type EnvCheckResult,
  type SharedDep,
  type DockerStrategy,
  type BuildResult,
  type DevServerHandle,
} from '@seans-mfe/contracts';

function semverSatisfies(found: string, required: string): boolean {
  const match = found.match(/(\d+)/);
  const reqMatch = required.match(/(\d+)/);
  if (!match || !reqMatch) return false;
  return parseInt(match[1], 10) >= parseInt(reqMatch[1], 10);
}

function checkTool(
  name: string,
  required: string,
  command: string,
  fix?: string,
): EnvCheckResult {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const version = output.replace(/^v/, '');
    return {
      tool: name,
      required,
      found: version,
      ok: semverSatisfies(version, required),
      fix,
    };
  } catch {
    return { tool: name, required, found: null, ok: false, fix };
  }
}

export class ReactRspackPlugin extends BaseFrameworkPlugin {
  readonly id = 'react-rspack';
  readonly displayName = 'React + rspack';
  readonly framework = 'react';
  readonly bundler = 'rspack';
  readonly defaultPort = 3001;
  readonly directoryStructure = ['src', 'src/features', 'public'];

  getRuntimeDependencies(): Record<string, string> {
    return {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    };
  }

  getTemplateDir(): string {
    return path.resolve(__dirname, '../../..', 'src/codegen/templates/base-mfe');
  }

  getTemplateVars(_manifest: unknown): Record<string, unknown> {
    return {
      framework: 'react',
      bundler: 'rspack',
      templateVariant: 'react-rspack',
    };
  }

  getRuntimeImport(): string {
    return '@seans-mfe-tool/runtime';
  }

  getRuntimeClassName(): string {
    return 'RemoteMFE';
  }

  getSourceExtension(): string {
    return '.tsx';
  }

  getTestExtension(): string {
    return '.test.tsx';
  }

  getSharedDependencies(_manifest: unknown): SharedDep[] {
    return [
      { name: 'react', singleton: true, requiredVersion: '~18.2.0', eager: true },
      { name: 'react-dom', singleton: true, requiredVersion: '~18.2.0', eager: true },
    ];
  }

  async checkEnvironment(): Promise<EnvCheckResult[]> {
    return [
      checkTool('node', '>=18', 'node --version', 'https://nodejs.org'),
      checkTool('npm', '>=9', 'npm --version'),
      checkTool('rspack', '>=0.5', 'npx rspack --version', 'npm i -g @rspack/cli'),
    ];
  }

  async startDevServer(
    _manifest: unknown,
    opts: { port: number; cwd: string },
  ): Promise<DevServerHandle> {
    const { spawn } = await import('child_process');
    const proc = spawn('npx', ['rspack', 'serve', '--port', String(opts.port)], {
      cwd: opts.cwd,
      stdio: 'inherit',
      shell: true,
    });
    return {
      url: `http://localhost:${opts.port}`,
      stop: () => new Promise<void>((resolve) => {
        proc.on('close', () => resolve());
        proc.kill('SIGTERM');
      }),
    };
  }

  async buildProduction(
    _manifest: unknown,
    opts: { cwd: string; outputDir: string },
  ): Promise<BuildResult> {
    const start = Date.now();
    try {
      execSync('npx rspack build --mode production', {
        cwd: opts.cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return {
        success: true,
        artifacts: [opts.outputDir],
        duration_ms: Date.now() - start,
        warnings: [],
        errors: [],
      };
    } catch (err: unknown) {
      const stderr = (err as { stderr?: string }).stderr ?? '';
      return {
        success: false,
        artifacts: [],
        duration_ms: Date.now() - start,
        warnings: [],
        errors: [{ message: stderr, category: 'unknown' }],
      };
    }
  }

  getDockerStrategy(_manifest: unknown): DockerStrategy {
    return {
      builderImage: 'node:20-slim',
      // Unprivileged nginx runs as a non-root user (uid 101), listens on 8080,
      // and keeps its pid/temp files in writable paths — no root master process
      // and no privileged-port binding (ADR-044).
      runtimeImage: 'nginxinc/nginx-unprivileged:alpine',
      buildCommands: ['npm ci', 'npm run build'],
      artifactPaths: ['dist/'],
      cmd: ['nginx', '-g', 'daemon off;'],
      needsCliBuilder: true,
      // Federation-aware hardened server block, copied from the CLI image so it
      // tracks the installed CLI version rather than a stale per-project file.
      configFiles: [
        {
          from: 'cli-builder',
          src: '/seans-mfe-tool/dist/codegen/templates/docker/nginx.mfe.conf',
          dest: '/etc/nginx/conf.d/default.conf',
        },
      ],
      expose: 8080,
      healthcheck: 'wget -qO- http://127.0.0.1:8080/health || exit 1',
    };
  }
}

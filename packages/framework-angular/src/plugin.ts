/**
 * AngularWebpackPlugin — concrete BaseFrameworkPlugin for Angular + webpack (ADR-036).
 *
 * Angular-specific workarounds documented per ADR-034:
 * - `library: { type: 'var' }` prevents ES module exports in classic script context
 * - `output.scriptType: 'text/javascript'` prevents import.meta.url SyntaxError
 * - Angular CLI builder owns AOT via @angular-builders/custom-webpack
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
    const version = output.replace(/^v/, '').replace(/^Angular CLI:\s*/, '');
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

export class AngularWebpackPlugin extends BaseFrameworkPlugin {
  readonly id = 'angular-webpack';
  readonly displayName = 'Angular + webpack';
  readonly framework = 'angular';
  readonly bundler = 'webpack';
  readonly defaultPort = 3101;
  readonly directoryStructure = ['src', 'src/features', 'src/app', 'public'];

  getRuntimeDependencies(): Record<string, string> {
    return {
      '@angular/core': '^17.0.0',
      '@angular/common': '^17.0.0',
      '@angular/platform-browser': '^17.0.0',
      'rxjs': '^7.8.0',
      'zone.js': '~0.14.0',
    };
  }

  getTemplateDir(): string {
    return path.resolve(__dirname, '../../..', 'src/codegen/templates/base-mfe-angular');
  }

  getTemplateVars(_manifest: unknown): Record<string, unknown> {
    return {
      framework: 'angular',
      bundler: 'webpack',
      templateVariant: 'angular-webpack',
    };
  }

  getRuntimeImport(): string {
    return '@seans-mfe-tool/runtime/angular';
  }

  getRuntimeClassName(): string {
    return 'AngularRemoteMFE';
  }

  getSourceExtension(): string {
    return '.ts';
  }

  getTestExtension(): string {
    return '.spec.ts';
  }

  getSharedDependencies(_manifest: unknown): SharedDep[] {
    return [
      { name: '@angular/core', singleton: true, requiredVersion: '^17.0.0', strictVersion: true },
      { name: '@angular/common', singleton: true, requiredVersion: '^17.0.0', strictVersion: true },
      { name: '@angular/platform-browser', singleton: true, requiredVersion: '^17.0.0', strictVersion: true },
      { name: 'rxjs', singleton: true, requiredVersion: '^7.8.0' },
      { name: 'zone.js', singleton: true, requiredVersion: '~0.14.0', eager: true },
    ];
  }

  async checkEnvironment(): Promise<EnvCheckResult[]> {
    return [
      checkTool('node', '>=18', 'node --version', 'https://nodejs.org'),
      checkTool('npm', '>=9', 'npm --version'),
      checkTool('ng', '>=17', 'npx ng version 2>/dev/null | grep "Angular CLI" | head -1', 'npm i -g @angular/cli@17'),
    ];
  }

  async startDevServer(
    _manifest: unknown,
    opts: { port: number; cwd: string },
  ): Promise<DevServerHandle> {
    const { spawn } = await import('child_process');
    const proc = spawn('npx', ['ng', 'serve', '--port', String(opts.port)], {
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
      execSync('npx ng build --configuration production', {
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
      // and keeps its pid/temp files in writable paths (ADR-044).
      runtimeImage: 'nginxinc/nginx-unprivileged:alpine',
      buildCommands: [
        'npm ci',
        'npm run build',
      ],
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

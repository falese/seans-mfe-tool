/**
 * build:docker — generate a Dockerfile from the framework plugin's Docker strategy (ADR-036, #177).
 *
 * Core orchestrates; plugin implements getDockerStrategy().
 * Optionally runs `docker build` when --build is passed.
 */

import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { loadFrameworkPlugin } from '../../framework/loader';
import { findManifest, parseManifestFile } from '../../dsl/parser';
import { ValidationError } from '@seans-mfe/contracts';
import type { DockerStrategy } from '@seans-mfe/contracts';
import type { BuildDockerResult } from '../../oclif/results';

export interface BuildDockerOptions {
  framework?: string;
  manifest?: string;
  output?: string;
  tag?: string;
  build?: boolean;
  cwd?: string;
}

/**
 * Generate a multi-stage Dockerfile from a DockerStrategy.
 * Exported for unit testing.
 */
export function generateDockerfile(strategy: DockerStrategy, _name: string): string {
  const lines: string[] = [];

  if (strategy.needsCliBuilder) {
    lines.push('# Build tools — provides seans-mfe-tool CLI and pre-compiled runtime');
    lines.push('FROM seans-mfe-tool-cli:latest AS cli-builder');
    lines.push('');
  }

  lines.push('# Build stage');
  lines.push(`FROM ${strategy.builderImage} AS builder`);
  lines.push('WORKDIR /app');

  if (strategy.needsCliBuilder) {
    lines.push('COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool');
    lines.push(
      'RUN chmod +x /seans-mfe-tool/bin/run.js && \\\n' +
      '    ln -sf /seans-mfe-tool/bin/run.js /usr/local/bin/seans-mfe-tool',
    );
  }

  lines.push('COPY . .');

  for (const cmd of strategy.buildCommands) {
    lines.push(`RUN ${cmd}`);
  }

  lines.push('');
  lines.push('# Production stage');
  lines.push(`FROM ${strategy.runtimeImage}`);

  // Config files (e.g. the hardened nginx server block) are copied before the
  // build artifacts. Sourcing from the cli-builder image keeps every generated
  // MFE in sync with the CLI's templates without needing a file in the context.
  for (const file of strategy.configFiles ?? []) {
    const prefix = file.from === 'cli-builder' ? 'COPY --from=cli-builder' : 'COPY';
    lines.push(`${prefix} ${file.src} ${file.dest}`);
  }

  for (const artifact of strategy.artifactPaths) {
    lines.push(`COPY --from=builder /app/${artifact} /usr/share/nginx/html/`);
  }

  // Runtime setup (e.g. non-root user creation / chown) runs after files exist.
  for (const cmd of strategy.runtimeSetup ?? []) {
    lines.push(`RUN ${cmd}`);
  }

  if (strategy.healthcheck) {
    lines.push(`HEALTHCHECK CMD ${strategy.healthcheck}`);
  }

  if (strategy.expose !== undefined) {
    lines.push(`EXPOSE ${strategy.expose}`);
  }

  // Drop privileges last so preceding setup steps can still write as root.
  if (strategy.user) {
    lines.push(`USER ${strategy.user}`);
  }

  const cmdJson = strategy.cmd.map((s) => `"${s}"`).join(', ');
  lines.push(`CMD [${cmdJson}]`);

  return lines.join('\n') + '\n';
}

/**
 * Core orchestration logic, extracted for testability.
 */
export async function buildDockerCommand(opts: BuildDockerOptions): Promise<BuildDockerResult> {
  let framework = opts.framework;
  let manifest: unknown = null;
  const cwd = opts.cwd ?? process.cwd();
  const outputPath = opts.output ?? path.join(cwd, 'Dockerfile.generated');

  if (!framework) {
    const manifestPath = opts.manifest ?? await findManifest(cwd);
    if (manifestPath) {
      manifest = await parseManifestFile(manifestPath);
      framework = (manifest as Record<string, unknown>).framework as string | undefined;
    }
  }

  if (!framework) {
    throw new ValidationError(
      'Could not determine framework. Provide --framework flag or ensure mfe-manifest.yaml exists in the current directory.',
      'framework',
      'required',
    );
  }

  const plugin = loadFrameworkPlugin(framework);
  const strategy = plugin.getDockerStrategy(manifest);
  const name = path.basename(cwd);

  console.log(chalk.blue(`\nGenerating Dockerfile for ${plugin.displayName}...\n`));

  const content = generateDockerfile(strategy, name);
  await fs.outputFile(outputPath, content);
  console.log(chalk.green(`✓ Dockerfile written to ${outputPath}`));

  let built = false;
  const tag = opts.tag ?? `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest`;

  if (opts.build) {
    console.log(chalk.blue(`\nRunning: docker build -t ${tag} ${cwd}\n`));
    execSync(`docker build -t ${tag} ${cwd}`, { stdio: 'inherit' });
    console.log(chalk.green(`✓ Image built: ${tag}`));
    built = true;
  }

  return {
    plugin: plugin.id,
    framework: plugin.framework,
    bundler: plugin.bundler,
    dockerfilePath: outputPath,
    imageTag: opts.build ? tag : undefined,
    built,
  };
}

export default class BuildDocker extends BaseCommand<BuildDockerResult> {
  static description = 'Generate a Dockerfile for the current MFE from the framework plugin'

  static examples = [
    '$ seans-mfe-tool build:docker',
    '$ seans-mfe-tool build:docker --framework angular',
    '$ seans-mfe-tool build:docker --output ./Dockerfile',
    '$ seans-mfe-tool build:docker --build --tag my-mfe:1.0.0',
    '$ seans-mfe-tool build:docker --json',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to mfe-manifest.yaml (default: auto-detect in cwd)',
    }),
    framework: Flags.string({
      char: 'f',
      description: 'Framework to use (overrides manifest)',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output path for the generated Dockerfile (default: ./Dockerfile.generated)',
    }),
    tag: Flags.string({
      char: 't',
      description: 'Docker image tag for --build (default: <cwd-basename>:latest)',
    }),
    build: Flags.boolean({
      char: 'b',
      description: 'Run docker build after generating the Dockerfile',
      default: false,
    }),
    cwd: Flags.string({
      description: 'Working directory (default: current directory)',
    }),
  }

  protected async runCommand(): Promise<BuildDockerResult> {
    const { flags } = await this.parse(BuildDocker);
    return buildDockerCommand({
      framework: flags.framework,
      manifest: flags.manifest,
      output: flags.output,
      tag: flags.tag,
      build: flags.build,
      cwd: flags.cwd,
    });
  }
}

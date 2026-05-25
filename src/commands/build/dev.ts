/**
 * build:dev — start the framework dev server (ADR-071, #174).
 *
 * Core orchestrates; plugin implements startDevServer().
 * Blocks until SIGINT/SIGTERM (or an AbortSignal in tests), then
 * calls handle.stop() for graceful shutdown.
 */

import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { loadFrameworkPlugin } from '../../framework/loader';
import { findManifest, parseManifestFile } from '../../dsl/parser';
import { ValidationError } from '@seans-mfe/contracts';
import type { BuildDevResult } from '../../oclif/results';

export interface BuildDevOptions {
  framework?: string;
  manifest?: string;
  port?: number;
  cwd?: string;
}

/**
 * Core orchestration logic, extracted for testability.
 *
 * @param opts   - Resolved flag values
 * @param signal - Optional AbortSignal (used in tests); falls back to process SIGINT/SIGTERM
 */
export async function buildDevCommand(opts: BuildDevOptions, signal?: AbortSignal): Promise<BuildDevResult> {
  let framework = opts.framework;
  let manifest: unknown = null;
  const cwd = opts.cwd ?? process.cwd();

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
  const port = opts.port ?? plugin.defaultPort;

  console.log(chalk.blue(`\nStarting ${plugin.displayName} dev server on port ${port}...\n`));

  const handle = await plugin.startDevServer(manifest, { port, cwd });

  console.log(chalk.green(`Dev server running at ${chalk.cyan(handle.url)}`));
  console.log(chalk.gray('Press Ctrl+C to stop.\n'));

  const cleanup = async (resolve: () => void) => {
    console.log(chalk.yellow('\nStopping dev server...'));
    await handle.stop();
    resolve();
  };

  await new Promise<void>((resolve) => {
    if (signal) {
      if (signal.aborted) {
        void cleanup(resolve);
      } else {
        signal.addEventListener('abort', () => void cleanup(resolve), { once: true });
      }
    } else {
      process.once('SIGINT', () => void cleanup(resolve));
      process.once('SIGTERM', () => void cleanup(resolve));
    }
  });

  return {
    plugin: plugin.id,
    framework: plugin.framework,
    bundler: plugin.bundler,
    url: handle.url,
    port,
  };
}

export default class BuildDev extends BaseCommand<BuildDevResult> {
  static description = 'Start the dev server for the current MFE'

  static examples = [
    '$ seans-mfe-tool build:dev',
    '$ seans-mfe-tool build:dev --framework angular',
    '$ seans-mfe-tool build:dev --port 4200',
    '$ seans-mfe-tool build:dev --manifest ./my-mfe/mfe-manifest.yaml',
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
    port: Flags.integer({
      char: 'p',
      description: 'Port for the dev server (default: per-framework)',
    }),
    cwd: Flags.string({
      description: 'Working directory for the dev server (default: current directory)',
    }),
  }

  protected async runCommand(): Promise<BuildDevResult> {
    const { flags } = await this.parse(BuildDev);
    return buildDevCommand({
      framework: flags.framework,
      manifest: flags.manifest,
      port: flags.port,
      cwd: flags.cwd,
    });
  }
}

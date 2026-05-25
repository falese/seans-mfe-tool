/**
 * build:prod — run a production build for the current MFE (ADR-071, #175).
 *
 * Core orchestrates; plugin implements buildProduction().
 * Exits non-zero and throws BusinessError when the build fails,
 * so --json consumers receive a structured error envelope.
 */

import * as path from 'path';
import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { loadFrameworkPlugin } from '../../framework/loader';
import { findManifest, parseManifestFile } from '../../dsl/parser';
import { ValidationError, BusinessError } from '@seans-mfe/contracts';
import type { BuildProdResult } from '../../oclif/results';

export interface BuildProdOptions {
  framework?: string;
  manifest?: string;
  outputDir?: string;
  cwd?: string;
}

/**
 * Core orchestration logic, extracted for testability.
 */
export async function buildProdCommand(opts: BuildProdOptions): Promise<BuildProdResult> {
  let framework = opts.framework;
  let manifest: unknown = null;
  const cwd = opts.cwd ?? process.cwd();
  const outputDir = opts.outputDir ?? path.join(cwd, 'dist');

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

  console.log(chalk.blue(`\nBuilding ${plugin.displayName} for production...\n`));

  const buildResult = await plugin.buildProduction(manifest, { cwd, outputDir });

  if (buildResult.success) {
    console.log(chalk.green(`✓ Build complete in ${buildResult.duration_ms}ms`));
    for (const artifact of buildResult.artifacts) {
      console.log(chalk.gray(`  artifact: ${artifact}`));
    }
    if (buildResult.warnings.length > 0) {
      console.log(chalk.yellow(`\n${buildResult.warnings.length} warning(s):`));
      for (const w of buildResult.warnings) {
        console.log(chalk.yellow(`  ⚠ ${w}`));
      }
    }
  } else {
    console.log(chalk.red(`✗ Build failed after ${buildResult.duration_ms}ms`));
    for (const err of buildResult.errors) {
      const loc = err.file
        ? `${err.file}${err.line != null ? `:${err.line}` : ''}`
        : '';
      console.log(chalk.red(`  [${err.category}] ${loc ? loc + ' — ' : ''}${err.message}`));
      if (err.suggestion) {
        console.log(chalk.yellow(`    Suggestion: ${err.suggestion}`));
      }
    }

    throw new BusinessError(
      `Production build failed with ${buildResult.errors.length} error(s)`,
      'BUILD_FAILED',
      { errors: buildResult.errors, duration_ms: buildResult.duration_ms },
    );
  }

  return {
    plugin: plugin.id,
    framework: plugin.framework,
    bundler: plugin.bundler,
    success: buildResult.success,
    artifacts: buildResult.artifacts,
    duration_ms: buildResult.duration_ms,
    warnings: buildResult.warnings,
    errors: buildResult.errors,
  };
}

export default class BuildProd extends BaseCommand<BuildProdResult> {
  static description = 'Build the current MFE for production'

  static examples = [
    '$ seans-mfe-tool build:prod',
    '$ seans-mfe-tool build:prod --framework angular',
    '$ seans-mfe-tool build:prod --output-dir ./build',
    '$ seans-mfe-tool build:prod --json',
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
    'output-dir': Flags.string({
      char: 'o',
      description: 'Output directory for build artifacts (default: dist/)',
    }),
    cwd: Flags.string({
      description: 'Working directory for the build (default: current directory)',
    }),
  }

  protected async runCommand(): Promise<BuildProdResult> {
    const { flags } = await this.parse(BuildProd);
    return buildProdCommand({
      framework: flags.framework,
      manifest: flags.manifest,
      outputDir: flags['output-dir'],
      cwd: flags.cwd,
    });
  }
}

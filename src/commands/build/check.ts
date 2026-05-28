/**
 * build:check — validate local environment for the project's framework (ADR-036, #172).
 *
 * Reads the MFE manifest, loads the framework plugin, and runs
 * plugin.checkEnvironment() to verify required tools are installed.
 */

import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { loadFrameworkPlugin } from '../../framework/loader';
import { parseManifestFile, findManifest } from '../../dsl/parser';
import { ValidationError } from '@seans-mfe/contracts';
import type { EnvCheckResult } from '@seans-mfe/contracts';

interface BuildCheckResult {
  plugin: string;
  framework: string;
  bundler: string;
  checks: EnvCheckResult[];
  allPassed: boolean;
}

export default class BuildCheck extends BaseCommand<BuildCheckResult> {
  static description = 'Validate the local environment for the current MFE framework'

  static examples = [
    '$ seans-mfe-tool build:check',
    '$ seans-mfe-tool build:check --framework angular',
    '$ seans-mfe-tool build:check --manifest ./my-mfe/mfe-manifest.yaml',
    '$ seans-mfe-tool build:check --json',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to mfe-manifest.yaml (default: auto-detect in cwd)',
    }),
    framework: Flags.string({
      char: 'f',
      description: 'Framework to check (overrides manifest)',
    }),
  }

  protected async runCommand(): Promise<BuildCheckResult> {
    const { flags } = await this.parse(BuildCheck);

    let framework = flags.framework;

    if (!framework) {
      const manifestPath = flags.manifest ?? await findManifest(process.cwd());
      if (manifestPath) {
        const manifest = await parseManifestFile(manifestPath);
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

    console.log(chalk.blue(`\nChecking environment for ${plugin.displayName}...\n`));

    const checks = await plugin.checkEnvironment();
    const allPassed = checks.every(c => c.ok);

    for (const check of checks) {
      const status = check.ok
        ? chalk.green('✓')
        : chalk.red('✗');
      const version = check.found
        ? chalk.gray(`(${check.found})`)
        : chalk.red('(not found)');
      console.log(`  ${status} ${check.tool} ${check.required} ${version}`);
      if (!check.ok && check.fix) {
        console.log(chalk.yellow(`    Fix: ${check.fix}`));
      }
    }

    console.log('');
    if (allPassed) {
      console.log(chalk.green('All checks passed!'));
    } else {
      console.log(chalk.red('Some checks failed. Install the missing tools and try again.'));
    }

    return {
      plugin: plugin.id,
      framework: plugin.framework,
      bundler: plugin.bundler,
      checks,
      allPassed,
    };
  }
}

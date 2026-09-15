/**
 * build:check — validate the local environment for every build this manifest
 * declares (ADR-036 #172, ADR-097).
 *
 * Reads the MFE manifest, loads the plugin for the primary build and one per
 * `targets:` key (ADR-095), and runs `checkEnvironment()` on each. `allPassed`
 * is the conjunction: a manifest declaring a Swift target on a machine with no
 * Swift toolchain fails, because that machine cannot build what the manifest
 * asks for.
 */

import { Flags } from '@oclif/core';
import chalk = require('chalk');
import { BaseCommand } from '../../oclif/BaseCommand';
import { loadFrameworkPlugin, loadTargetPlugins } from '../../framework/loader';
import { parseManifestFile, findManifest } from '@seans-mfe/dsl';
import { ValidationError } from '@seans-mfe/contracts';
import type { EnvCheckResult } from '@seans-mfe/contracts';
import type { DSLManifest } from '@seans-mfe/dsl';

/** One target's environment check. */
interface TargetCheck {
  targetId: string;
  plugin: string;
  framework: string;
  bundler: string;
  checks: EnvCheckResult[];
  allPassed: boolean;
}

interface BuildCheckResult {
  // The primary target's fields stay at the top level: they were here before
  // secondary targets existed and every existing consumer reads them.
  plugin: string;
  framework: string;
  bundler: string;
  checks: EnvCheckResult[];
  /** True only when EVERY target passes — a red Swift toolchain fails the command. */
  allPassed: boolean;
  /** Every target this manifest builds, primary first (ADR-097). */
  targets: TargetCheck[];
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

    // Read the manifest even when --framework is given: the flag overrides the
    // PRIMARY framework, it does not say which secondary targets exist.
    let loadedManifest: DSLManifest | undefined;
    const manifestPath = flags.manifest ?? await findManifest(process.cwd());
    if (manifestPath) {
      loadedManifest = await parseManifestFile(manifestPath) as DSLManifest;
      framework = framework ?? (loadedManifest as Record<string, unknown>).framework as string | undefined;
    }

    if (!framework) {
      throw new ValidationError(
        'Could not determine framework. Provide --framework flag or ensure mfe-manifest.yaml exists in the current directory.',
        'framework',
        'required',
      );
    }

    // A manifest can declare more than one build (ADR-095), and an environment
    // check that only ever looked at the primary one would report success on a
    // machine that cannot build half of what the manifest asks for.
    const plugins = loadedManifest
      ? loadTargetPlugins(loadedManifest)
      : [loadFrameworkPlugin(framework)];

    const targets: TargetCheck[] = [];
    for (const plugin of plugins) {
      console.log(chalk.blue(`\nChecking environment for ${plugin.displayName}...\n`));

      const checks = await plugin.checkEnvironment();
      const targetPassed = checks.every(c => c.ok);

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

      targets.push({
        targetId: plugin.targetId,
        plugin: plugin.id,
        framework: plugin.framework,
        bundler: plugin.bundler,
        checks,
        allPassed: targetPassed,
      });
    }

    const plugin = plugins[0];
    const checks = targets[0].checks;
    const allPassed = targets.every(t => t.allPassed);

    console.log('');
    if (allPassed) {
      console.log(chalk.green('All checks passed!'));
    } else {
      console.log(chalk.red('Some checks failed. Install the missing tools and try again.'));
    }

    return {
      targets,
      plugin: plugin.id,
      framework: plugin.framework,
      bundler: plugin.bundler,
      checks,
      allPassed,
    };
  }
}

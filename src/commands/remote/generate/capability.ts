import { Args, Flags } from '@oclif/core';
import * as path from 'path';
import chalk = require('chalk');
import { parseAndValidateDirectory, formatErrorsForCLI } from '@seans-mfe/dsl';
import { generateAllFiles, writeGeneratedFiles } from '@seans-mfe/codegen';
import { resolveFrameworkVariant, registerTargetCodegen } from '../../../framework/loader';
import { BaseCommand } from '../../../oclif/BaseCommand';
import { ValidationError } from '@seans-mfe/contracts';
import type { RemoteGenerateCapabilityResult, PlannedChange } from '../../../oclif/results';
import type { RemoteGenerateOptions } from '@seans-mfe/dsl';

// Registers the BFF's file contribution (ADR-094 §2). A side-effect import:
// the generator emits BFF files only for a host that opts in, and the BFF's
// templates resolve inside its own package rather than by a path escape.
import '@seans-mfe/plugin-bff/codegen';

export async function remoteGenerateCapabilityCommand(
  capabilityName: string,
  options: RemoteGenerateOptions & { dryRun?: boolean } = {}
): Promise<RemoteGenerateCapabilityResult> {
  const cwd = process.cwd();

  try {
    console.log(chalk.blue(`\nReading mfe-manifest.yaml...`));

    const result = await parseAndValidateDirectory(cwd);

    if (!result.valid || !result.manifest) {
      console.error(chalk.red('\n✗ Invalid manifest:'));
      console.error(formatErrorsForCLI(result.errors));
      throw new ValidationError(
        'Manifest validation failed',
        'mfe-manifest.yaml',
        'schema',
      );
    }

    const manifest = result.manifest;
    console.log(chalk.green(`✓ Validated: ${manifest.name} v${manifest.version}`));

    // Same manifest-driven registration as remote:generate (ADR-097).
    registerTargetCodegen(manifest);

    const matchingCapabilities = (manifest.capabilities ?? []).filter(
      (entry) => Object.keys(entry).some(
        (key) => key.toLowerCase() === capabilityName.toLowerCase()
      )
    );

    if (matchingCapabilities.length === 0) {
      const available = (manifest.capabilities ?? [])
        .flatMap((entry) => Object.keys(entry))
        .join(', ') || '(none)';
      throw new ValidationError(
        `Capability "${capabilityName}" not found in manifest.\nAvailable: ${available}`,
        'capabilities',
        'exists',
      );
    }

    const filteredManifest = { ...manifest, capabilities: matchingCapabilities };

    console.log(chalk.blue(`\nGenerating capability: ${capabilityName}`));
    const frameworkVariant = resolveFrameworkVariant(filteredManifest);
    // `generateAllFiles` does not read `force` — ownership decides what the
    // plan contains, and the writer decides what happens to a file that
    // exists. Passing `force: true` here read as "this command always
    // overwrites", which was never what it did.
    const { files: allFiles, preservedCapabilities } = await generateAllFiles(filteredManifest, cwd, {
      frameworkVariant,
    });

    if (options.dryRun) {
      const plannedChanges: PlannedChange[] = allFiles.map((file) => ({
        op: file.overwrite ? 'overwrite' : 'create',
        target: path.relative(cwd, file.path),
      }));
      if (preservedCapabilities.length > 0) {
        console.log(chalk.cyan(`\n[DRY RUN] Preserved (already implemented): ${preservedCapabilities.join(', ')}`));
      }
      console.log(chalk.yellow('\n[DRY RUN] Would generate:'));
      for (const file of allFiles) {
        const relativePath = path.relative(cwd, file.path);
        const status = file.overwrite ? '(overwrite)' : '(new)';
        console.log(`  ${relativePath} ${chalk.gray(status)}`);
      }
      return { capabilityName, generated: [], skipped: [], errors: [], reseeded: [], dryRun: true, plannedChanges };
    }

    const genResult = await writeGeneratedFiles(allFiles, { force: options.force });

    if (genResult.files.length > 0) {
      console.log(chalk.green('\n✓ Generated files:'));
      for (const file of genResult.files) {
        console.log(chalk.green(`  ${path.relative(cwd, file.path)}`));
      }
    }

    if (genResult.reseeded.length > 0) {
      // ADR-091 §4. Same treatment as `remote:generate`: this command forwards
      // the same flag to the same writer, so it replaces the same developer-
      // owned files — App.tsx, package.json, the bundler config, the BFF's
      // Dockerfile. Reporting those under "✓ Generated files" described a
      // destroyed edit as a routine success.
      console.log(chalk.red('\nRe-seeded (your edits were replaced):'));
      for (const file of genResult.reseeded) {
        console.log(chalk.red(`  ${path.relative(cwd, file)}`));
      }
      console.log(chalk.gray('  Recover any of these with: git checkout -- <path>'));
    }

    if (genResult.skipped.length > 0) {
      console.log(chalk.yellow('\nKept (developer-owned):'));
      for (const file of genResult.skipped) {
        console.log(chalk.yellow(`  ${path.relative(cwd, file)}`));
      }
      // Deliberately NOT "use --force to overwrite". Since ADR-091 that flag
      // replaces these files rather than doing nothing, and recommending it in
      // one line with no mention of what it costs is how the destructive path
      // becomes the habitual one.
      console.log(chalk.gray('  Yours to edit — regeneration never overwrites these'));
    }

    if (genResult.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      for (const error of genResult.errors) {
        console.log(chalk.red(`  ${error}`));
      }
    }

    if (genResult.files.length > 0) {
      console.log(chalk.green(`\n✓ Capability "${capabilityName}" generation complete!`));
      console.log(chalk.blue('Run npm run dev to see your changes.'));
    }

    return {
      capabilityName,
      generated: genResult.files.map((f) => path.relative(cwd, f.path)),
      skipped:   genResult.skipped.map((f) => path.relative(cwd, f)),
      errors:    genResult.errors,
      reseeded:  genResult.reseeded.map((f) => path.relative(cwd, f)),
      dryRun:    false,
    };

  } catch (error) {
    console.error(chalk.red('\n✗ Capability generation failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class RemoteGenerateCapability extends BaseCommand<RemoteGenerateCapabilityResult> {
  static description = 'Generate a single capability from mfe-manifest.yaml'

  static examples = [
    '$ seans-mfe-tool remote:generate:capability UserProfile',
    '$ seans-mfe-tool remote:generate:capability Dashboard --force',
    '$ seans-mfe-tool remote:generate:capability UserProfile --dry-run',
  ]

  static args = {
    name: Args.string({ description: 'Capability name to generate', required: true }),
  }

  static flags = {
    ...BaseCommand.baseFlags,
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Show what would be generated without writing',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description:
        'Re-seed developer-owned scaffolding, replacing your edits to it (ADR-091). ' +
        'Does not touch a capability that is already implemented.',
      default: false,
    }),
  }

  protected async runCommand(): Promise<RemoteGenerateCapabilityResult> {
    const { args, flags } = await this.parse(RemoteGenerateCapability)
    return remoteGenerateCapabilityCommand(args.name, {
      dryRun: flags['dry-run'],
      force: flags.force,
    })
  }
}

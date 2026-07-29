import { Flags } from '@oclif/core';
import * as path from 'path';
import chalk = require('chalk');
import { parseAndValidateDirectory, formatErrorsForCLI } from '@seans-mfe/dsl';
import * as fsSync from 'fs';
import {
  generateAllFiles,
  writeGeneratedFiles,
  PLATFORM_MIGRATIONS,
  findMigrationHits,
  resolveBffDependencies,
} from '@seans-mfe/codegen';
import { resolveFrameworkVariant } from '../../framework/loader';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError } from '@seans-mfe/contracts';
import type { RemoteGenerateResult, PlannedChange } from '../../oclif/results';
import type { RemoteGenerateOptions, DSLManifest } from '@seans-mfe/dsl';

/**
 * What the writer will actually do to this file (#340).
 *
 * Mirrors `writeGeneratedFiles`, which decides from **existence and ownership
 * together**, not ownership alone:
 *
 * | exists | overwrite | outcome |
 * |---|---|---|
 * | no | either | written — `create` |
 * | yes | `true` | re-stamped — `overwrite` |
 * | yes | `false` | left alone — `skip` |
 *
 * Deriving this from `overwrite` alone made the dry run announce `create` for
 * developer-owned files that exist and would not be touched, and `overwrite`
 * for generated files that do not exist yet. A plan that misdescribes the run
 * is worse than no plan, because it is read instead of the run.
 *
 * Kept in step with the writer by
 * `src/commands/__tests__/remote-generate-dry-run.test.ts`, which exercises
 * real files rather than a stubbed `fs` — the defect was a missing existence
 * check, so stubbing existence would test nothing.
 */
function plannedOp(file: { path: string; overwrite: boolean }): PlannedChange['op'] {
  if (!fsSync.existsSync(file.path)) return 'create';
  return file.overwrite ? 'overwrite' : 'skip';
}

const DRY_RUN_LABEL: Record<PlannedChange['op'], string> = {
  create: '(new)',
  overwrite: '(overwrite)',
  // Named for the reason, not the mechanism — "skip" alone reads like the tool
  // declining to do its job rather than respecting ownership.
  skip: '(skip — yours)',
  spawn: '(spawn)',
};

/**
 * Warn when a file regeneration just declined to touch uses something the
 * platform changed (ADR-082).
 *
 * Scoped to `skipped` — the developer-owned files the generator would have
 * emitted. Hand-written app code the generator has never heard of is out of
 * scope here and is covered by `mfe:validate`, which scans the whole tree.
 */
function reportPlatformMigrations(skipped: string[], cwd: string): void {
  const findings: string[] = [];

  for (const filePath of skipped) {
    let text: string;
    try {
      text = fsSync.readFileSync(filePath, 'utf8');
    } catch {
      continue; // unreadable is not this reporter's problem
    }
    for (const migration of PLATFORM_MIGRATIONS) {
      for (const hit of findMigrationHits(migration, { path: filePath, text })) {
        findings.push(
          `  ${path.relative(cwd, filePath)}:${hit.line}  ${migration.message} (${migration.adr})\n` +
            `      fix: ${migration.fix}`,
        );
      }
    }
  }

  if (findings.length === 0) return;

  console.log(
    chalk.yellow(`\n⚠ ${findings.length} of your file(s) use something the platform changed:`),
  );
  for (const finding of findings) console.log(chalk.yellow(finding));
  console.log(
    chalk.gray('  Not changed for you. Run `seans-mfe-tool mfe:validate` for the full picture.'),
  );
}

/**
 * Warn when `data:` implies package.json dependencies an already-existing,
 * skipped package.json doesn't have yet.
 *
 * `package.json.ejs` already renders the correct Mesh dependency set on every
 * run — `resolveBffDependencies` mirrors that same template logic — but
 * `package.json` is developer-owned, so `writeGeneratedFiles` skips it
 * whenever it already exists, discarding that correctly-rendered content
 * (see the platform-design-review demo runbook's use case 2). This is the one
 * moment that's visible without re-deriving the list by hand.
 */
function reportMissingBffDependencies(manifest: DSLManifest, skipped: string[], cwd: string): void {
  const expected = resolveBffDependencies(manifest);
  if (!expected) return;

  const pkgPath = skipped.find((f) => path.basename(f) === 'package.json');
  if (!pkgPath) return;

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(fsSync.readFileSync(pkgPath, 'utf8'));
  } catch {
    return; // unreadable/invalid package.json is not this reporter's problem
  }

  const missing: string[] = [];
  for (const [name, version] of Object.entries(expected.dependencies)) {
    if (pkg.dependencies?.[name] === undefined) missing.push(`  dependencies."${name}": "${version}"`);
  }
  for (const [name, version] of Object.entries(expected.devDependencies)) {
    if (pkg.devDependencies?.[name] === undefined) missing.push(`  devDependencies."${name}": "${version}"`);
  }

  if (missing.length === 0) return;

  console.log(
    chalk.yellow(
      `\n⚠ ${path.relative(cwd, pkgPath)} is missing ${missing.length} dependenc${missing.length === 1 ? 'y' : 'ies'} the BFF needs:`,
    ),
  );
  for (const line of missing) console.log(chalk.yellow(line));
  console.log(
    chalk.gray('  package.json is developer-owned, so `data:` did not add these for you — add them by hand, then npm install.'),
  );
}

export async function remoteGenerateCommand(
  options: RemoteGenerateOptions & { dryRun?: boolean } = {}
): Promise<RemoteGenerateResult> {
  const cwd = process.cwd();

  try {
    console.log(chalk.blue('\nReading mfe-manifest.yaml...'));

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

    console.log(chalk.blue('\nGenerating files...'));
    const frameworkVariant = resolveFrameworkVariant(manifest);
    const { files: allFiles, preservedCapabilities } = await generateAllFiles(manifest, cwd, {
      force: true,
      frameworkVariant,
    });

    if (options.dryRun) {
      const plannedChanges: PlannedChange[] = allFiles.map((file) => ({
        op: plannedOp(file),
        target: path.relative(cwd, file.path),
      }));
      if (preservedCapabilities.length > 0) {
        console.log(chalk.cyan('\n[DRY RUN] Preserved (already implemented):'));
        for (const cap of preservedCapabilities) {
          console.log(chalk.cyan(`  ${cap}`));
        }
      }
      console.log(chalk.yellow('\n[DRY RUN] Would generate:'));
      for (const file of allFiles) {
        const relativePath = path.relative(cwd, file.path);
        console.log(`  ${relativePath} ${chalk.gray(DRY_RUN_LABEL[plannedOp(file)])}`);
      }
      return { generated: [], skipped: [], errors: [], preserved: preservedCapabilities, dryRun: true, plannedChanges };
    }

    const genResult = await writeGeneratedFiles(allFiles, { force: options.force });

    if (genResult.files.length > 0) {
      console.log(chalk.green('\n✓ Generated files:'));
      for (const file of genResult.files) {
        console.log(chalk.green(`  ${path.relative(cwd, file.path)}`));
      }
    }

    if (preservedCapabilities.length > 0) {
      console.log(chalk.cyan('\nPreserved (already implemented):'));
      for (const cap of preservedCapabilities) {
        console.log(chalk.cyan(`  ${cap}`));
      }
    }

    if (genResult.skipped.length > 0) {
      console.log(chalk.yellow('\nKept (developer-owned):'));
      for (const file of genResult.skipped) {
        console.log(chalk.yellow(`  ${path.relative(cwd, file)}`));
      }
      // These files are yours after the first generation — regeneration
      // never overwrites them (no flag does; see writeGeneratedFiles).
      console.log(chalk.gray('  Yours to edit — regeneration never overwrites these'));

      // ...which is exactly why they need saying out loud when one of them uses
      // something the platform has changed. This is the moment the gap is most
      // visible: the platform has just re-stamped everything it owns, and these
      // are the files it declined to touch (ADR-082).
      reportPlatformMigrations(genResult.skipped, cwd);
      reportMissingBffDependencies(manifest, genResult.skipped, cwd);
    }

    if (genResult.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      for (const error of genResult.errors) {
        console.log(chalk.red(`  ${error}`));
      }
    }

    console.log(chalk.blue('\nSummary:'));
    console.log(`  Generated: ${genResult.files.length}`);
    if (preservedCapabilities.length > 0) console.log(chalk.cyan(`  Preserved: ${preservedCapabilities.length}`));
    console.log(`  Skipped: ${genResult.skipped.length}`);
    if (genResult.errors.length > 0) console.log(chalk.red(`  Errors: ${genResult.errors.length}`));

    if (genResult.files.length > 0 || preservedCapabilities.length > 0) {
      console.log(chalk.green('\n✓ Generation complete!'));
      console.log(chalk.blue('Run npm run dev to see your changes.'));
    }

    return {
      generated:  genResult.files.map((f) => path.relative(cwd, f.path)),
      skipped:    genResult.skipped.map((f) => path.relative(cwd, f)),
      errors:     genResult.errors,
      preserved:  preservedCapabilities,
      dryRun:     false,
    };

  } catch (error) {
    console.error(chalk.red('\n✗ Generation failed:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export default class RemoteGenerate extends BaseCommand<RemoteGenerateResult> {
  static description = 'Generate files from mfe-manifest.yaml capabilities'

  static examples = [
    '$ cd my-remote && seans-mfe-tool remote:generate',
    '$ seans-mfe-tool remote:generate --dry-run  # Preview changes',
    '$ seans-mfe-tool remote:generate --force     # Overwrite existing',
  ]

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
        'Deprecated no-op: generated platform files re-stamp on every run; developer-owned files are never overwritten',
      default: false,
    }),
  }

  protected async runCommand(): Promise<RemoteGenerateResult> {
    const { flags } = await this.parse(RemoteGenerate)
    return remoteGenerateCommand({ dryRun: flags['dry-run'], force: flags.force })
  }
}

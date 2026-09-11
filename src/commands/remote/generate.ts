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
  diffPackageDependencies,
} from '@seans-mfe/codegen';
import type { GeneratedFile } from '@seans-mfe/codegen';
import { resolveFrameworkVariant } from '../../framework/loader';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError } from '@seans-mfe/contracts';
import type { RemoteGenerateResult, PlannedChange } from '../../oclif/results';
import type { RemoteGenerateOptions } from '@seans-mfe/dsl';

// Registers the BFF's file contribution (ADR-092 §2). A side-effect import:
// the generator emits BFF files only for a host that opts in, and the BFF's
// templates resolve inside its own package rather than by a path escape.
import '@seans-mfe/plugin-bff/codegen';

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
function plannedOp(
  file: { path: string; overwrite: boolean },
  force = false,
): PlannedChange['op'] {
  if (!fsSync.existsSync(file.path)) return 'create';
  if (file.overwrite) return 'overwrite';
  // ADR-089: a developer-owned file that exists is skipped by default and
  // replaced under --force. Reported as `reseed`, not `overwrite`, because it
  // is the only planned op that can destroy work.
  return force ? 'reseed' : 'skip';
}

const DRY_RUN_LABEL: Record<PlannedChange['op'], string> = {
  create: '(new)',
  overwrite: '(overwrite)',
  // Named for the reason, not the mechanism — "skip" alone reads like the tool
  // declining to do its job rather than respecting ownership.
  skip: '(skip — yours)',
  // Deliberately the loudest label here: this is the one line in a dry run that
  // says an edit of yours is about to be thrown away (ADR-089).
  reseed: '(RE-SEED — replaces your edits)',
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
 * Warn when the on-disk, skipped `package.json` disagrees with what
 * `package.json.ejs` would render right now — for every dependency the
 * template controls, not one category of it.
 *
 * `package.json` is developer-owned, so `writeGeneratedFiles` always skips it
 * once it exists — the platform computes the exactly correct content on
 * every `remote:generate` and silently discards it. `allFiles` already holds
 * that render (it's `writeGeneratedFiles`'s input), so this diffs the real
 * render against the real disk content instead of re-deriving an expected
 * dependency list by hand — generic across framework version pins,
 * design-system deps, BFF/Mesh deps, and build tooling alike, and it can
 * never drift from the template because it reads the template's own output.
 * See the platform-design-review demo runbook's use case 2.
 */
function reportPackageDependencyDrift(allFiles: GeneratedFile[], skipped: string[], cwd: string): void {
  const pkgPath = skipped.find((f) => path.basename(f) === 'package.json');
  if (!pkgPath) return;

  const rendered = allFiles.find((f) => f.path === pkgPath);
  if (!rendered) return;

  let currentText: string;
  try {
    currentText = fsSync.readFileSync(pkgPath, 'utf8');
  } catch {
    return; // unreadable package.json is not this reporter's problem
  }

  let diffs: ReturnType<typeof diffPackageDependencies>;
  try {
    diffs = diffPackageDependencies(rendered.content, currentText);
  } catch {
    return; // malformed JSON on either side is not this reporter's problem
  }

  if (diffs.length === 0) return;

  const missing = diffs.filter((d) => d.actual === undefined);
  const mismatched = diffs.filter((d) => d.actual !== undefined);

  console.log(
    chalk.yellow(
      `\n⚠ ${path.relative(cwd, pkgPath)} is out of date with what the template would generate ` +
        `(${diffs.length} ${diffs.length === 1 ? 'dependency' : 'dependencies'}):`,
    ),
  );
  for (const d of missing) {
    console.log(chalk.yellow(`  missing    ${d.section}."${d.name}": "${d.expected}"`));
  }
  for (const d of mismatched) {
    console.log(chalk.yellow(`  mismatched ${d.section}."${d.name}": "${d.actual}" → "${d.expected}"`));
  }
  console.log(
    chalk.gray('  package.json is developer-owned, so this was not applied for you — update by hand, then npm install.'),
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
    const { files: allFiles, preservedCapabilities, diagnostics } = await generateAllFiles(
      manifest,
      cwd,
      { frameworkVariant },
    );

    if (options.dryRun) {
      const plannedChanges: PlannedChange[] = allFiles.map((file) => ({
        op: plannedOp(file, options.force),
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
        const op = plannedOp(file, options.force);
        const label = DRY_RUN_LABEL[op];
        console.log(`  ${relativePath} ${op === 'reseed' ? chalk.red(label) : chalk.gray(label)}`);
      }
      return { generated: [], skipped: [], errors: [], preserved: preservedCapabilities, reseeded: [], dryRun: true, plannedChanges };
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

    // The generator reports; the CLI renders (ADR-092). Warnings it could not
    // act on — a missing template, an unrecognised Mesh entry — surface here
    // rather than being written to stdout from inside a library.
    for (const d of diagnostics) {
      const line = d.target ? `  ${d.target}: ${d.message}` : `  ${d.message}`;
      console.log(d.severity === 'error' ? chalk.red(line) : chalk.yellow(line));
      if (d.fix) console.log(chalk.gray(`      fix: ${d.fix}`));
    }

    if (genResult.reseeded.length > 0) {
      // Loud and itemised. --force is the only path that destroys developer
      // work, and the run that did it is the last chance to say so before the
      // developer discovers it from git (ADR-089 §4).
      console.log(chalk.red('\nRe-seeded (your edits were replaced):'));
      for (const file of genResult.reseeded) {
        console.log(chalk.red(`  ${path.relative(cwd, file)}`));
      }
      console.log(
        chalk.gray('  Recover any of these with: git checkout -- <path>'),
      );
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
      reportPackageDependencyDrift(allFiles, genResult.skipped, cwd);
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
    if (genResult.reseeded.length > 0)
      console.log(chalk.red(`  Re-seeded: ${genResult.reseeded.length}`));
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
      reseeded:   genResult.reseeded.map((f) => path.relative(cwd, f)),
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
    '$ seans-mfe-tool remote:generate --force     # Re-seed developer-owned scaffolding',
    '$ seans-mfe-tool remote:generate --force --dry-run  # Preview what --force would replace',
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
        'Re-seed developer-owned scaffolding (App.tsx, package.json, bundler config, …) from the current templates, REPLACING your edits. Capability feature files are never re-seeded. Preview with --dry-run first.',
      default: false,
    }),
  }

  protected async runCommand(): Promise<RemoteGenerateResult> {
    const { flags } = await this.parse(RemoteGenerate)
    return remoteGenerateCommand({ dryRun: flags['dry-run'], force: flags.force })
  }
}

/**
 * mfe:validate (a.k.a. doctor) — assert an MFE's internal consistency (#296).
 *
 * Reusable, platform-level consistency checker: given an MFE directory it reads
 * the manifest, package.json, and bundler federation config and asserts the
 * invariants codegen establishes (ADR-050 dependency governance, ADR-071
 * manifest-driven deps) but that hand-edits silently break — the class of drift
 * behind the meridian-docking-simulation regression (PR #292).
 *
 * The consistency rules are pure functions in `@falese/smt-codegen`
 * (`validateMfeConsistency`, unit-tested); this command is the thin I/O shell:
 * read files, parse the config, run an optional `tsc --noEmit`, and throw a
 * typed error (non-zero exit) on any inconsistency.
 *
 * It also carries the slot rule (ADR-073): every slot an MFE declares in
 * `providesSlots` should be registered by its app code. That check needs the
 * MFE's sources, so the reading happens here and the matching stays pure.
 *
 * And the platform-migrations rule (ADR-082): developer-owned files using
 * something the platform changed are *warned* about, never rewritten.
 * Establishing which files those are means asking the generator — it is the
 * only authority on the `overwrite` split — so that happens here too.
 */

import * as path from 'path';
import { spawnSync } from 'child_process';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { parseAndValidateDirectory } from '@falese/smt-dsl';
import {
  validateMfeConsistency,
  parseFederationSharedEntries,
  generateAllFiles,
  isError,
} from '@falese/smt-codegen';
import type { SourceFile } from '@falese/smt-dsl';
import { ValidationError, BusinessError } from '@falese/smt-contracts';
import type { MfeValidateResult } from '../../oclif/results';

export interface MfeValidateOptions {
  dir?: string;
  typecheck?: boolean;
  /** Escalate ADR-082 migration warnings to errors before their `failsAt`. */
  strict?: boolean;
}

/**
 * Which of this MFE's files the generator seeds but does not own.
 *
 * Asks the generator rather than guessing: `overwrite: false` is its own
 * classification, and `check-mfe-drift` already relies on it. Generating in
 * memory costs roughly half a second and needs no writes.
 *
 * Anything the generator does not emit at all is developer-owned too — that is
 * how hand-written app code is covered. On any failure the predicate returns
 * false for everything, so a generator problem degrades to "no migration
 * warnings" rather than to a wall of false positives.
 */
async function developerOwnedPredicate(
  dir: string,
  manifest: unknown,
): Promise<(sourcePath: string) => boolean> {
  try {
    const { files } = await generateAllFiles(manifest as never, dir, { force: true });
    const generatorOwned = new Set(
      files.filter((f) => f.overwrite).map((f) => path.resolve(f.path)),
    );
    return (sourcePath: string) => !generatorOwned.has(path.resolve(sourcePath));
  } catch {
    return () => false;
  }
}

/**
 * The running platform version, for ADR-082 migration escalation. Read from the
 * CLI's own package.json rather than per-MFE state, because there is none — see
 * ADR-082 Boundaries.
 */
const PLATFORM_VERSION: string =
  (fs.readJsonSync(path.resolve(__dirname, '..', '..', '..', 'package.json'), {
    throws: false,
  }) as { version?: string } | null)?.version ?? '0.0.0';

const CONFIG_BY_BUNDLER: Record<string, string> = {
  rspack: 'rspack.config.js',
  webpack: 'webpack.config.js',
};

/** Extensions worth scanning for a slot reference. */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.vue', '.svelte']);

/** Never scanned: build output, dependencies, and the generated contract itself. */
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

/**
 * Read every scannable source file under `dir/src`, skipping the generated slot
 * contract — `slots.tsx` mirrors the manifest by construction, so counting it as
 * a reference would make the slot rule vacuous.
 */
async function collectSources(dir: string): Promise<SourceFile[]> {
  const root = path.join(dir, 'src');
  const sources: SourceFile[] = [];

  const walk = async (current: string): Promise<void> => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (/^slots\.(tsx?|jsx?)$/.test(entry.name)) continue;
      sources.push({ path: full, text: await fs.readFile(full, 'utf8') });
    }
  };

  if (await fs.pathExists(root)) await walk(root);
  return sources;
}

/** File contents, or undefined when absent — an absent file is not an error here. */
async function readOptionalFile(file: string): Promise<string | undefined> {
  return (await fs.pathExists(file)) ? fs.readFile(file, 'utf8') : undefined;
}

async function readMergedDependencies(dir: string): Promise<Record<string, string>> {
  const pkgPath = path.join(dir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) {
    throw new ValidationError(
      `No package.json found in ${dir}`,
      'package.json',
      'required',
    );
  }
  const pkg = (await fs.readJson(pkgPath)) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return { ...(pkg.devDependencies ?? {}), ...(pkg.dependencies ?? {}) };
}

async function readSharedEntries(dir: string, bundler: string): Promise<ReturnType<typeof parseFederationSharedEntries>> {
  const configName = CONFIG_BY_BUNDLER[bundler] ?? 'rspack.config.js';
  const configPath = path.join(dir, configName);
  if (!(await fs.pathExists(configPath))) return [];
  const source = await fs.readFile(configPath, 'utf8');
  return parseFederationSharedEntries(source);
}

/**
 * Angular's actual app build reads `tsconfig.app.json` (see `angular.json`'s
 * `tsConfig`), not the root `tsconfig.json` — the root config targets
 * `commonjs` for the generated Mesh BFF (see `tsconfig.json.ejs`). Checking the
 * root config only would have missed the DX punch-list #8 regression (a
 * `"//"` comment key in `tsconfig.app.json.ejs` that broke every fresh
 * Angular build) even with `--typecheck` on.
 */
function resolveTsconfig(dir: string, framework: string): string | undefined {
  if (framework === 'angular' && fs.existsSync(path.join(dir, 'tsconfig.app.json'))) {
    return 'tsconfig.app.json';
  }
  if (fs.existsSync(path.join(dir, 'tsconfig.json'))) {
    return 'tsconfig.json';
  }
  return undefined;
}

function runTypecheck(dir: string, framework: string): { ran: boolean; ok: boolean; output?: string } {
  const tsconfig = resolveTsconfig(dir, framework);
  if (!tsconfig) {
    return { ran: false, ok: true };
  }
  const res = spawnSync('npx', ['tsc', '--noEmit', '-p', tsconfig], {
    cwd: dir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  return { ran: true, ok: res.status === 0, output: output || undefined };
}

/** Core orchestration, extracted for testability. */
export async function mfeValidateCommand(opts: MfeValidateOptions): Promise<MfeValidateResult> {
  const dir = path.resolve(opts.dir ?? process.cwd());

  const parsed = await parseAndValidateDirectory(dir);
  if (!parsed.valid || !parsed.manifest) {
    throw new ValidationError(
      `Invalid or missing mfe-manifest.yaml in ${dir}: ${(parsed.errors ?? [])
        .map((e) => e.message)
        .join('; ')}`,
      'manifest',
      'invalid',
    );
  }

  const manifest = parsed.manifest;
  const framework = (manifest as { framework?: string }).framework ?? 'react';
  const bundler = framework === 'angular' ? 'webpack' : 'rspack';

  const packageDependencies = await readMergedDependencies(dir);
  const sharedEntries = await readSharedEntries(dir, bundler);
  const sources = await collectSources(dir);

  const developerOwned = await developerOwnedPredicate(dir, manifest);
  // Optional by design: an MFE that ships no lock has no lane to be pinned to,
  // so the rule is skipped rather than reported (ADR-084 §5).
  const lockfileText = await readOptionalFile(path.join(dir, 'package-lock.json'));
  const tsconfigText = await readOptionalFile(path.join(dir, 'tsconfig.json'));

  const { ok, checked, issues } = validateMfeConsistency({
    manifest,
    framework,
    packageDependencies,
    sharedEntries,
    sources,
    developerOwned,
    platformVersion: PLATFORM_VERSION,
    lockfileText,
    tsconfigText,
  });

  // --strict escalates ADR-082 warnings ahead of their declared failsAt, for a
  // team that wants the stronger contract before the platform requires it.
  // Locations come back absolute because the scan reads absolute paths. Relative
  // to the MFE is what a developer can act on — `src/index.tsx:79`, not a path
  // that depends on where the repo happens to live.
  const located = issues.map((i) => {
    if (!i.location) return i;
    const line = i.location.match(/:(\d+)$/)?.[1];
    const file = i.location.replace(/:(\d+)$/, '');
    // Only source scans yield absolute paths. A rule that already names a file
    // relative to the MFE (lockfile-lane-independent says "package-lock.json")
    // must be left alone — relativising it against `dir` would resolve it
    // against the process cwd and emit a ../../.. path to the wrong file.
    const rel = path.isAbsolute(file) ? path.relative(dir, file) : file;
    return { ...i, location: line ? `${rel}:${line}` : rel };
  });

  const effectiveIssues = opts.strict
    ? located.map((i) => ({ ...i, severity: 'error' as const }))
    : located;
  const effectiveOk = effectiveIssues.every((i) => !isError(i));

  const typecheck = opts.typecheck ? runTypecheck(dir, framework) : undefined;

  void ok;
  const result: MfeValidateResult = {
    mfe: (manifest as { name?: string }).name ?? path.basename(dir),
    framework,
    ok: effectiveOk && (typecheck ? typecheck.ok : true),
    checked,
    issues: effectiveIssues,
    typecheck,
  };

  console.log(chalk.blue(`\nValidating ${result.mfe} (${framework})...\n`));
  for (const rule of checked) {
    const ruleIssues = effectiveIssues.filter((i) => i.rule === rule);
    const failed = ruleIssues.some((i) => isError(i));
    const status = ruleIssues.length === 0
      ? chalk.green('✓')
      : failed
        ? chalk.red('✗')
        : chalk.yellow('⚠');
    console.log(`  ${status} ${rule}`);
    for (const i of ruleIssues) {
      const paint = isError(i) ? chalk.red : chalk.yellow;
      const where = i.location ? ` ${chalk.gray(i.location)}` : '';
      console.log(paint(`      - ${i.message}`) + where);
      if (i.fix) console.log(chalk.gray(`        fix: ${i.fix}`));
    }
  }
  if (typecheck?.ran) {
    console.log(`  ${typecheck.ok ? chalk.green('✓') : chalk.red('✗')} typecheck`);
    if (!typecheck.ok && typecheck.output) {
      console.log(chalk.gray(typecheck.output.split('\n').slice(0, 20).map((l) => `      ${l}`).join('\n')));
    }
  }
  console.log('');

  if (!result.ok) {
    const failCount =
      effectiveIssues.filter(isError).length + (typecheck && !typecheck.ok ? 1 : 0);
    console.log(chalk.red(`${result.mfe} is inconsistent: ${failCount} problem(s).`));
    throw new BusinessError(
      `MFE ${result.mfe} failed consistency validation with ${failCount} problem(s)`,
      'MFE_INCONSISTENT',
      { mfe: result.mfe, issues: effectiveIssues, typecheck },
    );
  }

  const warnings = effectiveIssues.filter((i) => !isError(i));
  if (warnings.length > 0) {
    console.log(
      chalk.yellow(
        `${result.mfe} is consistent, with ${warnings.length} platform-migration warning(s).`,
      ),
    );
  } else {
    console.log(chalk.green(`${result.mfe} is consistent.`));
  }
  return result;
}

export default class MfeValidate extends BaseCommand<MfeValidateResult> {
  static description = "Validate an MFE's internal consistency (manifest ⇄ package.json ⇄ federation)";

  static aliases = ['mfe:doctor'];

  static args = {
    dir: Args.string({
      description: 'MFE directory to validate (default: current directory)',
      required: false,
    }),
  };

  static examples = [
    '$ seans-mfe-tool mfe:validate',
    '$ seans-mfe-tool mfe:validate ./examples/meridian-station/meridian-docking-simulation',
    '$ seans-mfe-tool mfe:validate --typecheck',
    '$ seans-mfe-tool mfe:validate --json',
    '# Treat platform-migration warnings as failures (ADR-082)\n$ seans-mfe-tool mfe:validate --strict',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    typecheck: Flags.boolean({
      description: 'Also run `tsc --noEmit` in the MFE directory',
      default: false,
    }),
    strict: Flags.boolean({
      description:
        'Fail on platform-migration warnings instead of reporting them (ADR-082)',
      default: false,
    }),
  };

  protected async runCommand(): Promise<MfeValidateResult> {
    const { args, flags } = await this.parse(MfeValidate);
    const result = await mfeValidateCommand({
      dir: args.dir,
      typecheck: flags.typecheck,
      strict: flags.strict,
    });

    // Mirror migration findings into the envelope (ADR-018) so an MCP tool call
    // or an agent sees them without parsing stdout.
    for (const issue of result.issues) {
      if ((issue.severity ?? 'error') === 'warning') {
        this.warnings.push(
          `${issue.location ?? result.mfe}: ${issue.message}${issue.fix ? ` — ${issue.fix}` : ''}`,
        );
      }
    }

    return result;
  }
}

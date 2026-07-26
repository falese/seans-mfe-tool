/**
 * mfe:validate (a.k.a. doctor) — assert an MFE's internal consistency (#296).
 *
 * Reusable, platform-level consistency checker: given an MFE directory it reads
 * the manifest, package.json, and bundler federation config and asserts the
 * invariants codegen establishes (ADR-050 dependency governance, ADR-071
 * manifest-driven deps) but that hand-edits silently break — the class of drift
 * behind the meridian-docking-simulation regression (PR #292).
 *
 * The consistency rules are pure functions in `@seans-mfe/codegen`
 * (`validateMfeConsistency`, unit-tested); this command is the thin I/O shell:
 * read files, parse the config, run an optional `tsc --noEmit`, and throw a
 * typed error (non-zero exit) on any inconsistency.
 *
 * It also carries the slot rule (ADR-073): every slot an MFE declares in
 * `providesSlots` should be registered by its app code. That check needs the
 * MFE's sources, so the reading happens here and the matching stays pure.
 */

import * as path from 'path';
import { spawnSync } from 'child_process';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { parseAndValidateDirectory } from '@seans-mfe/dsl';
import {
  validateMfeConsistency,
  parseFederationSharedEntries,
} from '@seans-mfe/codegen';
import type { SourceFile } from '@seans-mfe/dsl';
import { ValidationError, BusinessError } from '@seans-mfe/contracts';
import type { MfeValidateResult } from '../../oclif/results';

export interface MfeValidateOptions {
  dir?: string;
  typecheck?: boolean;
}

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

  const { ok, checked, issues } = validateMfeConsistency({
    manifest,
    framework,
    packageDependencies,
    sharedEntries,
    sources,
  });

  const typecheck = opts.typecheck ? runTypecheck(dir, framework) : undefined;

  const result: MfeValidateResult = {
    mfe: (manifest as { name?: string }).name ?? path.basename(dir),
    framework,
    ok: ok && (typecheck ? typecheck.ok : true),
    checked,
    issues,
    typecheck,
  };

  console.log(chalk.blue(`\nValidating ${result.mfe} (${framework})...\n`));
  for (const rule of checked) {
    const ruleIssues = issues.filter((i) => i.rule === rule);
    const status = ruleIssues.length === 0 ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${status} ${rule}`);
    for (const i of ruleIssues) {
      console.log(chalk.red(`      - ${i.message}`));
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
    const failCount = issues.length + (typecheck && !typecheck.ok ? 1 : 0);
    console.log(chalk.red(`${result.mfe} is inconsistent: ${failCount} problem(s).`));
    throw new BusinessError(
      `MFE ${result.mfe} failed consistency validation with ${failCount} problem(s)`,
      'MFE_INCONSISTENT',
      { mfe: result.mfe, issues, typecheck },
    );
  }

  console.log(chalk.green(`${result.mfe} is consistent.`));
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
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    typecheck: Flags.boolean({
      description: 'Also run `tsc --noEmit` in the MFE directory',
      default: false,
    }),
  };

  protected async runCommand(): Promise<MfeValidateResult> {
    const { args, flags } = await this.parse(MfeValidate);
    return mfeValidateCommand({ dir: args.dir, typecheck: flags.typecheck });
  }
}

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

function runTypecheck(dir: string): { ran: boolean; ok: boolean; output?: string } {
  if (!fs.existsSync(path.join(dir, 'tsconfig.json'))) {
    return { ran: false, ok: true };
  }
  const res = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
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

  const { ok, checked, issues } = validateMfeConsistency({
    manifest,
    framework,
    packageDependencies,
    sharedEntries,
  });

  const typecheck = opts.typecheck ? runTypecheck(dir) : undefined;

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

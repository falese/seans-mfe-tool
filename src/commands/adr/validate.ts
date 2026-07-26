/**
 * adr:validate — the ADR library's own drift gate (ADR-075).
 *
 * Every other derived artifact in this repo is gated: schemas (ADR-065),
 * generator-owned MFE files (#295), package.json and federation `shared` (#296),
 * slot placement targets (ADR-073). The decision record that governs all of them
 * was the last thing kept in sync by hand, and it rotted in the ways ADR-075
 * §Context enumerates.
 *
 * This is the thin I/O shell — read the ADRs, read `docs/spec.md`'s index, scan
 * sources for `ADR-NNN` citations, resolve declared implementation paths — over
 * the pure rules in `@seans-mfe/dsl`. Same split as `mfe:validate`/`slots:validate`,
 * for the same reason (ADR-073 §3): the rules are unit-tested in the platform and
 * the CI wrapper calls one implementation rather than re-deriving it.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { BusinessError } from '@seans-mfe/contracts';
import { ADR_DIR, resolveAdrRoot } from './_adr-root';
import {
  parseAdrDocument,
  validateAdrLibrary,
  type AdrDocument,
  type AdrParseFailure,
  type AdrValidationIssue,
  type AdrValidationRule,
} from '@seans-mfe/dsl';
import type { SourceFile } from '@seans-mfe/dsl';

const SPEC_FILE = path.join('docs', 'spec.md');

/** Where code that may cite an ADR lives. `examples/` is opt-in — see below. */
const DEFAULT_SOURCE_ROOTS = ['src', 'packages', 'scripts'];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.ejs', '.mjs', '.cjs']);
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '__tests__']);

/**
 * Rows of the ADR index table in `docs/spec.md`.
 *
 * Tolerates both spellings of the first cell — the bare `| ADR-075 |` the table
 * used while it was hand-maintained, and the `| [ADR-075](./…) |` the generator
 * emits (ADR-075 §1). Matching only the bare form made every row invisible the
 * moment the table became generated, and `register-complete` then reported all
 * 75 ADRs as missing from an index that listed every one of them.
 */
const INDEX_ROW = /^\|\s*\[?ADR-(\d{2,4})\]?/gm;

export interface AdrValidateOptions {
  /** Repo root; defaults to cwd. */
  root?: string;
  /** Also scan `examples/**` for ADR citations. */
  includeExamples?: boolean;
}

export interface AdrValidateResult {
  adrs: number;
  ok: boolean;
  checked: AdrValidationRule[];
  issues: AdrValidationIssue[];
}

/** Read every `ADR-NNN-*.md`, splitting clean parses from failures. */
async function readAdrs(
  root: string
): Promise<{ documents: AdrDocument[]; parseFailures: AdrParseFailure[] }> {
  const dir = path.join(root, ADR_DIR);

  const documents: AdrDocument[] = [];
  const parseFailures: AdrParseFailure[] = [];

  for (const name of (await fs.readdir(dir)).sort()) {
    if (!/^ADR-\d+.*\.md$/.test(name)) continue;
    const full = path.join(dir, name);
    const relative = path.join(ADR_DIR, name);
    const result = parseAdrDocument(relative, await fs.readFile(full, 'utf8'));
    if (result.status === 'ok') documents.push(result.document);
    else parseFailures.push(result.failure);
  }

  return { documents, parseFailures };
}

/** Every scannable source file under the given roots, repo-relative. */
async function collectSources(root: string, roots: string[]): Promise<SourceFile[]> {
  const sources: SourceFile[] = [];

  const walk = async (current: string): Promise<void> => {
    if (!(await fs.pathExists(current))) return;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      sources.push({ path: path.relative(root, full), text: await fs.readFile(full, 'utf8') });
    }
  };

  for (const relative of roots) await walk(path.join(root, relative));
  return sources;
}

/**
 * Resolve only the paths ADRs actually declare.
 *
 * Cheaper and equivalent to walking the repo: the rules ask whether each
 * declared path exists, so the set need only contain the ones that do.
 *
 * Both fields contribute. `verified-by` may name either an npm script or a
 * path, and resolving only `implemented-by` made every path-shaped
 * `verified-by` entry look unresolvable.
 */
async function resolveDeclaredPaths(
  root: string,
  documents: readonly AdrDocument[]
): Promise<Set<string>> {
  const declared = new Set(
    documents.flatMap((d) => [...d.frontmatter['implemented-by'], ...d.frontmatter['verified-by']])
  );
  const existing = new Set<string>();
  for (const relative of declared) {
    if (await fs.pathExists(path.join(root, relative))) existing.add(relative);
  }
  return existing;
}

/** npm script names, so `verified-by` can name a gate and be checked (ADR-075 §6). */
async function readScriptNames(root: string): Promise<Set<string>> {
  const pkgPath = path.join(root, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return new Set();
  const pkg = (await fs.readJson(pkgPath)) as { scripts?: Record<string, string> };
  return new Set(Object.keys(pkg.scripts ?? {}));
}

/** ADR ids listed in the `docs/spec.md` index table. */
async function readIndexIds(root: string): Promise<number[] | undefined> {
  const file = path.join(root, SPEC_FILE);
  if (!(await fs.pathExists(file))) return undefined;
  const text = await fs.readFile(file, 'utf8');
  return [...text.matchAll(INDEX_ROW)].map((m) => Number.parseInt(m[1], 10));
}

/** Core orchestration, extracted for testability and for the CI wrapper. */
export async function adrValidateCommand(
  opts: AdrValidateOptions = {}
): Promise<AdrValidateResult> {
  const root = await resolveAdrRoot(opts.root);

  const { documents, parseFailures } = await readAdrs(root);
  const sourceRoots = opts.includeExamples
    ? [...DEFAULT_SOURCE_ROOTS, 'examples']
    : DEFAULT_SOURCE_ROOTS;

  const { ok, checked, issues } = validateAdrLibrary({
    documents,
    parseFailures,
    existingPaths: await resolveDeclaredPaths(root, documents),
    sources: await collectSources(root, sourceRoots),
    indexIds: await readIndexIds(root),
    scriptNames: await readScriptNames(root),
  });

  const result: AdrValidateResult = {
    adrs: documents.length + parseFailures.length,
    ok,
    checked,
    issues,
  };

  console.log(chalk.blue(`\nValidating ${result.adrs} ADR(s)...\n`));
  for (const rule of checked) {
    const ruleIssues = issues.filter((i) => i.rule === rule);
    const mark = ruleIssues.length === 0 ? chalk.green('✓') : chalk.red('✗');
    const count = ruleIssues.length === 0 ? '' : chalk.red(` — ${ruleIssues.length}`);
    console.log(`  ${mark} ${rule}${count}`);
    for (const issue of ruleIssues) {
      const where = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.log(chalk.red(`      - ${where}`));
      console.log(chalk.gray(`        ${issue.message}`));
    }
  }
  console.log('');

  if (!ok) {
    console.log(chalk.red(`ADR library has ${issues.length} problem(s).`));
    throw new BusinessError(
      `ADR library failed validation with ${issues.length} problem(s)`,
      'ADR_LIBRARY_INCONSISTENT',
      { issues },
    );
  }

  console.log(chalk.green('ADR library is consistent.'));
  return result;
}

export default class AdrValidate extends BaseCommand<AdrValidateResult> {
  static description =
    "Validate the ADR library's metadata, cross-references, and code citations (ADR-075)";

  static aliases = ['adr:doctor'];

  static args = {
    dir: Args.string({
      description: 'Repo root holding docs/architecture-decisions (default: search upward from cwd)',
      required: false,
    }),
  };

  static examples = [
    '$ seans-mfe-tool adr:validate',
    '$ seans-mfe-tool adr:validate --include-examples',
    '$ seans-mfe-tool adr:validate --json',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    'include-examples': Flags.boolean({
      description: 'Also scan examples/** for ADR citations (44 files carry pre-reflow numbers)',
      default: false,
    }),
  };

  protected async runCommand(): Promise<AdrValidateResult> {
    const { args, flags } = await this.parse(AdrValidate);
    return adrValidateCommand({ root: args.dir, includeExamples: flags['include-examples'] });
  }
}

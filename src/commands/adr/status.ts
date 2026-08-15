/**
 * adr:status — what the decision record is actually in the middle of (ADR-075 §6).
 *
 * The closed status vocabulary exists so the register can answer questions
 * instead of being read cover to cover. This is the command that asks them:
 * what is still only proposed, what is ratified with work outstanding and which
 * issues track it, and what is finished.
 *
 * Before ADR-075 none of this was answerable — the status column held thirteen
 * distinct strings for 74 records, and "Accepted (impl deferred, #252)" was a
 * sentence rather than a field.
 */

import * as path from 'path';
import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError } from '@falese/smt-contracts';
import {
  parseAdrDocument,
  formatAdrId,
  normalizeAdrId,
  type AdrStatus as AdrStatusValue,
} from '@falese/smt-dsl';
import { ADR_DIR, resolveAdrRoot } from './_adr-root';

/** Display order — the lifecycle path, not alphabetical. */
const STATUS_ORDER: readonly AdrStatusValue[] = [
  'Proposed',
  'Accepted',
  'Implemented',
  'Deferred',
  'Superseded',
  'Withdrawn',
];

export interface AdrStatusEntry {
  id: number;
  title: string;
  status: AdrStatusValue;
  area: string;
  /** `phased` / `deferred` when work is outstanding. */
  stage?: string;
  /** Issues tracking the outstanding work. */
  refs: string[];
  implementedBy: string[];
}

export interface AdrStatusResult {
  total: number;
  counts: Record<string, number>;
  /** Ratified but not finished — the actionable list. */
  outstanding: AdrStatusEntry[];
  entries: AdrStatusEntry[];
}

export interface AdrStatusOptions {
  root?: string;
  /** Limit output to one status. */
  status?: string;
  /** Show only ratified-but-unfinished decisions. */
  outstandingOnly?: boolean;
}

/**
 * Resolve a user-supplied status against the vocabulary, case-insensitively.
 *
 * The filter has always compared with `toLowerCase()`, but the oclif flag pinned
 * `options` to the exact-cased vocabulary, so `--status implemented` was rejected
 * before the core ever saw it. Validating here instead makes the command and its
 * core agree, and keeps the vocabulary in the error message where it is useful.
 */
function resolveStatus(input: string): AdrStatusValue {
  const match = STATUS_ORDER.find((s) => s.toLowerCase() === input.toLowerCase());
  if (match) return match;
  throw new ValidationError(
    `Unknown status "${input}" — expected one of: ${STATUS_ORDER.join(', ')}`,
    'status',
    'enum',
  );
}

export async function adrStatusCommand(opts: AdrStatusOptions = {}): Promise<AdrStatusResult> {
  const root = await resolveAdrRoot(opts.root);
  const dir = path.join(root, ADR_DIR);
  const status = opts.status === undefined ? undefined : resolveStatus(opts.status);

  const entries: AdrStatusEntry[] = [];
  const unparsed: string[] = [];

  for (const name of (await fs.readdir(dir)).sort()) {
    if (!/^ADR-\d+.*\.md$/.test(name)) continue;
    const parsed = parseAdrDocument(name, await fs.readFile(path.join(dir, name), 'utf8'));
    if (parsed.status !== 'ok') {
      unparsed.push(name);
      continue;
    }
    const fm = parsed.document.frontmatter;
    entries.push({
      id: normalizeAdrId(fm.id),
      title: fm.title,
      status: fm.status,
      area: fm.area ?? '—',
      stage: fm.impl?.stage,
      refs: fm.impl?.refs ?? [],
      implementedBy: fm['implemented-by'],
    });
  }

  entries.sort((a, b) => a.id - b.id);

  const counts: Record<string, number> = {};
  for (const entry of entries) counts[entry.status] = (counts[entry.status] ?? 0) + 1;

  // "Outstanding" = ratified, with work the register knows is not done.
  const outstanding = entries.filter(
    (e) => e.status === 'Accepted' && (e.stage !== undefined || e.implementedBy.length === 0)
  );

  const shown = opts.outstandingOnly
    ? outstanding
    : status
      ? entries.filter((e) => e.status === status)
      : entries;

  // The register summary prints on every run, filtered or not. Suppressing it for
  // filtered runs meant a filter matching nothing produced a single bare line and
  // no indication the register had been read at all.
  console.log('');
  const summary = STATUS_ORDER.filter((s) => counts[s])
    .map((s) => `${chalk.bold(String(counts[s]))} ${s}`)
    .join(chalk.gray('  ·  '));
  console.log(`  ${summary}     ${chalk.gray(`(${entries.length} ADRs)`)}`);
  if (unparsed.length > 0) {
    console.log(chalk.yellow(`  ${unparsed.length} unparsed — run \`npm run check:adr\``));
  }
  console.log('');

  if (shown.length === 0) {
    // "nothing outstanding" is only true of an `--outstanding` run. Saying it for
    // `--status Superseded` reported on a question nobody asked, and read as the
    // command finding nothing at all.
    const reason = opts.outstandingOnly
      ? chalk.green('  nothing outstanding.')
      : status
        ? chalk.gray(`  No ADRs with status ${status}.`)
        : chalk.yellow('  No ADRs found.');
    console.log(`${reason}\n`);
    return { total: entries.length, counts, outstanding, entries };
  }

  if (opts.outstandingOnly) {
    console.log(chalk.bold('  Ratified, work outstanding\n'));
  }

  for (const entry of shown) {
    // Work in flight with no issue behind it is the thing worth seeing: the
    // gate only *fails* on parked work (ADR-075 §6), because phased delivery is
    // by definition already moving — but "moving" with nothing to read is how a
    // decision quietly stops moving.
    const tracked =
      entry.refs.length > 0
        ? chalk.cyan(entry.refs.join(' '))
        : entry.stage !== undefined
          ? chalk.yellow('no tracking issue — file one to guide the remaining work')
          : entry.implementedBy.length > 0
            ? chalk.gray('carried by code')
            : chalk.red('untracked');
    const stage = entry.stage ? chalk.gray(` [${entry.stage}]`) : '';
    console.log(
      `  ADR-${formatAdrId(entry.id)}  ${entry.status.padEnd(12)}${stage} ${entry.title.slice(0, 58)}`
    );
    if (opts.outstandingOnly || entry.status === 'Accepted') {
      console.log(`             ${tracked}`);
    }
  }
  console.log('');

  return { total: entries.length, counts, outstanding, entries };
}

export default class AdrStatus extends BaseCommand<AdrStatusResult> {
  static description = 'Show ADR lifecycle state — what is proposed, outstanding, or done (ADR-075)';

  static args = {
    dir: Args.string({
      description: 'Repo root holding docs/architecture-decisions (default: search upward from cwd)',
      required: false,
    }),
  };

  static examples = [
    '$ seans-mfe-tool adr:status',
    '$ seans-mfe-tool adr:status --outstanding',
    '$ seans-mfe-tool adr:status --status Proposed',
    '$ seans-mfe-tool adr:status --status implemented',
    '$ seans-mfe-tool adr:status --json',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    outstanding: Flags.boolean({
      description: 'Only decisions that are ratified with work still to do',
      default: false,
    }),
    // Deliberately not `options: STATUS_ORDER` — oclif matches those exactly, which
    // rejected `--status implemented` before the case-insensitive core saw it.
    // `resolveStatus` validates instead and names the vocabulary in the error.
    status: Flags.string({
      description: `Filter to one status (${STATUS_ORDER.join(', ')}); case-insensitive`,
    }),
  };

  protected async runCommand(): Promise<AdrStatusResult> {
    const { args, flags } = await this.parse(AdrStatus);
    return adrStatusCommand({
      root: args.dir,
      status: flags.status,
      outstandingOnly: flags.outstanding,
    });
  }
}

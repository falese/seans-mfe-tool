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
import { Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs-extra';
import { BaseCommand } from '../../oclif/BaseCommand';
import { ValidationError } from '@seans-mfe/contracts';
import {
  parseAdrDocument,
  formatAdrId,
  normalizeAdrId,
  type AdrStatus as AdrStatusValue,
} from '@seans-mfe/dsl';

const ADR_DIR = path.join('docs', 'architecture-decisions');

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

export async function adrStatusCommand(opts: AdrStatusOptions = {}): Promise<AdrStatusResult> {
  const root = path.resolve(opts.root ?? process.cwd());
  const dir = path.join(root, ADR_DIR);
  if (!(await fs.pathExists(dir))) {
    throw new ValidationError(`No ADR directory at ${ADR_DIR}`, 'adr-dir', 'required');
  }

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

  const wanted = opts.outstandingOnly
    ? outstanding
    : opts.status
      ? entries.filter((e) => e.status.toLowerCase() === opts.status!.toLowerCase())
      : entries;

  console.log('');
  if (!opts.status && !opts.outstandingOnly) {
    const summary = STATUS_ORDER.filter((s) => counts[s])
      .map((s) => `${chalk.bold(String(counts[s]))} ${s}`)
      .join(chalk.gray('  ·  '));
    console.log(`  ${summary}     ${chalk.gray(`(${entries.length} ADRs)`)}`);
    if (unparsed.length > 0) {
      console.log(chalk.yellow(`  ${unparsed.length} unparsed — run \`npm run check:adr\``));
    }
    console.log('');
  }

  const shown = opts.outstandingOnly ? outstanding : wanted;
  if (shown.length === 0) {
    console.log(chalk.green('  nothing outstanding.\n'));
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

  static examples = [
    '$ seans-mfe-tool adr:status',
    '$ seans-mfe-tool adr:status --outstanding',
    '$ seans-mfe-tool adr:status --status Proposed',
    '$ seans-mfe-tool adr:status --json',
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    outstanding: Flags.boolean({
      description: 'Only decisions that are ratified with work still to do',
      default: false,
    }),
    status: Flags.string({
      description: 'Filter to one status',
      options: [...STATUS_ORDER],
    }),
  };

  protected async runCommand(): Promise<AdrStatusResult> {
    const { flags } = await this.parse(AdrStatus);
    return adrStatusCommand({ status: flags.status, outstandingOnly: flags.outstanding });
  }
}

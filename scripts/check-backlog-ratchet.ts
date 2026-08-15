#!/usr/bin/env ts-node
/**
 * The conformance backlog may only shrink (ADR-000 §3).
 *
 * ADR-000 says the rule "fails on any addition", and the backlog file repeats it
 * — but `enforced-claims-a-gate` only ever reported the *stale* direction: an id
 * that had since gained a `verified-by`. Nothing compared the list against a
 * previous list, so appending an id was a silent way to exempt a decision from
 * the rule. ADR-000's own subject is a claim with no checker behind it, so it is
 * the last place that should carry one.
 *
 * The baseline comes from git rather than from a second committed copy on
 * purpose: a copy is as editable as the original, and "the list only shrinks" is
 * a statement about history, which is the thing git actually holds.
 *
 * The three baselines are not the same answer. A revision that cannot be read is
 * a *broken gate* and fails — the defect being closed here is a check that passes
 * while comparing nothing, so a shallow clone must break the build and be fixed
 * with `fetch-depth: 0`. A readable revision that simply has no backlog file is
 * the change that introduces it, and passes: that is the snapshot being taken.
 *
 * Usage:
 *   ts-node scripts/check-backlog-ratchet.ts               # against origin/main
 *   ts-node scripts/check-backlog-ratchet.ts origin/some-base
 *
 * Refs #252 · ADR-000
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { backlogAdditions } from '@falese/smt-dsl';

const REPO_ROOT = path.resolve(__dirname, '..');
export const BACKLOG_PATH = 'docs/architecture-decisions/conformance-backlog.json';

/** The ids a backlog file lists. Throws on anything unparseable — see the test. */
export function parseBacklogIds(text: string): number[] {
  const parsed = JSON.parse(text) as { adrs?: { adr: number }[] };
  if (!Array.isArray(parsed.adrs)) throw new Error('conformance backlog has no `adrs` array');
  return parsed.adrs.map((entry) => entry.adr);
}

/** What the baseline revision had: a list, no file yet, or no readable revision. */
export type Baseline =
  | { kind: 'text'; text: string }
  | { kind: 'absent' }
  | { kind: 'unavailable' };

export interface RatchetResult {
  ok: boolean;
  /** Ids added since the baseline. Absent when no comparison was possible. */
  added?: number[];
}

/** Compare the working copy against the baseline. Pure, for testability. */
export function ratchetResult(currentText: string, baseline: Baseline): RatchetResult {
  if (baseline.kind === 'unavailable') return { ok: false };
  if (baseline.kind === 'absent') return { ok: true, added: [] };
  const added = backlogAdditions(parseBacklogIds(currentText), parseBacklogIds(baseline.text));
  return { ok: added.length === 0, added };
}

/** Read the backlog as of `ref`, distinguishing "no file" from "no revision". */
export function baselineAt(ref: string, repoRoot: string = REPO_ROOT): Baseline {
  const git = (args: string[]): string =>
    execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

  try {
    git(['rev-parse', '--verify', `${ref}^{commit}`]);
  } catch {
    return { kind: 'unavailable' };
  }

  try {
    return { kind: 'text', text: git(['show', `${ref}:${BACKLOG_PATH}`]) };
  } catch {
    return { kind: 'absent' };
  }
}

function main(): void {
  const ref = process.argv[2] ?? 'origin/main';
  const currentText = fs.readFileSync(path.join(REPO_ROOT, BACKLOG_PATH), 'utf8');
  const { ok, added } = ratchetResult(currentText, baselineAt(ref));

  if (added === undefined) {
    console.error(
      `Cannot resolve ${ref}, so the ratchet compared nothing.\n` +
        'Fetch the base revision (actions/checkout with `fetch-depth: 0`) or pass a ref that exists.'
    );
    process.exit(1);
  }

  if (!ok) {
    console.error(
      `The conformance backlog may only shrink (ADR-000 §3), but ${added.length} id(s) were added ` +
        `since ${ref}: ${added.map((id) => `ADR-${String(id).padStart(3, '0')}`).join(', ')}.\n` +
        'Ship the checker the decision claims instead of exempting it from the rule.'
    );
    process.exit(1);
  }

  console.log(
    `Conformance backlog holds against ${ref}: ` +
      `${parseBacklogIds(currentText).length} entry(ies), no additions.`
  );
}

if (require.main === module) main();

/**
 * Team-boundary signals for `decompose:analyze` (#414): which files change
 * together (`git log`) and who owns them (CODEOWNERS).
 *
 * The parsing and matching are pure; only `readHistory` touches git and the
 * file system.
 */

import { execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import * as fs from 'fs-extra';

const run = promisify(execFile);

/** A commit touching more files than this is a sweep (a rename, a format), not a change. */
export const MAX_COMMIT_FILES = 40;

/** Parse `git log --format=@@%H --name-only` output into per-commit file lists. */
export function parseGitLog(text: string): string[][] {
  const commits: string[][] = [];
  let current: string[] | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('@@')) {
      current = [];
      commits.push(current);
    } else if (line.trim() && current) {
      current.push(line.trim());
    }
  }
  return commits;
}

export interface CoChange {
  a: string;
  b: string;
  /** Commits that changed both. */
  commits: number;
}

/** How often each pair of `files` changed in the same commit, sweeps excluded. Sorted, most first. */
export function coChange(commits: string[][], files: Set<string>): { pairs: CoChange[]; changes: Record<string, number> } {
  const counts = new Map<string, number>();
  const changes: Record<string, number> = {};
  for (const commit of commits) {
    const touched = [...new Set(commit.filter((f) => files.has(f)))].sort();
    if (touched.length > MAX_COMMIT_FILES) continue;
    for (const f of touched) changes[f] = (changes[f] ?? 0) + 1;
    for (let i = 0; i < touched.length; i += 1) {
      for (let j = i + 1; j < touched.length; j += 1) {
        const k = `${touched[i]}\u0000${touched[j]}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  const pairs = [...counts]
    .map(([k, n]) => {
      const [a, b] = k.split('\u0000');
      return { a, b, commits: n };
    })
    .sort((x, y) => y.commits - x.commits || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  return { pairs, changes };
}

export interface OwnerRule {
  pattern: string;
  owners: string[];
}

export function parseCodeOwners(text: string): OwnerRule[] {
  const rules: OwnerRule[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    rules.push({ pattern, owners });
  }
  return rules;
}

function globToRegExp(pattern: string): RegExp {
  let p = pattern;
  const anchored = p.startsWith('/') || p.slice(0, -1).includes('/');
  p = p.replace(/^\//, '');
  const dir = p.endsWith('/');
  if (dir) p = p.slice(0, -1);
  let re = '';
  for (let i = 0; i < p.length; i += 1) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      re += '.*';
      i += 1;
      if (p[i + 1] === '/') i += 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${anchored ? '^' : '(^|/)'}${re}(${dir ? '/.*' : '(/.*)?'})$`);
}

/** The owners of `file` (relative to where the CODEOWNERS file applies): the last matching rule wins. */
export function ownersOf(rules: OwnerRule[], file: string): string[] {
  let owners: string[] = [];
  for (const rule of rules) if (globToRegExp(rule.pattern).test(file)) owners = rule.owners;
  return owners;
}

export interface History {
  coChange: CoChange[];
  changes: Record<string, number>;
  /** File → owners; empty when no CODEOWNERS applies. */
  owners: Record<string, string[]>;
  codeownersFile: string | null;
  /** Why history could not be read, when it could not. */
  unavailable: string | null;
}

/** Read co-change and ownership for the project at `dir`, for its source `files` (relative to `dir`). */
export async function readHistory(dir: string, files: string[]): Promise<History> {
  const fileSet = new Set(files);
  const history: History = { coChange: [], changes: {}, owners: {}, codeownersFile: null, unavailable: null };
  try {
    const { stdout } = await run('git', ['-C', dir, 'log', '--no-merges', '--format=@@%H', '--name-only', '--relative', '--', '.'], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const { pairs, changes } = coChange(parseGitLog(stdout), fileSet);
    history.coChange = pairs;
    history.changes = changes;
  } catch (err) {
    history.unavailable = `git log failed: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`;
  }

  // CODEOWNERS beside the app applies to paths relative to the app; the repository's to paths from its root.
  let repoRoot: string | null = null;
  try {
    repoRoot = (await run('git', ['-C', dir, 'rev-parse', '--show-toplevel'])).stdout.trim();
  } catch {
    repoRoot = null;
  }
  const candidates: Array<{ file: string; base: string }> = [
    ...['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'].map((f) => ({ file: path.join(dir, f), base: dir })),
    ...(repoRoot ? ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'].map((f) => ({ file: path.join(repoRoot as string, f), base: repoRoot as string })) : []),
  ];
  for (const c of candidates) {
    if (!(await fs.pathExists(c.file))) continue;
    const rules = parseCodeOwners(await fs.readFile(c.file, 'utf8'));
    history.codeownersFile = path.relative(dir, c.file) || c.file;
    for (const f of files) {
      const rel = path.relative(c.base, path.join(dir, f)).split(path.sep).join('/');
      const owners = ownersOf(rules, rel);
      if (owners.length > 0) history.owners[f] = owners;
    }
    break;
  }
  return history;
}

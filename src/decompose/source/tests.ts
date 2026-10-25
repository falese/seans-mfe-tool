/**
 * The monolith's own test suite, inventoried for keep/rewrite/discard triage
 * (#414, PDR-011): what each test file touches, how it tests (snapshots,
 * mocks, skips, structural selectors), and — when the suite is run — how each
 * test fared.
 *
 * The inventory records facts, not verdicts: triage is the proposal stage's
 * call (#415).
 */

import { execFile } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import type * as TS from 'typescript';
import { resolveModule } from './graph';
import { parseFile } from './parse';

const run = promisify(execFile);

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'todo';
}

export interface TestFile {
  file: string;
  /** `support`: test setup (setupTests), not tests. */
  kind: 'unit' | 'e2e' | 'support';
  /** App source files the test imports. */
  touches: string[];
  /** Modules replaced with `jest.mock`: app files where they resolve, packages otherwise. */
  mocks: string[];
  tests: number;
  skipped: number;
  todo: number;
  snapshots: number;
  /** Selectors that pin markup structure (`nth-child`, `>` chains, `.nth(`, raw class selectors). */
  structuralSelectors: number;
  /** Fixed sleeps (`waitForTimeout`, `setTimeout` waits) — a flakiness smell. */
  fixedWaits: number;
  /** Per-test outcomes, when the suite was run. */
  results?: TestResult[];
  /** When the suite ran: a unit test it did not run — excluded by the project's test config. */
  excluded?: boolean;
}

export interface TestInventory {
  files: TestFile[];
  /** How the suite was run, or why it was not. */
  run: { ran: boolean; reason: string | null; passed: number; failed: number; skipped: number };
}

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

/** Static facts about one test file. */
export function describeTestFile(ts: typeof TS, file: string, text: string, sourceFiles: Set<string>): TestFile {
  const facts = parseFile(ts, file, text);
  const e2e = facts.imports.some((i) => i.spec === '@playwright/test' || i.spec === 'playwright') || /(^|\/)e2e\//.test(file);
  const touches = new Set<string>();
  for (const imp of facts.imports) {
    const target = resolveModule(file, imp.spec, sourceFiles);
    if (target) touches.add(target);
  }
  const mocks = new Set<string>();
  for (const m of text.matchAll(/jest\.mock\(\s*['"`]([^'"`]+)['"`]/g)) {
    mocks.add(resolveModule(file, m[1], sourceFiles) ?? m[1]);
  }
  return {
    file,
    kind: /(^|\/)setupTests\.[jt]sx?$/.test(file) ? 'support' : e2e ? 'e2e' : 'unit',
    touches: [...touches].sort(),
    mocks: [...mocks].sort(),
    tests: count(text, /(^|[^.\w])(it|test)(\.only|\.skip|\.todo|\.each\([^)]*\))?\s*\(/g) + count(text, /(^|[^.\w])x(it|test)\s*\(/g),
    skipped: count(text, /\b(it|test|describe)\.skip\s*\(|(^|[^.\w])x(it|test|describe)\s*\(/g),
    todo: count(text, /\b(it|test)\.todo\s*\(/g),
    snapshots: count(text, /toMatch(Inline)?Snapshot\s*\(/g),
    structuralSelectors:
      [...text.matchAll(/(['"`])([^'"`\n]*)\1/g)].filter((m) => /nth-child\(|nth-of-type\(|\s>\s/.test(m[2])).length +
      count(text, /\.nth\(\s*\d/g),
    fixedWaits: count(text, /waitForTimeout\s*\(|new Promise\(\s*\(?r(esolve)?\)?\s*=>\s*setTimeout/g),
  };
}

interface JestJson {
  testResults?: Array<{ name: string; assertionResults?: Array<{ fullName: string; status: string }> }>;
}

/** Fold Jest's `--json` report into the inventory, by file relative to `dir`. */
export function mergeJestResults(files: TestFile[], report: JestJson, dir: string): TestInventory['run'] {
  const totals = { passed: 0, failed: 0, skipped: 0 };
  const byFile = new Map(files.map((f) => [f.file, f]));
  for (const suite of report.testResults ?? []) {
    const rel = path.relative(dir, suite.name).split(path.sep).join('/');
    const target = byFile.get(rel);
    if (!target) continue;
    target.results = (suite.assertionResults ?? []).map((a): TestResult => {
      const status: TestResult['status'] =
        a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : a.status === 'todo' ? 'todo' : 'skipped';
      if (status === 'passed') totals.passed += 1;
      else if (status === 'failed') totals.failed += 1;
      else totals.skipped += 1;
      return { name: a.fullName, status };
    });
  }
  for (const f of files) if (f.kind === 'unit') f.excluded = f.results === undefined;
  return { ran: true, reason: null, ...totals };
}

/** Inventory the project's tests, and run its Jest suite when asked and possible. */
export async function inventoryTests(
  ts: typeof TS,
  dir: string,
  testFiles: string[],
  sourceFiles: Set<string>,
  runSuite: boolean
): Promise<TestInventory> {
  const files: TestFile[] = [];
  for (const file of testFiles) {
    files.push(describeTestFile(ts, file, await fs.readFile(path.join(dir, file), 'utf8'), sourceFiles));
  }
  const notRun = (reason: string): TestInventory => ({ files, run: { ran: false, reason, passed: 0, failed: 0, skipped: 0 } });
  if (!runSuite) return notRun('not requested (--no-run-tests)');
  if (!files.some((f) => f.kind === 'unit')) return notRun('no unit tests found');
  const jestBin = path.join(dir, 'node_modules', '.bin', 'jest');
  if (!(await fs.pathExists(jestBin))) return notRun(`jest is not installed in ${dir} (run npm install there)`);

  const out = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'smt-analyze-')), 'jest.json');
  try {
    // A failing test exits non-zero; the report is still written, and failures are the point.
    await run(jestBin, ['--json', `--outputFile=${out}`, '--ci', '--silent', '--watchAll=false'], {
      cwd: dir,
      timeout: 10 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, CI: 'true' },
    }).catch(() => undefined);
    if (!(await fs.pathExists(out))) return notRun('jest did not write a report');
    return { files, run: mergeJestResults(files, (await fs.readJson(out)) as JestJson, dir) };
  } finally {
    await fs.remove(path.dirname(out));
  }
}

/**
 * --json single-line stdout conformance (CA-2).
 *
 * The `--json` contract (see docs/cli-contract.md §2) guarantees that under
 * --json:
 *   - stdout contains EXACTLY ONE newline-terminated JSON line — the envelope;
 *   - every other write (console.log, raw process.stdout.write) is redirected
 *     to stderr so it can never pollute the envelope line.
 *
 * This is the mechanism `BaseCommand.run()` relies on. We exercise it directly
 * in an isolated child process (the redirect mutates process-global streams and
 * is intentionally one-way, so it must not run in the Jest worker itself).
 *
 * Unlike the end-to-end json-contract.test.ts (which needs the full CLI dist and
 * is excluded from the unit test run), this test only needs the built
 * `@seans-mfe/oclif-base` package — which the CI test job builds — so it runs as
 * part of the normal suite and guards the invariant against silent drift.
 *
 * Refs #230, #219 (CA-2)
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

// I/O from child processes is not timer-driven.
jest.useRealTimers();

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function runInChild(script: string): { stdout: string; stderr: string; status: number } {
  const res = spawnSync(process.execPath, ['-e', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: undefined, FORCE_COLOR: '1' },
  });
  return { stdout: res.stdout, stderr: res.stderr, status: res.status ?? 1 };
}

function nonEmptyLines(s: string): string[] {
  return s.split('\n').filter((l) => l.trim() !== '');
}

describe('--json single-line stdout conformance (CA-2)', () => {
  it('writeJsonLine emits exactly one newline-terminated line on real stdout', () => {
    const { stdout, status } = runInChild(
      `const { writeJsonLine } = require('@seans-mfe/oclif-base');
       writeJsonLine('{"ok":true,"marker":"CA2"}');`,
    );
    expect(status).toBe(0);
    expect(stdout).toBe('{"ok":true,"marker":"CA2"}\n');
    expect(nonEmptyLines(stdout)).toHaveLength(1);
    expect(JSON.parse(nonEmptyLines(stdout)[0]).ok).toBe(true);
  });

  it('after redirect, console/stdout writes go to stderr; envelope is the only stdout line', () => {
    const { stdout, stderr, status } = runInChild(
      `const { redirectStdoutToStderr, writeJsonLine } = require('@seans-mfe/oclif-base');
       redirectStdoutToStderr();
       console.log('human-progress-line');
       process.stdout.write('raw-stdout-write');
       writeJsonLine('{"ok":true,"marker":"CA2"}');`,
    );
    expect(status).toBe(0);

    // stdout: exactly the one envelope line, nothing else.
    expect(nonEmptyLines(stdout)).toHaveLength(1);
    expect(stdout).toBe('{"ok":true,"marker":"CA2"}\n');

    // stderr: received everything that would otherwise have polluted stdout.
    expect(stderr).toContain('human-progress-line');
    expect(stderr).toContain('raw-stdout-write');
  });

  it('suppressChalk strips ANSI colour codes even when colour is forced', () => {
    const { stdout, status } = runInChild(
      `const { suppressChalk } = require('@seans-mfe/oclif-base');
       const chalk = require('chalk');
       suppressChalk();
       process.stdout.write(chalk.red('plain'));`,
    );
    expect(status).toBe(0);
    // eslint-disable-next-line no-control-regex
    expect(/\u001b\[[0-9;]*m/.test(stdout)).toBe(false);
    expect(stdout).toBe('plain');
  });
});

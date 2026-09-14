/**
 * The doc-path gate's own behaviour.
 *
 * It exists to catch a citation pointing at a file that moved. Two properties
 * have to hold together, and the second is the one that broke in CI:
 *
 *   it fails on a path that does not resolve, and
 *   it reaches the same verdict in a clean checkout as on a built tree.
 *
 * A citation naming build output — `packages/contracts/dist` — resolved on a
 * machine that had run a build and did not resolve in CI, which checks out and
 * runs the script without building. A gate whose answer depends on whether the
 * developer happened to build is worse than no gate.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-doc-paths.js');

/** Run the gate against a scratch docs/ tree containing exactly `body`. */
function runAgainst(body: string, filename = 'probe.md'): { code: number; out: string } {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-paths-'));
  try {
    fs.mkdirSync(path.join(scratch, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(scratch, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'docs', filename), body);
    // The script resolves paths against its own parent directory, so it has to
    // run from inside the scratch tree rather than against the real repo.
    fs.copyFileSync(SCRIPT, path.join(scratch, 'scripts', 'check-doc-paths.js'));
    // One real file and one real directory to cite.
    fs.mkdirSync(path.join(scratch, 'packages', 'contracts', 'src'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'packages', 'contracts', 'src', 'index.ts'), '');
    try {
      const out = execFileSync(process.execPath, [path.join(scratch, 'scripts', 'check-doc-paths.js')], {
        cwd: scratch,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

describe('check-doc-paths', () => {
  it('passes a citation that resolves', () => {
    const { code } = runAgainst('See `packages/contracts/src/index.ts`.\n');
    expect(code).toBe(0);
  });

  it('fails a citation that does not resolve', () => {
    const { code, out } = runAgainst('See `packages/contracts/src/moved-away.ts`.\n');
    expect(code).toBe(1);
    expect(out).toContain('moved-away.ts');
  });

  it('ignores build output, which a clean checkout does not have', () => {
    // Neither directory exists in the scratch tree, exactly as in CI.
    const { code } = runAgainst(
      'Built to `packages/contracts/dist` and staged at ' +
        '`dist/runtime/node_modules/@seans-mfe/contracts`.\n',
    );
    expect(code).toBe(0);
  });

  it('fails a broken citation in an HTML page', () => {
    // The schematic pages (cli-architecture, runtime-architecture) are HTML and
    // mark citations with <code>, not backticks. They are the most
    // reader-facing docs in the repository and were ungated until this case.
    const { code, out } = runAgainst(
      '<p>See <code>packages/contracts/src/moved-away.ts</code>.</p>\n',
      'probe.html',
    );
    expect(code).toBe(1);
    expect(out).toContain('moved-away.ts');
  });

  it('passes a resolving citation in an HTML page', () => {
    const { code } = runAgainst(
      '<p>See <code>packages/contracts/src/index.ts</code>.</p>\n',
      'probe.html',
    );
    expect(code).toBe(0);
  });

  it("ignores a path that belongs to coder's repository", () => {
    // The adaptor specs describe work in Falese/coder. `src/adaptors/` is a
    // real address there and in none of this repository.
    const { code } = runAgainst("coder's `ManifestSchema` (`src/adaptors/types.ts`).\n");
    expect(code).toBe(0);
  });

  it('ignores a convention placeholder', () => {
    const { code } = runAgainst('Commands live at `src/commands/<topic>/<cmd>.ts`.\n');
    expect(code).toBe(0);
  });

  it('does not judge decision records', () => {
    const scratchBody = 'The old path was `packages/contracts/src/gone.ts`.\n';
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-paths-adr-'));
    try {
      fs.mkdirSync(path.join(scratch, 'docs', 'architecture-decisions'), { recursive: true });
      fs.mkdirSync(path.join(scratch, 'scripts'), { recursive: true });
      fs.writeFileSync(
        path.join(scratch, 'docs', 'architecture-decisions', 'ADR-001-probe.md'),
        scratchBody,
      );
      fs.copyFileSync(SCRIPT, path.join(scratch, 'scripts', 'check-doc-paths.js'));
      const out = execFileSync(
        process.execPath,
        [path.join(scratch, 'scripts', 'check-doc-paths.js')],
        { cwd: scratch, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      expect(out).toContain('0 broken');
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });
});

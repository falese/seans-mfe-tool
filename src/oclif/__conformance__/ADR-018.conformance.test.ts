/**
 * ADR-018 conformance — stdout carries the envelope and nothing else.
 *
 * ADR-018: "Under --json, every command emits exactly one CommandResult<T> JSON
 * object to stdout; all other output (progress, warnings, interactive prompts)
 * goes to stderr."
 *
 * Its `verified-by` named `docs/cli-contract.md` — a document. That satisfied
 * ADR-000's rule (the field was non-empty and the path resolved) while proving
 * nothing, because prose cannot execute. `enforced-claims-a-gate` now rejects a
 * `.md` as the only entry, and this pack is the gate that replaces it.
 *
 * What the existing suite already covers, and this pack deliberately does not
 * restate: `__tests__/json-contract.test.ts` spawns the real CLI and validates
 * envelopes against the meta-schema and the per-command output schemas. It is
 * the behavioural half and it is good — but every command it exercises is one
 * that does its work in-process.
 *
 * That gap is the whole reason this file exists. `redirectStdoutToStderr()`
 * patches `process.stdout.write` in the CLI's own process. A child given
 * `stdio: 'inherit'` is handed the parent's real file descriptor 1, which no
 * amount of JavaScript patching can reach. Twelve call sites across four
 * packages did exactly that — `npm install`, `docker build`, `docker run`,
 * `npx mesh build` — so ADR-018's invariant was broken by most of the mutating
 * commands, and no test noticed because no test ran a command that shells out.
 *
 * The consequence was not cosmetic: the MCP server parses stdout as the
 * envelope (ADR-019), so a `deploy` that had already started the container came
 * back to the agent as `system` error 69.
 *
 * Both checks proven able to fail: restore a literal `stdio: 'inherit'` at any
 * call site (1), and make `childStdio()` return fd 1 under json mode (2).
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { childStdio, JSON_MODE_ENV } from '@falese/smt-contracts';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ROOTS = ['src', 'packages'];
const SKIP = new Set(['node_modules', 'dist', '__tests__', '__conformance__', 'templates']);

/** Every shipped `.ts`/`.js` under the scanned roots, repo-relative. */
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    if (!/\.[jt]sx?$/.test(entry.name) || /\.test\.[jt]sx?$/.test(entry.name)) return [];
    return [path.relative(REPO_ROOT, full)];
  });
}

describe('ADR-018: one CommandResult line on stdout', () => {
  it('never hands a child process the parent stdout', () => {
    // The check that would have caught the leak. `stdio: 'inherit'` is the
    // exact literal that breaks the contract, and it reads as the obvious,
    // harmless choice — which is why it appeared twelve times and why a
    // reviewer would not flag it. childStdio() is the same thing in human mode
    // and fd 2 under --json.
    const files = ROOTS.flatMap((root) => sources(path.join(REPO_ROOT, root)));
    expect(files.length).toBeGreaterThan(100);

    const offenders = files.filter((file) => {
      const text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
      return text
        .split('\n')
        .some(
          (line) =>
            /stdio:\s*'inherit'/.test(line) &&
            !line.trimStart().startsWith('*') &&
            !line.trimStart().startsWith('//')
        );
    });
    expect(offenders).toEqual([]);
  });

  it('routes a real child process away from stdout under --json', () => {
    // Structural absence of the literal is not the property; the property is
    // that a real grandchild's output does not land on fd 1. Driven with an
    // actual process, because this bug survived precisely by being invisible
    // to anything that only reads source or mocks the spawn.
    const env = { ...process.env, [JSON_MODE_ENV]: '1' };
    const captured = execSync(
      `node -e "require('child_process').execSync('echo LEAK', ` +
        `{ stdio: [${childStdio(env).join(',')}] })"`,
      { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    expect(captured).toBe('');

    // …and the output is not discarded, only moved. An operator watching a
    // docker build must still see it, and ADR-019 forwards stderr to the agent.
    const onStderr = execSync(
      `node -e "require('child_process').execSync('echo LEAK', ` +
        `{ stdio: [${childStdio(env).join(',')}] })" 2>&1`,
      { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    expect(onStderr).toContain('LEAK');
  });
});

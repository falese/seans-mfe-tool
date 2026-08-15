/**
 * Stdio for a child process, under the ADR-018 stdout contract.
 *
 * ADR-018 promises that under `--json`, stdout carries exactly one
 * `CommandResult<T>` line. `BaseCommand` keeps that promise by redirecting
 * `this.log()` and `console.log` to stderr — which works for everything written
 * *by the CLI process*.
 *
 * It does nothing at all for a child. `stdio: 'inherit'` hands the spawned
 * process the parent's real file descriptor 1, and patching
 * `process.stdout.write` in JavaScript cannot affect a descriptor another
 * process already holds. So `execSync('docker build …', { stdio: 'inherit' })`
 * put docker's entire build log on the CLI's stdout, ahead of the envelope, and
 * ADR-018's invariant was broken by every command that shells out — which is
 * most of the mutating ones.
 *
 * The MCP server (ADR-019) is where that surfaced: it parses stdout as the
 * envelope, so a `deploy` that had already started the container came back to
 * the agent as `system` error 69.
 *
 * The fix has to happen where the child is created, so it is a stdio value
 * rather than a stream patch:
 *
 *   execSync('docker build …', { stdio: childStdio() })
 *
 * Human mode is byte-for-byte unchanged — `[0, 1, 2]` is what `'inherit'`
 * means. Under `--json` the child's stdout is pointed at fd 2, so the output is
 * still there for the operator and the agent (ADR-019 forwards stderr), just no
 * longer mixed into the machine-readable channel.
 *
 * Lives in contracts rather than oclif-base because framework plugins and the
 * BFF plugin spawn build tools too, and contracts is the one package all of
 * them already depend on.
 */

/**
 * Marker for "an ancestor process is emitting a JSON envelope on stdout".
 *
 * Set by `redirectStdoutToStderr()` in `@falese/smt-oclif-base`, read here.
 * An environment variable rather than a module-level flag because it has to
 * cross a process boundary: if the CLI shells out to another CLI, the
 * grandchild's children must keep fd 1 clean too, and inherited env is what
 * carries that down the tree.
 */
export const JSON_MODE_ENV = 'SMT_JSON_MODE';

/** `[stdin, stdout, stderr]` as file descriptors, accepted by both `spawn` and `execSync`. */
export type ChildStdio = [number, number, number];

/**
 * The stdio triple a child process should be given.
 *
 * @param env - Environment to read the JSON-mode marker from. Defaults to
 *              `process.env`; injectable so this is testable without mutating
 *              global state.
 */
export function childStdio(env: NodeJS.ProcessEnv = process.env): ChildStdio {
  return [0, env[JSON_MODE_ENV] ? 2 : 1, 2];
}

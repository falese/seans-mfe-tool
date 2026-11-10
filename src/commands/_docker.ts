/**
 * The one way command code runs Docker.
 *
 * Arguments go to `docker` as an array through `execFileSync`, so no value is
 * ever read by a shell. `build:docker` (and `deploy`, since removed — ADR-122) used to build `docker …`
 * as a template string for `execSync`; a value such as `x; touch /tmp/pwned` then ran on the host,
 * and since every command is also an MCP tool (ADR-019), that string was
 * within reach of whatever text an agent had read.
 *
 * The assertions are the second half: an argument array stops a shell reading
 * a value, but not Docker reading `-v` or `--privileged` as an option. A value
 * that names an image is checked against Docker's grammar before anything is
 * spawned.
 */

import { execFileSync, type ExecFileSyncOptions } from 'child_process';
import { ValidationError } from '@seans-mfe/contracts';

/** `[registry[:port]/]path[:tag]` — the characters Docker allows, never leading with `-`. */
const IMAGE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]*(?::[0-9]+)?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?$/;

export function runDocker(args: readonly string[], options: ExecFileSyncOptions = {}): string {
  const out = execFileSync('docker', [...args], options);
  return typeof out === 'string' ? out : String(out ?? '');
}

/** A full image reference, as `docker build -t` accepts it. */
export function assertImageRef(value: string, field: string): void {
  if (!IMAGE_REF.test(value)) {
    throw new ValidationError(
      `"${value}" is not a valid image ${field}: expected [registry/]name[:tag], e.g. my-mfe:latest`,
      field,
      'docker-reference',
    );
  }
}

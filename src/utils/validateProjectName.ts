import { ValidationError } from '@seans-mfe/contracts';

/**
 * Project/app names supplied on the CLI (or via the MCP tool bridge) flow into
 * two dangerous sinks:
 *   - `path.resolve(cwd, name)` when scaffolding a project directory, where a
 *     `..` segment lets generation escape the working directory; and
 *   - docker image/container arguments, where shell/argv metacharacters or a
 *     leading `-` enable command/argument injection.
 *
 * Anchor the allowlist to plain identifier characters and require an
 * alphanumeric first character (blocks leading `-`/`.`), and reject any `..`
 * outright. This is the single choke point both call sites go through.
 */
const PROJECT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function validateProjectName(name: string, field = 'name'): string {
  if (typeof name !== 'string' || name.includes('..') || !PROJECT_NAME_RE.test(name)) {
    throw new ValidationError(
      `Invalid ${field} "${name}": use only letters, digits, '.', '-', '_', ` +
        `starting with a letter or digit, and no path separators`,
      field,
      'pattern',
    );
  }
  return name;
}

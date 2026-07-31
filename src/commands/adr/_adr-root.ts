/**
 * Locate the ADR register (ADR-075).
 *
 * Both `adr:status` and `adr:validate` read `docs/architecture-decisions`, and
 * both originally resolved it against `process.cwd()` alone. That made them
 * repo-root-only: running either from `src/` — or from any package directory,
 * which is where you actually are when a citation prompts the question — failed
 * with "No ADR directory at docs/architecture-decisions", which reads as a
 * broken command rather than a wrong working directory.
 *
 * Walking up mirrors how every other tool in the repo behaves from a
 * subdirectory (git, npm, tsc) and costs one `pathExists` per level.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { ValidationError } from '@falese/smt-contracts';

export const ADR_DIR = path.join('docs', 'architecture-decisions');

/**
 * Resolve the repo root holding the ADR register.
 *
 * An explicit directory is taken at its word and must contain the register —
 * silently walking up from a path the caller named would turn a typo into a
 * confusing success against some ancestor.
 */
export async function resolveAdrRoot(explicit?: string): Promise<string> {
  if (explicit !== undefined) {
    const root = path.resolve(explicit);
    if (await fs.pathExists(path.join(root, ADR_DIR))) return root;
    throw new ValidationError(
      `No ${ADR_DIR} directory under ${root}`,
      'adr-dir',
      'required',
    );
  }

  let current = process.cwd();
  for (;;) {
    if (await fs.pathExists(path.join(current, ADR_DIR))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new ValidationError(
    `No ${ADR_DIR} directory in ${process.cwd()} or any parent directory`,
    'adr-dir',
    'required',
  );
}

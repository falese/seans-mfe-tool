/**
 * How something outside the generator adds files to what it emits (ADR-092 §2).
 *
 * The generator used to reach into `packages/plugin-bff/templates` by relative
 * path, because there was no way for a plugin to contribute to the generation
 * plan — the same reason it hardcoded framework variants. A contributor is
 * that way: a template root the contributor owns, plus the `FileSpec`s to
 * resolve against it.
 *
 * Registration is a side effect of importing the contributor's module, so a
 * host opts in with one import rather than threading a parameter through every
 * call site. A caller that forgets fails loudly rather than quietly: the drift
 * gate compares against a maximal generation, so files a missing contributor
 * would have produced show up as orphaned.
 */

import type { FileSpec } from './file-plan';

export interface FileContributor {
  /** Stable id; registering the same id twice replaces the earlier entry. */
  id: string;
  /**
   * Absolute path to the directory this contributor's templates live in —
   * resolved by the contributor, inside its own package, so the generator
   * never needs to know where that is.
   */
  templateRoot: string;
  /** Specs to resolve against `templateRoot`. */
  specs: FileSpec[];
}

const contributors = new Map<string, FileContributor>();

export function registerFileContributor(contributor: FileContributor): void {
  contributors.set(contributor.id, contributor);
}

export function unregisterFileContributor(id: string): void {
  contributors.delete(id);
}

export function fileContributors(): readonly FileContributor[] {
  return [...contributors.values()];
}

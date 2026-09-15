/**
 * How something outside the generator adds files to what it emits (ADR-094 §2).
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

import type { FileSpec, PlanContext } from './file-plan';

export interface FileContributor {
  /** Stable id; registering the same id twice replaces the earlier entry. */
  id: string;
  /**
   * Absolute path to the directory this contributor's templates live in —
   * resolved by the contributor, inside its own package, so the generator
   * never needs to know where that is.
   */
  templateRoot: string;
  /**
   * Specs to resolve against `templateRoot`.
   *
   * A function when the set of files depends on the manifest — one per
   * capability, say. `FileSpec.out` is a static string, so a fixed array can
   * only describe files whose paths are known before any manifest is read.
   * That limit shaped the Swift lane badly before this existed: unable to emit
   * `Features/<Cap>View.swift` per capability the way the web lane's
   * `featureSpecs()` does, it put every view in one developer-owned file, and
   * a capability added later then had nowhere to land — which was written up
   * as an intentional "migration notice" rather than as the workaround it was.
   *
   * The array form stays valid and is what the BFF uses.
   */
  specs: FileSpec[] | ((ctx: PlanContext) => FileSpec[]);
}

/** A contributor's specs for this generation, whichever form it declared. */
export function contributorSpecs(contributor: FileContributor, ctx: PlanContext): FileSpec[] {
  return typeof contributor.specs === 'function' ? contributor.specs(ctx) : contributor.specs;
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

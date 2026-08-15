/**
 * Generator-owned drift detection (#295).
 *
 * Enforces the idempotent-regeneration property of ADR-043 (manifest-driven
 * codegen): a regenerate with an unchanged manifest is a no-op, and generated
 * files carry `overwrite: true`. This is the CI enforcement of that invariant
 * via the same generate-and-diff idiom the repo uses for schemas.
 *
 * The generator tags every emitted file with an `overwrite` flag: `true` files
 * are generator-owned and re-stamped on every `remote:generate`, so they must
 * always match a fresh generation from `mfe-manifest.yaml`; `false` files are
 * developer-owned (feature code, package.json, bundler config) and are out of
 * scope here (their manifest consistency is `mfe validate`'s job, #296).
 *
 * `diffGeneratedOwned` is pure: it takes the generated files plus a reader for
 * the current on-disk content, so it can be unit-tested without touching disk.
 *
 * `findOrphanedGeneratedFiles` closes a direction ADR-043's invariant implies
 * but `diffGeneratedOwned` alone cannot see: a manifest can *shrink* (e.g. a
 * `data:` section removed) so that a path the generator used to own is no
 * longer in the current generation at all. `diffGeneratedOwned` only ever
 * looks at paths the current generation still produces, so a file like that
 * simply never enters its comparison — it isn't "stale", it's invisible.
 * Found live in `examples/abc-kids/*`: 12 MFEs with no `data:` in their
 * manifest still carried a root `server.ts` referencing a `./.mesh` build
 * output that no longer exists, left behind from before `data:` was removed.
 * The caller supplies a second, "maximal" generation of the same manifest
 * (e.g. with `data` forced present) so this stays pure and manifest-shape
 * agnostic rather than hard-coding which fields gate which files.
 */

import type { GeneratedFile } from './unified-generator';

export type DriftReason = 'missing' | 'stale' | 'orphaned';

export interface DriftEntry {
  file: string;
  reason: DriftReason;
}

export interface DriftResult {
  /** Number of generator-owned files considered. */
  ownedCount: number;
  /** Generator-owned files that are absent or stale on disk. */
  drift: DriftEntry[];
}

/**
 * Compare the generator-owned files against their current on-disk content.
 *
 * @param files       all files the generator produced for an MFE
 * @param readCurrent returns the current on-disk content for a path, or `null`
 *                    if the file does not exist
 */
export function diffGeneratedOwned(
  files: GeneratedFile[],
  readCurrent: (path: string) => string | null,
): DriftResult {
  const owned = files.filter((f) => f.overwrite);
  const drift: DriftEntry[] = [];

  for (const f of owned) {
    const current = readCurrent(f.path);
    if (current === null) {
      drift.push({ file: f.path, reason: 'missing' });
    } else if (current !== f.content) {
      drift.push({ file: f.path, reason: 'stale' });
    }
  }

  return { ownedCount: owned.length, drift };
}

/**
 * Generator-owned paths that a *broader* generation of the same manifest
 * would own but the *current* generation does not — and that are still
 * present on disk. These are left over from a manifest that used to imply
 * them (most commonly: `data:` removed after a BFF was once generated).
 *
 * @param realFiles     the current, real generation for this manifest
 * @param maximalFiles  a generation of the same manifest with the
 *                       manifest-shape fields that gate optional
 *                       generator-owned output (e.g. `data`) forced present,
 *                       so it includes every generator-owned path the real
 *                       generation *could* have produced
 * @param readCurrent   returns the current on-disk content for a path, or
 *                       `null` if the file does not exist
 */
export function findOrphanedGeneratedFiles(
  realFiles: GeneratedFile[],
  maximalFiles: GeneratedFile[],
  readCurrent: (path: string) => string | null,
): DriftEntry[] {
  const realOwnedPaths = new Set(realFiles.filter((f) => f.overwrite).map((f) => f.path));
  const maximalOwned = maximalFiles.filter((f) => f.overwrite);

  const orphaned: DriftEntry[] = [];
  for (const f of maximalOwned) {
    if (realOwnedPaths.has(f.path)) continue;
    if (readCurrent(f.path) !== null) {
      orphaned.push({ file: f.path, reason: 'orphaned' });
    }
  }
  return orphaned;
}

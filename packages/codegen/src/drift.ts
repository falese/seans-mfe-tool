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
 */

import type { GeneratedFile } from './unified-generator';

export type DriftReason = 'missing' | 'stale';

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

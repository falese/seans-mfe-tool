/**
 * Lockfile lane-independence (ADR-084 §5).
 *
 * ADR-084 gives the platform two delivery lanes — GitHub Packages when hosted,
 * a static mirror when offline — and the manifest is deliberately identical in
 * both: a plain semver range, selected by `.npmrc`. The lockfile is the one
 * artifact that does *not* follow that rule, because `npm ci` fetches tarballs
 * from the lock's `resolved` URL and ignores the scoped registry. A lock built
 * in one lane therefore fails in the other.
 *
 * Removing `resolved` for the platform packages restores the `.npmrc` fallback.
 * `integrity` stays, and still does its job — a tampered tarball served under
 * the original hash fails with `EINTEGRITY`.
 *
 * Pure: parses text, returns findings. The caller reads and writes files.
 */

/** The scope whose delivery lane is selected by `.npmrc` rather than the lock. */
const PLATFORM_SCOPE_PREFIX = '@falese/smt-';

export interface LaneLockedDependency {
  /** Package name, e.g. `@falese/smt-runtime`. */
  name: string;
  /** The lockfile key it was found under, for a precise fix. */
  lockPath: string;
  /** The lane-specific URL that makes this lock non-portable. */
  resolved: string;
}

interface LockPackageEntry {
  resolved?: string;
  /** npm marks workspace symlinks with this; they never survive a checkout. */
  link?: boolean;
  [key: string]: unknown;
}

/**
 * Platform packages in `lockText` that carry a `resolved` URL.
 *
 * A malformed or empty lockfile yields no findings rather than throwing: npm
 * already reports that far better than this rule could, and a validation rule
 * that turns a broken lock into a stack trace is worse than one that stays
 * quiet about it.
 */
export function findLaneLockedDependencies(lockText: string): LaneLockedDependency[] {
  let parsed: { packages?: Record<string, LockPackageEntry> };
  try {
    parsed = JSON.parse(lockText) as { packages?: Record<string, LockPackageEntry> };
  } catch {
    return [];
  }

  const packages = parsed?.packages;
  if (!packages || typeof packages !== 'object') return [];

  const hits: LaneLockedDependency[] = [];
  for (const [lockPath, entry] of Object.entries(packages)) {
    const resolved = entry?.resolved;
    if (typeof resolved !== 'string' || resolved.length === 0) continue;

    // Lockfile keys are install paths ("node_modules/@falese/smt-runtime"), so
    // the name is the tail — which also keeps nested/hoisted copies covered.
    const name = lockPath.split('node_modules/').pop() ?? lockPath;
    if (!name.startsWith(PLATFORM_SCOPE_PREFIX)) continue;

    hits.push({ name, lockPath, resolved });
  }

  return hits;
}

/**
 * The fix, which differs by what kind of entry it is:
 *
 * - a registry entry loses `resolved` and keeps `integrity`, so npm resolves it
 *   through `@falese:registry` and still verifies the tarball;
 * - a `link: true` entry is removed outright. That is a workspace symlink to a
 *   path on whoever ran the install, which cannot mean anything in another
 *   checkout — npm writes a real entry the next time it resolves the package.
 *
 * Returns the new text, or null when nothing changed so a caller can skip a
 * pointless write.
 */
export function normalizeLockfile(lockText: string): string | null {
  if (findLaneLockedDependencies(lockText).length === 0) return null;

  const parsed = JSON.parse(lockText) as { packages?: Record<string, LockPackageEntry> };
  for (const [lockPath, entry] of Object.entries(parsed.packages ?? {})) {
    const name = lockPath.split('node_modules/').pop() ?? lockPath;
    if (!name.startsWith(PLATFORM_SCOPE_PREFIX)) continue;
    if (entry.link === true) {
      delete parsed.packages![lockPath];
    } else {
      delete entry.resolved;
    }
  }

  // npm writes locks with two-space indent and a trailing newline; matching it
  // keeps the diff to the entries actually changed.
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

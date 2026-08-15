/**
 * Does a packed tarball contain the files its own manifest promises? (ADR-084)
 *
 * `files` decides what npm packs; `main`, `types` and `exports` decide what a
 * consumer resolves. Nothing makes the two agree, so a package whose compiled
 * output was never built packs and publishes cleanly and fails only at the
 * consumer's `tsc` — as `@falese/smt-runtime` did: `files` listed `dist`, no
 * build step produced `packages/runtime/dist`, and the tarball shipped four
 * forwarders pointing at a directory that did not exist. Every generated MFE
 * then compiled against an empty module, so the class extended nothing and
 * every inherited capability vanished.
 *
 * This is deliberately checked against tarball entries rather than the working
 * tree: a stale `dist/` left behind by a hand-run `tsc` makes the working tree
 * pass while a clean checkout in CI does not, which is exactly how that defect
 * reached CI green-locally/red-there.
 *
 * Pure: takes a manifest and the entry list, returns findings.
 */

export interface PackageManifestEntrypoints {
  name?: string;
  main?: string;
  types?: string;
  exports?: unknown;
}

export interface MissingEntrypoint {
  /** Manifest field that names the file, e.g. `exports["./angular"].types`. */
  field: string;
  /** The path it names, package-root relative (`dist/angular.d.ts`). */
  target: string;
}

/** `./dist/x.js` and `dist/x.js` are the same tarball entry. */
function normalize(target: string): string {
  return target.replace(/^\.\//, '');
}

/** Every `field -> path` pair a resolver can follow, including nested conditions. */
function collectTargets(manifest: PackageManifestEntrypoints): MissingEntrypoint[] {
  const targets: MissingEntrypoint[] = [];

  for (const field of ['main', 'types'] as const) {
    const value = manifest[field];
    if (typeof value === 'string') targets.push({ field, target: normalize(value) });
  }

  const walk = (node: unknown, field: string): void => {
    if (typeof node === 'string') {
      // A subpath pattern names a family of files, not one file; there is
      // nothing here to look up.
      if (!node.includes('*')) targets.push({ field, target: normalize(node) });
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      walk(child, `${field}[${JSON.stringify(key)}]`);
    }
  };
  if (manifest.exports !== undefined) walk(manifest.exports, 'exports');

  return targets;
}

/**
 * Entrypoints named by `manifest` that `entries` does not contain.
 *
 * `entries` are package-root relative paths (`npm pack` prefixes each with
 * `package/`; strip it before calling). Duplicate findings are collapsed —
 * `types` and `exports["."].types` naming one missing file is one problem.
 */
export function findMissingEntrypoints(
  manifest: PackageManifestEntrypoints,
  entries: string[]
): MissingEntrypoint[] {
  const shipped = new Set(entries.map(normalize));
  const seen = new Set<string>();

  return collectTargets(manifest).filter(({ target }) => {
    if (shipped.has(target) || seen.has(target)) return false;
    seen.add(target);
    return true;
  });
}

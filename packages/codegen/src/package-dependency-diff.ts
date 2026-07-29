/**
 * Compare a freshly-rendered `package.json` (what `package.json.ejs` would
 * write) against the current, on-disk `package.json` (what's actually
 * there), for the `dependencies` and `devDependencies` sections.
 *
 * `package.json` is developer-owned (`overwrite:false`), so `writeGeneratedFiles`
 * always skips it once it exists — the platform computes the exactly correct
 * content on every `remote:generate` and discards it. Generic across every
 * dependency the template would ever add or bump (framework version pins,
 * design-system deps, BFF/Mesh deps, build tooling): this reads the real
 * render, so it can never drift from what the template actually produces the
 * way a hand-maintained list of "the BFF deps" could.
 *
 * Pure: both arguments are already-rendered/already-read JSON text, so this
 * does no I/O and is unit-testable without touching disk.
 */

export type PackageDependencySection = 'dependencies' | 'devDependencies';

export interface PackageDependencyDiffEntry {
  section: PackageDependencySection;
  name: string;
  /** What the template would write. */
  expected: string;
  /** What's currently declared, or `undefined` if not declared at all. */
  actual?: string;
}

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const SECTIONS: readonly PackageDependencySection[] = ['dependencies', 'devDependencies'];

export function diffPackageDependencies(renderedJson: string, currentJson: string): PackageDependencyDiffEntry[] {
  const rendered = JSON.parse(renderedJson) as PackageJsonShape;
  const current = JSON.parse(currentJson) as PackageJsonShape;

  const entries: PackageDependencyDiffEntry[] = [];
  for (const section of SECTIONS) {
    const expectedDeps = rendered[section] ?? {};
    const actualDeps = current[section] ?? {};
    for (const [name, expected] of Object.entries(expectedDeps)) {
      const actual = actualDeps[name];
      if (actual !== expected) {
        entries.push({ section, name, expected, actual });
      }
    }
  }
  return entries;
}

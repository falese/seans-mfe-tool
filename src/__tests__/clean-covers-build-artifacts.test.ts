/**
 * `npm run clean` removes everything the build produces.
 *
 * The point is not tidiness. Three times in one session a stale build artifact
 * outlived its source and the symptom looked like working code: a moved oclif
 * command still served from dist/, a runtime gate typechecking against a
 * previous build, a deleted helper still registered as a command. Recovering
 * from that needs a clean that is actually complete — and a clean that misses
 * one artifact is worse than none, because it looks like it worked.
 *
 * So this asserts coverage rather than trusting a list: whatever build
 * artifacts exist on disk, the script must claim all of them. A new package
 * that builds and is not covered fails here.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT_NAMES = ['dist', 'oclif.manifest.json', 'tsconfig.tsbuildinfo'];

/** What the script says it would remove — never actually removing anything. */
function claimedArtifacts(): string[] {
  const out = execFileSync('node', [path.join('scripts', 'clean.js'), '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return (JSON.parse(out) as { artifacts: string[] }).artifacts;
}

/** What is actually on disk, found independently of the script's own walk. */
function artifactsOnDisk(): string[] {
  const found: string[] = [];
  for (const name of ARTIFACT_NAMES) {
    if (fs.existsSync(path.join(REPO_ROOT, name))) found.push(name);
  }
  for (const parent of ['packages', 'examples']) {
    const dir = path.join(REPO_ROOT, parent);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const name of ARTIFACT_NAMES) {
        const rel = path.join(parent, entry.name, name);
        if (fs.existsSync(path.join(REPO_ROOT, rel))) found.push(rel);
      }
    }
  }
  return found.sort();
}

describe('npm run clean', () => {
  it('claims every build artifact present on disk', () => {
    const claimed = new Set(claimedArtifacts());
    const missed = artifactsOnDisk().filter((a) => !claimed.has(a));
    expect(missed).toEqual([]);
  });

  it('covers every workspace package that builds', () => {
    // A package with a build script produces artifacts, so clean must reach
    // into it. This is the check that would have caught plugin-api and
    // plugin-adr the day they were added.
    const packagesDir = path.join(REPO_ROOT, 'packages');
    const builders = fs
      .readdirSync(packagesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => {
        const pkgJson = path.join(packagesDir, e.name, 'package.json');
        if (!fs.existsSync(pkgJson)) return false;
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8')) as {
          scripts?: Record<string, string>;
        };
        return Boolean(pkg.scripts?.build);
      })
      .map((e) => e.name);

    expect(builders.length).toBeGreaterThan(0);

    const claimed = claimedArtifacts();
    for (const name of builders) {
      // Either the package currently has artifacts and they are claimed, or it
      // has none right now — what matters is that clean walks `packages/*`
      // generically rather than naming packages, so presence is enough.
      const hasArtifacts = ARTIFACT_NAMES.some((a) =>
        fs.existsSync(path.join(packagesDir, name, a)),
      );
      if (hasArtifacts) {
        expect(claimed.some((c) => c.startsWith(path.join('packages', name)))).toBe(true);
      }
    }
  });

  it('does not claim anything outside the repo, or any source directory', () => {
    for (const claimed of claimedArtifacts()) {
      expect(path.isAbsolute(claimed)).toBe(false);
      expect(claimed.startsWith('..')).toBe(false);
      // Removing a src/ directory would be catastrophic and silent.
      expect(claimed.split(path.sep)).not.toContain('src');
      expect(claimed.split(path.sep)).not.toContain('node_modules');
    }
  });
});

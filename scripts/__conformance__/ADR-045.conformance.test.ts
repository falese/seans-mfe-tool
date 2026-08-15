/**
 * ADR-045 conformance — one package manager, one pinned Node line, no stray
 * workspace metadata.
 *
 * ADR-045's outcome is three "must"s: npm is authoritative for contributor, CI
 * and release workflows; the repo **must pin a default local Node line using a
 * checked-in runtime version file**; and leftover pnpm workspace metadata must
 * be **removed or explicitly documented as non-authoritative**.
 *
 * Two of the three were not true when this pack was written. There was no
 * runtime version file of any kind (no .nvmrc, .node-version or .tool-versions,
 * and no `engines`), so the Node line was pinned nowhere — CI said 20, Docker
 * said 20, and a new contributor was told by nothing at all. And
 * `pnpm-workspace.yaml` was still present, undocumented, listing a different
 * package set (`packages/*` **and** `.`) from the npm `workspaces` field that
 * actually governs installs.
 *
 * This is a repository-shape decision rather than a code one, which is why the
 * checks read files rather than importing anything. Each has been proven able
 * to fail: delete the version file (2), change it to a line CI does not use (3),
 * restore an undocumented pnpm-workspace.yaml (4).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const exists = (rel: string): boolean => fs.existsSync(path.join(REPO_ROOT, rel));

/** The files a Node version manager would read, in the order tools check them. */
const RUNTIME_VERSION_FILES = ['.nvmrc', '.node-version', '.tool-versions'];

/** Major versions named by `node-version:` across the CI workflows. */
function ciNodeMajors(): Set<string> {
  const dir = path.join(REPO_ROOT, '.github', 'workflows');
  const majors = new Set<string>();
  for (const file of fs.readdirSync(dir)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of text.matchAll(/node-version:\s*['"]?(\d+)/g)) majors.add(m[1]);
  }
  return majors;
}

describe('ADR-045: package manager and local runtime pinning', () => {
  it('declares npm as the authoritative package manager', () => {
    const pkg = JSON.parse(read('package.json')) as { packageManager?: string };
    expect(pkg.packageManager).toMatch(/^npm@/);
  });

  it('pins the local Node line in a checked-in runtime version file', () => {
    // The decision's own words: "must pin a default local Node line using a
    // checked-in runtime version file". Without one, "CI and local development
    // should agree" has nothing to agree against.
    const present = RUNTIME_VERSION_FILES.filter(exists);
    expect(present.length).toBeGreaterThan(0);
  });

  it('pins a line CI actually uses, not merely some line', () => {
    // A version file that exists but names a Node line no workflow runs would
    // satisfy "pinned" while defeating the reason for pinning. ADR-045 allows
    // CI to test several lines; the pinned default must be one of them.
    const file = RUNTIME_VERSION_FILES.find(exists);
    expect(file).toBeDefined();

    const pinned = read(file!).trim().replace(/^v/, '').split('.')[0];
    expect(ciNodeMajors()).toContain(pinned);
  });

  it('carries no undocumented pnpm workspace metadata', () => {
    // "removed or explicitly documented as non-authoritative". A bare
    // pnpm-workspace.yaml is neither — and this one listed a different package
    // set from the npm `workspaces` field, so a reader had two answers to
    // "what are the workspaces" and no way to tell which one ran.
    if (!exists('pnpm-workspace.yaml')) return;
    const text = read('pnpm-workspace.yaml');
    expect(text).toMatch(/non-authoritative/i);
  });
});

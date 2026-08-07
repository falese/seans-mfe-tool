/**
 * The conformance mechanism checks itself (ADR-000).
 *
 * A pack that is never executed is worse than no pack: the ADR names it in
 * `verified-by`, `check:adr` goes green because the file resolves, and the
 * decision reads as enforced while nothing runs. `verified-by` can only verify
 * that a path *exists*.
 *
 * That is not hypothetical. The first pack written outside a `src/` tree —
 * ADR-045's, under `scripts/__conformance__/` — matched no `testMatch` pattern
 * and was silently invisible to both `npm test` and `check:adr-conformance`.
 * It was caught only because it was expected to fail and reported "No tests
 * found" instead. A pack expected to pass would have looked exactly like
 * success.
 *
 * So: every pack on disk must be reachable from jest's configured patterns.
 *
 * One blind spot, stated rather than papered over: this file lives in the
 * directory it guards. Remove the pattern covering `scripts/__conformance__/`
 * and the harness does not fail — it stops being collected, and jest reports
 * "No tests found" instead. It catches any *other* location going unreachable
 * (proven with a fixture pack under `packages/__conformance__/`), but it cannot
 * catch its own. Guarding that needs a check outside jest — a minimum suite
 * count in the CI step — which is not built here.
 */
import * as fs from 'fs';
import * as path from 'path';

// minimatch v3 exports the function directly; v5+ exports it named. Resolved
// here rather than assumed: importing the wrong shape yields `undefined`, and a
// matcher that is undefined reports every pack as unreachable — a guard that
// fails for a reason unrelated to what it guards.
type Matcher = (target: string, pattern: string) => boolean;
const mm = require('minimatch') as Matcher & { minimatch?: Matcher; default?: Matcher };
const matches: Matcher = typeof mm === 'function' ? mm : (mm.minimatch ?? mm.default)!;

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONFORMANCE_DIR = '__conformance__';

/** Every conformance pack in the repo, as repo-relative paths. */
function findPacks(dir: string = REPO_ROOT, rel = ''): string[] {
  const skip = new Set(['node_modules', 'dist', '.git', 'coverage', 'examples']);
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (skip.has(entry.name)) return [];
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return findPacks(path.join(dir, entry.name), childRel);
    return rel.split('/').includes(CONFORMANCE_DIR) && /\.test\.[jt]sx?$/.test(entry.name)
      ? [childRel]
      : [];
  });
}

const packs = findPacks();
const { testMatch } = require(path.join(REPO_ROOT, 'jest.config.js')) as { testMatch: string[] };

describe('ADR-000: the conformance mechanism is reachable', () => {
  it('finds the packs that exist', () => {
    // A guard over an empty set guards nothing.
    expect(packs.length).toBeGreaterThan(0);
  });

  it.each(packs)('%s is matched by a jest testMatch pattern', (pack) => {
    // minimatch against the same globs jest uses. `**/` prefixes match a
    // repo-relative path, which is what jest resolves these against.
    const matched = testMatch.some((pattern) => matches(pack, pattern));
    expect(matched).toBe(true);
  });

  it('names every pack after the ADR it checks', () => {
    // The link ADR-000 relies on: a reader going from decision to checker, and
    // a reviewer spotting a pack whose subject drifted from its filename.
    for (const pack of packs) {
      const base = path.basename(pack);
      if (base.startsWith('conformance-harness')) continue; // this file checks the mechanism, not an ADR
      expect(base).toMatch(/^ADR-\d{3}\.conformance\.test\.[jt]sx?$/);
    }
  });
});

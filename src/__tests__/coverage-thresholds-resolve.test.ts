/**
 * Every per-file coverage threshold names a file that exists.
 *
 * Jest treats a threshold key with no coverage data as a failure — "Coverage
 * data for <path> was not found" — and exits non-zero even when every test
 * passes. That is the right behaviour: a threshold pointing at a moved file is
 * silently enforcing nothing.
 *
 * It is also invisible locally. `npm test` runs without --coverage, so the
 * thresholds are never evaluated; only CI's `npm test -- --ci --coverage`
 * sees them. Extracting @seans-mfe/plugin-api moved src/commands/api.ts and
 * left its threshold behind, and the first thing that noticed was a red PR
 * reporting 2780/2780 tests passed.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jestConfig = require(path.join(REPO_ROOT, 'jest.config.js')) as {
  coverageThreshold: Record<string, unknown>;
};

/** Does this threshold key still match at least one file? */
function resolves(key: string): boolean {
  if (key === 'global') return true;
  const abs = path.join(REPO_ROOT, key);
  if (!key.includes('*')) return fs.existsSync(abs);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) return false;
  const ext = path.extname(key);
  return fs.readdirSync(dir).some((f) => f.endsWith(ext));
}

describe('jest coverageThreshold', () => {
  it('has per-file entries, not just a global one', () => {
    expect(Object.keys(jestConfig.coverageThreshold).length).toBeGreaterThan(1);
  });

  it('names only paths that exist', () => {
    const stale = Object.keys(jestConfig.coverageThreshold).filter((k) => !resolves(k));
    expect(stale).toEqual([]);
  });
});

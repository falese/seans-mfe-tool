/**
 * Lockfiles must not pin a lane (ADR-084 §5).
 *
 * This rule exists because of a measured npm behaviour, not a theory. With the
 * npm cache cleared, `npm ci` fetches a tarball from the **lockfile's**
 * `resolved` URL and ignores the `.npmrc` scoped registry entirely. So a lock
 * produced against the offline mirror hard-fails in the hosted lane, and vice
 * versa — observed as `E403` against GitHub Packages while a local mirror was
 * up and serving the very same package.
 *
 * Stripping `resolved` (keeping `integrity`) restores the `.npmrc` fallback,
 * and integrity is still enforced: a tampered tarball offered under the
 * original hash is rejected with `EINTEGRITY`.
 *
 * Gated rather than documented on purpose. The duplication ADR-084 removes was
 * held together by a "keep these in sync" comment nothing enforced, and it
 * drifted. A second unenforced invariant would repeat that.
 */
import { findLaneLockedDependencies, normalizeLockfile } from '../lockfile';

const lock = (packages: Record<string, unknown>): string =>
  JSON.stringify({ name: 'mfe', lockfileVersion: 3, packages });

describe('findLaneLockedDependencies (ADR-084 §5)', () => {
  it('flags a platform package pinned to a lane URL', () => {
    const hits = findLaneLockedDependencies(
      lock({
        'node_modules/@falese/smt-runtime': {
          version: '0.1.0',
          resolved: 'http://127.0.0.1:4873/@falese/smt-runtime/-/falese-smt-runtime-0.1.0.tgz',
          integrity: 'sha512-abc',
        },
      })
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('@falese/smt-runtime');
  });

  it('flags the hosted lane too — neither URL is portable', () => {
    const hits = findLaneLockedDependencies(
      lock({
        'node_modules/@falese/smt-contracts': {
          version: '0.1.0',
          resolved: 'https://npm.pkg.github.com/@falese/smt-contracts/-/x-0.1.0.tgz',
        },
      })
    );
    expect(hits.map((h) => h.name)).toEqual(['@falese/smt-contracts']);
  });

  it('is silent once resolved is stripped, which is the fixed state', () => {
    expect(
      findLaneLockedDependencies(
        lock({
          'node_modules/@falese/smt-runtime': { version: '0.1.0', integrity: 'sha512-abc' },
        })
      )
    ).toEqual([]);
  });

  // Only the platform packages move between lanes. Rewriting public entries
  // would throw away npmjs resolution for no reason and slow every install.
  it('leaves public dependencies pinned to npmjs alone', () => {
    expect(
      findLaneLockedDependencies(
        lock({
          'node_modules/react': {
            version: '18.2.0',
            resolved: 'https://registry.npmjs.org/react/-/react-18.2.0.tgz',
          },
        })
      )
    ).toEqual([]);
  });

  it('reports every offending entry, not just the first', () => {
    const hits = findLaneLockedDependencies(
      lock({
        'node_modules/@falese/smt-runtime': { resolved: 'http://127.0.0.1:4873/a.tgz' },
        'node_modules/@falese/smt-contracts': { resolved: 'http://127.0.0.1:4873/b.tgz' },
        'node_modules/react': { resolved: 'https://registry.npmjs.org/react/-/react.tgz' },
      })
    );
    expect(hits.map((h) => h.name).sort()).toEqual([
      '@falese/smt-contracts',
      '@falese/smt-runtime',
    ]);
  });

  it('treats an unreadable lockfile as nothing to report, not a crash', () => {
    // A malformed lock is npm's problem to complain about; this rule should not
    // be the thing that turns it into a stack trace.
    expect(findLaneLockedDependencies('{not json')).toEqual([]);
    expect(findLaneLockedDependencies('')).toEqual([]);
  });
});

describe('normalizeLockfile', () => {
  it('drops resolved from a registry entry but keeps integrity', () => {
    const out = normalizeLockfile(
      lock({
        'node_modules/@falese/smt-runtime': {
          version: '0.1.0',
          resolved: 'http://127.0.0.1:4873/x.tgz',
          integrity: 'sha512-abc',
        },
      })
    );
    const entry = JSON.parse(out!).packages['node_modules/@falese/smt-runtime'];
    expect(entry.resolved).toBeUndefined();
    expect(entry.integrity).toBe('sha512-abc'); // still verifies the tarball
  });

  // A workspace symlink points at a path on whoever ran the install. The
  // examples carried one aimed at ../../../src/runtime, a directory that moved
  // to packages/runtime long ago — stripping `resolved` would leave a link with
  // no target, so the entry goes entirely and npm rewrites it.
  it('removes a link entry outright rather than leaving a targetless link', () => {
    const out = normalizeLockfile(
      lock({
        'node_modules/@falese/smt-runtime': { resolved: '../../../src/runtime', link: true },
        'node_modules/react': { resolved: 'https://registry.npmjs.org/react/-/react.tgz' },
      })
    );
    const packages = JSON.parse(out!).packages;
    expect(packages['node_modules/@falese/smt-runtime']).toBeUndefined();
    expect(packages['node_modules/react'].resolved).toContain('registry.npmjs.org');
  });

  it('returns null when there is nothing to change', () => {
    expect(normalizeLockfile(lock({ 'node_modules/react': { version: '18.2.0' } }))).toBeNull();
  });
});

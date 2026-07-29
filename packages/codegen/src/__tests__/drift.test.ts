import { diffGeneratedOwned, findOrphanedGeneratedFiles } from '../drift';
import type { GeneratedFile } from '../unified-generator';

describe('diffGeneratedOwned', () => {
  const owned = (path: string, content: string): GeneratedFile => ({ path, content, overwrite: true });
  const developer = (path: string, content: string): GeneratedFile => ({ path, content, overwrite: false });

  it('reports no drift when generator-owned files match disk', () => {
    const files = [owned('/mfe/src/remote.tsx', 'A'), owned('/mfe/server.ts', 'B')];
    const disk: Record<string, string> = { '/mfe/src/remote.tsx': 'A', '/mfe/server.ts': 'B' };
    const { drift, ownedCount } = diffGeneratedOwned(files, (p) => disk[p] ?? null);
    expect(ownedCount).toBe(2);
    expect(drift).toEqual([]);
  });

  it('flags a generator-owned file whose disk content differs as stale', () => {
    const files = [owned('/mfe/src/remote.tsx', 'NEW')];
    const disk: Record<string, string> = { '/mfe/src/remote.tsx': 'OLD' };
    const { drift } = diffGeneratedOwned(files, (p) => disk[p] ?? null);
    expect(drift).toEqual([{ file: '/mfe/src/remote.tsx', reason: 'stale' }]);
  });

  it('flags a generator-owned file that is absent on disk as missing', () => {
    const files = [owned('/mfe/server.ts', 'B')];
    const { drift } = diffGeneratedOwned(files, () => null);
    expect(drift).toEqual([{ file: '/mfe/server.ts', reason: 'missing' }]);
  });

  it('ignores developer-owned (overwrite:false) files even when they differ', () => {
    const files = [developer('/mfe/package.json', 'NEW'), developer('/mfe/rspack.config.js', 'NEW')];
    const disk: Record<string, string> = { '/mfe/package.json': 'OLD', '/mfe/rspack.config.js': 'OLD' };
    const { drift, ownedCount } = diffGeneratedOwned(files, (p) => disk[p] ?? null);
    expect(ownedCount).toBe(0);
    expect(drift).toEqual([]);
  });

  it('checks only generator-owned files in a mixed set', () => {
    const files = [
      owned('/mfe/src/remote.tsx', 'NEW'),
      developer('/mfe/package.json', 'NEW'),
    ];
    const disk: Record<string, string> = { '/mfe/src/remote.tsx': 'OLD', '/mfe/package.json': 'OLD' };
    const { drift, ownedCount } = diffGeneratedOwned(files, (p) => disk[p] ?? null);
    expect(ownedCount).toBe(1);
    expect(drift).toEqual([{ file: '/mfe/src/remote.tsx', reason: 'stale' }]);
  });
});

describe('findOrphanedGeneratedFiles', () => {
  const owned = (path: string, content: string): GeneratedFile => ({ path, content, overwrite: true });
  const developer = (path: string, content: string): GeneratedFile => ({ path, content, overwrite: false });

  it('flags a generator-owned file the current manifest no longer generates but that is still on disk', () => {
    // e.g. `data:` removed from the manifest: `server.ts` was generator-owned
    // under the old (maximal) shape, is absent from the real generation, and
    // is still sitting on disk from before the manifest shrank.
    const real = [owned('/mfe/src/remote.tsx', 'A')];
    const maximal = [owned('/mfe/src/remote.tsx', 'A'), owned('/mfe/server.ts', 'B')];
    const disk: Record<string, string> = { '/mfe/src/remote.tsx': 'A', '/mfe/server.ts': 'B' };
    const orphaned = findOrphanedGeneratedFiles(real, maximal, (p) => disk[p] ?? null);
    expect(orphaned).toEqual([{ file: '/mfe/server.ts', reason: 'orphaned' }]);
  });

  it('reports no orphans for a clean MFE with nothing extra on disk', () => {
    const real = [owned('/mfe/src/remote.tsx', 'A')];
    const maximal = [owned('/mfe/src/remote.tsx', 'A'), owned('/mfe/server.ts', 'B')];
    const disk: Record<string, string> = { '/mfe/src/remote.tsx': 'A' };
    const orphaned = findOrphanedGeneratedFiles(real, maximal, (p) => disk[p] ?? null);
    expect(orphaned).toEqual([]);
  });

  it('does not flag a path the real generation still owns, even if content differs', () => {
    // that's diffGeneratedOwned's job (stale), not an orphan
    const real = [owned('/mfe/server.ts', 'NEW')];
    const maximal = [owned('/mfe/server.ts', 'NEW')];
    const disk: Record<string, string> = { '/mfe/server.ts': 'OLD' };
    const orphaned = findOrphanedGeneratedFiles(real, maximal, (p) => disk[p] ?? null);
    expect(orphaned).toEqual([]);
  });

  it('never flags a developer-owned path from the maximal set, even if absent from disk-tracked real generation', () => {
    const real: GeneratedFile[] = [];
    const maximal = [developer('/mfe/package.json', 'B')];
    const disk: Record<string, string> = { '/mfe/package.json': 'B' };
    const orphaned = findOrphanedGeneratedFiles(real, maximal, (p) => disk[p] ?? null);
    expect(orphaned).toEqual([]);
  });

  it('does not flag a maximal-owned path that was never written to disk', () => {
    const real = [owned('/mfe/src/remote.tsx', 'A')];
    const maximal = [owned('/mfe/src/remote.tsx', 'A'), owned('/mfe/server.ts', 'B')];
    const orphaned = findOrphanedGeneratedFiles(real, maximal, () => null);
    expect(orphaned).toEqual([]);
  });
});

import { diffGeneratedOwned } from '../drift';
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

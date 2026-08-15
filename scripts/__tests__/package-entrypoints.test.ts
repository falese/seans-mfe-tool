/**
 * The regression this encodes: `@falese/smt-runtime` shipped a tarball with its
 * four Node10 forwarders and no `dist/`, because no build step compiled
 * `packages/runtime/dist`. `files` was satisfied, `npm pack` was silent, and
 * every generated MFE compiled against an empty module — the class extended
 * nothing and all ten capabilities disappeared. The manifest promising a file
 * the tarball does not carry is the only observable, so that is what this
 * checks.
 */
import { findMissingEntrypoints } from '../package-entrypoints';

const RUNTIME_MANIFEST = {
  name: '@falese/smt-runtime',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    './react': { types: './dist/react.d.ts', default: './dist/react.js' },
    './angular': { types: './dist/angular.d.ts', default: './dist/angular.js' },
    './package.json': './package.json',
  },
};

const BUILT_ENTRIES = [
  'package.json',
  'react.js',
  'react.d.ts',
  'angular.js',
  'angular.d.ts',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/react.js',
  'dist/react.d.ts',
  'dist/angular.js',
  'dist/angular.d.ts',
];

describe('findMissingEntrypoints', () => {
  it('passes a package that ships everything its manifest names', () => {
    expect(findMissingEntrypoints(RUNTIME_MANIFEST, BUILT_ENTRIES)).toEqual([]);
  });

  it('catches the forwarders-without-dist tarball, naming each subpath', () => {
    const forwardersOnly = BUILT_ENTRIES.filter((e) => !e.startsWith('dist/'));

    const missing = findMissingEntrypoints(RUNTIME_MANIFEST, forwardersOnly);

    expect(missing.map((m) => m.target)).toEqual([
      'dist/index.js',
      'dist/index.d.ts',
      'dist/react.d.ts',
      'dist/react.js',
      'dist/angular.d.ts',
      'dist/angular.js',
    ]);
    // The field is the actionable half: it says which subpath a consumer loses.
    expect(missing.map((m) => m.field)).toContain('exports["./angular"]["types"]');
  });

  it('reports one finding per file, however many fields name it', () => {
    // `types` and `exports["."].types` are the same file; two resolvers, one fix.
    const missing = findMissingEntrypoints(
      { types: './dist/index.d.ts', exports: { '.': { types: './dist/index.d.ts' } } },
      ['package.json']
    );

    expect(missing).toEqual([{ field: 'types', target: 'dist/index.d.ts' }]);
  });

  it('treats ./x and x as the same entry', () => {
    expect(findMissingEntrypoints({ main: './dist/index.js' }, ['dist/index.js'])).toEqual([]);
    expect(findMissingEntrypoints({ main: 'dist/index.js' }, ['./dist/index.js'])).toEqual([]);
  });

  it('ignores subpath patterns, which name a family rather than a file', () => {
    expect(findMissingEntrypoints({ exports: { './*': './dist/*.js' } }, ['package.json'])).toEqual(
      []
    );
  });

  it('says nothing about a manifest that names no entrypoints', () => {
    expect(findMissingEntrypoints({ name: '@falese/smt-contracts' }, [])).toEqual([]);
  });
});

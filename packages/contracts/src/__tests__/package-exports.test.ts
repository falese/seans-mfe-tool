/**
 * Packaging pin: `@falese/smt-contracts` must actually export what it contains.
 *
 * Two surfaces have to agree with the source tree, and neither is exercised by
 * ordinary tests — jest's `moduleNameMapper` rewrites `@falese/smt-contracts/*`
 * straight to source, so a subpath missing from `package.json#exports` resolves
 * fine here and throws ERR_PACKAGE_PATH_NOT_EXPORTED for a real consumer:
 *
 *   1. `src/index.ts`  — the barrel, for `import { X } from '@falese/smt-contracts'`
 *   2. `package.json#exports` — for `import { X } from '@falese/smt-contracts/slot-contract'`
 *
 * When this was written, (2) listed 6 of 10 modules: build-output-parser,
 * presentation, framework-plugin, slot-grammar, and slot-contract had no
 * subpath at all. Nothing in-repo imports by subpath, so nothing noticed.
 */
import * as fs from 'fs';
import * as path from 'path';

const PKG_ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(PKG_ROOT, 'src');

interface ExportConditions {
  require?: string;
  types?: string;
}

const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as {
  main: string;
  types: string;
  files: string[];
  exports: Record<string, ExportConditions>;
};

/**
 * The package's public modules: every top-level `.ts` in src (except the
 * barrel), plus the `errors/` directory, which is public through its own
 * index. Files under `errors/` are reached via that barrel, not individually.
 */
function publicModules(): string[] {
  const entries = fs.readdirSync(SRC, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && e.name !== 'index.ts')
    .map((e) => e.name.replace(/\.ts$/, ''));
  const dirs = entries
    .filter((e) => e.isDirectory() && e.name !== '__tests__')
    .filter((e) => fs.existsSync(path.join(SRC, e.name, 'index.ts')))
    .map((e) => e.name);
  return [...files, ...dirs].sort();
}

const MODULES = publicModules();

describe('@falese/smt-contracts packaging', () => {
  it('has public modules to check (guards against a silently empty sweep)', () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(10);
    expect(MODULES).toContain('platform-contract');
    expect(MODULES).toContain('errors');
  });

  describe('package.json#exports', () => {
    it('declares a subpath for every public module', () => {
      const declared = Object.keys(pkg.exports)
        .filter((k) => k !== '.')
        .map((k) => k.replace(/^\.\//, ''))
        .sort();
      expect(declared).toEqual(MODULES);
    });

    it('declares no subpath without a module behind it', () => {
      for (const subpath of Object.keys(pkg.exports)) {
        if (subpath === '.') continue;
        const name = subpath.replace(/^\.\//, '');
        const asFile = path.join(SRC, `${name}.ts`);
        const asDir = path.join(SRC, name, 'index.ts');
        expect(fs.existsSync(asFile) || fs.existsSync(asDir)).toBe(true);
      }
    });

    it('points every subpath at the compiled output for its own name', () => {
      for (const name of MODULES) {
        const entry = pkg.exports[`./${name}`];
        expect(entry).toBeDefined();
        // Directory modules compile to `<name>/index.js`; files to `<name>.js`.
        const isDir = fs.existsSync(path.join(SRC, name, 'index.ts'));
        const stem = isDir ? `${name}/index` : name;
        expect(entry.require).toBe(`./dist/${stem}.js`);
        expect(entry.types).toBe(`./dist/${stem}.d.ts`);
      }
    });

    it('exposes the root entry consistently with main/types', () => {
      expect(pkg.exports['.'].require).toBe(pkg.main);
      expect(pkg.exports['.'].types).toBe(pkg.types);
    });

    it('ships the directory every export target lives in', () => {
      expect(pkg.files).toContain('dist');
      for (const entry of Object.values(pkg.exports)) {
        expect(entry.require?.startsWith('./dist/')).toBe(true);
        expect(entry.types?.startsWith('./dist/')).toBe(true);
      }
    });
  });

  describe('src/index.ts barrel', () => {
    const barrel = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf8');

    it('re-exports every public module', () => {
      for (const name of MODULES) {
        // `./errors/index` and `./errors` are both acceptable spellings.
        const re = new RegExp(`from '\\./${name}(/index)?'`);
        expect(barrel).toMatch(re);
      }
    });

    it('re-exports nothing that is not a public module', () => {
      const referenced = [...barrel.matchAll(/from '\.\/([^']+)'/g)].map((m) =>
        m[1].replace(/\/index$/, '')
      );
      for (const name of referenced) {
        expect(MODULES).toContain(name);
      }
    });

    it('surfaces every module’s exported names — no silent `export *` collision', async () => {
      // Two modules exporting the same name makes `export *` drop it from the
      // barrel silently. Compare each module's own exports against the barrel.
      const index = (await import('../index')) as Record<string, unknown>;
      const missing: string[] = [];

      for (const name of MODULES) {
        const mod = (await import(`../${name}`)) as Record<string, unknown>;
        for (const key of Object.keys(mod)) {
          if (key === 'default') continue;
          if (!(key in index)) missing.push(`${name}.${key}`);
        }
      }

      expect(missing).toEqual([]);
    });
  });
});

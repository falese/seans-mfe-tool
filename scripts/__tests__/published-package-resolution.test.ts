/**
 * The published runtime must resolve under Node10, not just under `exports`.
 *
 * Generated MFEs compile with `moduleResolution: "node"` (see the generated
 * tsconfig), which ignores the `exports` map completely and resolves
 * `@falese/smt-runtime/react` as a literal path inside the package. When the
 * runtime moved its output under `dist/` (ADR-084) that path stopped existing,
 * and the failure was silent in the worst way: `RemoteMFE` did not resolve, the
 * generated class extended nothing, and every inherited capability vanished —
 * `Property 'load' does not exist on type 'widgetanalyzerMFE'`.
 *
 * No unit test caught it, because jest resolves these packages through
 * `moduleNameMapper` straight to source. This asserts on the *shipped* file
 * list instead, which is the thing a consumer actually gets.
 */
import * as path from 'path';
import * as fs from 'fs-extra';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_DIR = path.join(REPO_ROOT, 'packages', 'runtime');
const pkg = fs.readJsonSync(path.join(RUNTIME_DIR, 'package.json')) as {
  files: string[];
  dependencies?: Record<string, string>;
  exports: Record<string, { types?: string; default?: string }>;
};

describe('@falese/smt-runtime resolves under Node10 (ADR-084)', () => {
  // The subpaths a generated MFE imports: mfe.ts takes RemoteMFE from /react,
  // the Angular variant takes AngularRemoteMFE from /angular.
  it.each(['react', 'angular'])('ships a root-level forwarder for ./%s', (subpath) => {
    for (const ext of ['js', 'd.ts']) {
      const file = `${subpath}.${ext}`;
      expect(fs.existsSync(path.join(RUNTIME_DIR, file))).toBe(true);
      // Shipped, not merely present in the working tree.
      expect(pkg.files).toContain(file);
    }
  });

  it('points each forwarder at the compiled output it stands in for', () => {
    expect(fs.readFileSync(path.join(RUNTIME_DIR, 'react.js'), 'utf8')).toContain(
      "require('./dist/react.js')"
    );
    expect(fs.readFileSync(path.join(RUNTIME_DIR, 'angular.js'), 'utf8')).toContain(
      "require('./dist/angular.js')"
    );
  });

  it('keeps exports and forwarders describing the same files', () => {
    // Two ways to reach one module; they must not drift apart, or modern and
    // legacy resolvers would load different code.
    expect(pkg.exports['./react'].default).toBe('./dist/react.js');
    expect(pkg.exports['./angular'].default).toBe('./dist/angular.js');
  });

  it('ships dist, so the forwarders have something to forward to', () => {
    expect(pkg.files).toContain('dist');
  });

  it('is compiled by build:packages, so that dist exists to be packed', () => {
    // `files` listing `dist` is a promise no build step kept: runtime was the
    // one package missing from this list, so every tarball shipped forwarders
    // pointing at a directory that was never compiled. tsconfig.build.json does
    // not close it — that emits the repo-root dist/runtime staging artifact,
    // not the package's own dist.
    const scripts = (
      fs.readJsonSync(path.join(REPO_ROOT, 'package.json')) as { scripts: Record<string, string> }
    ).scripts;

    expect(scripts['build:packages']).toContain('packages/runtime');
  });

  it('declares the contracts package its compiled output requires', () => {
    // The runtime re-exports contracts types and requires it at runtime, so an
    // installed MFE that does not happen to declare contracts itself resolves
    // neither. A dependency is what makes that npm's job rather than luck.
    expect(pkg.dependencies?.['@falese/smt-contracts']).toBeDefined();
  });
});

// The framework packages have the same shape and the same exposure: generated
// slots.tsx binds their DeclaredSlot through the /runtime subpath (ADR-084), so
// a missing forwarder breaks every generated MFE's typecheck the same way.
describe.each(['framework-react', 'framework-angular'])(
  '@falese/smt-%s resolves under Node10',
  (name) => {
    const dir = path.resolve(__dirname, '..', '..', 'packages', name);
    const manifest = fs.readJsonSync(path.join(dir, 'package.json')) as {
      files: string[];
      exports: Record<string, { types?: string; require?: string }>;
    };

    it('ships a root-level forwarder for ./runtime', () => {
      for (const file of ['runtime.js', 'runtime.d.ts']) {
        expect(fs.existsSync(path.join(dir, file))).toBe(true);
        expect(manifest.files).toContain(file);
      }
    });

    it('forwards to the same file the exports map names', () => {
      expect(manifest.exports['./runtime'].require).toBe('./dist/runtime/index.js');
      expect(fs.readFileSync(path.join(dir, 'runtime.js'), 'utf8')).toContain(
        "require('./dist/runtime/index.js')"
      );
    });
  }
);

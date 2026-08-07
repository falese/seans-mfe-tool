/**
 * ADR-020 conformance — the Bun/Node entry split, checked by running both.
 *
 * ADR-020 keeps two permanent entry points: `bin/dev.ts` under Bun for local
 * development, and `bin/run.js` under Node as the published entry. Its stated
 * consequences are that the published package has zero Bun dependency, that
 * `bin/dev.ts` is never published, and that the two "behave identically (same
 * source, different runner)".
 *
 * That last claim was false in the strongest possible way: `bun bin/dev.ts
 * <any command>` failed outright.
 *
 *     error: Cannot find module '@falese/smt-contracts'
 *       from '/…/packages/oclif-base/src/BaseCommand.ts'
 *
 * Bun honours tsconfig `paths` and Node does not, so under Bun a command
 * reached `@falese/smt-oclif-base` as TypeScript source, which imports
 * `@falese/smt-contracts` — whose `exports` map declared only `require` and
 * `types`. With no `import` or `default` condition there is nothing for an ESM
 * resolver to pick, so resolution failed. Twenty-three subpaths across seven
 * packages were in that state.
 *
 * It survived because nothing ever ran the dev entry with a real command.
 * `--version` and `--help` load no command module, so the entry point looked
 * healthy from the outside while every actual invocation was broken.
 *
 * The same defect faces published consumers: an ESM `import` of any of these
 * packages fails with ERR_PACKAGE_PATH_NOT_EXPORTED. Only `@falese/smt-runtime`
 * had a `default` condition, and only because ADR-084 work added one.
 *
 * Scope, stated so this does not read as broader than it is: **this pack does
 * not check ADR-020's "zero-transpile development loop"**. That claim is also
 * false — `bun bin/dev.ts` executes `dist/commands/*.js`, so a source edit is
 * invisible without a rebuild — but making it true is an oclif
 * command-discovery decision, not a fix, and is left to the human. The
 * evidence is in the PR discussion rather than asserted here, because a check
 * that fails by design is a broken gate.
 *
 * Each check proven able to fail: remove a `default` condition (1), add
 * `bin/dev.ts` to `files` (2), break `bin/run.js` under plain Node (3).
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Real subprocesses, not mocks: the whole point is which runtime resolves what.
jest.useRealTimers();

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;

type Conditions = Record<string, string>;

/** Every workspace package that declares an `exports` map, with that map. */
function packagesWithExports(): { name: string; exports: Record<string, Conditions> }[] {
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const manifest = path.join(PACKAGES_DIR, entry.name, 'package.json');
      if (!fs.existsSync(manifest)) return [];
      const pkg = readJson(manifest);
      const exportsMap = pkg.exports as Record<string, Conditions> | undefined;
      return exportsMap ? [{ name: entry.name, exports: exportsMap }] : [];
    });
}

describe('ADR-020: Bun for dev entry, Node for published entry', () => {
  it('leaves every package subpath resolvable by an ESM importer', () => {
    // The defect that broke the dev entry, stated as the property rather than
    // as "Bun works": a conditional exports map with only `require` gives an
    // ESM resolver nothing to select, and Node answers
    // ERR_PACKAGE_PATH_NOT_EXPORTED. Bun was simply the first consumer to
    // notice — published ESM consumers hit the same wall.
    const packages = packagesWithExports();
    expect(packages.length).toBeGreaterThan(5);

    const unreachable: string[] = [];
    for (const { name, exports: map } of packages) {
      for (const [subpath, conditions] of Object.entries(map)) {
        if (typeof conditions !== 'object' || conditions === null) continue;
        if (conditions.import || conditions.default) continue;
        unreachable.push(`${name}${subpath.slice(1)}`);
      }
    }
    expect(unreachable).toEqual([]);
  });

  it('never publishes the Bun entry', () => {
    // "Never published" is ADR-020's word. bin/dev.ts carries a `#!/usr/bin/env
    // bun` shebang, so shipping it would put a Bun requirement in a package
    // whose whole premise is not needing one.
    const pkg = readJson(path.join(REPO_ROOT, 'package.json'));
    const files = pkg.files as string[];

    expect(files).toContain('bin/run.js');
    expect(files).not.toContain('bin');
    expect(files.some((f) => f.includes('dev.ts'))).toBe(false);
    expect(pkg.bin).toEqual({ 'seans-mfe-tool': './bin/run.js' });
  });

  it('runs the published entry on plain Node', () => {
    // Not "the file parses" — actually execute it with node and require a
    // real answer back. A published entry that needs Bun, or needs a
    // devDependency, fails here rather than in a consumer's terminal.
    const out = execFileSync('node', [path.join(REPO_ROOT, 'bin', 'run.js'), '--version'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(out).toContain('seans-mfe-tool/');
  });

  it('gives the same answer from both entry points', () => {
    // ADR-020's "behave identically (same source, different runner)". Skipped
    // rather than failed when Bun is absent: a contributor without Bun is a
    // supported state, and a gate that fails for a missing optional tool
    // teaches people to ignore it.
    let bun: string;
    try {
      bun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim();
    } catch {
      return;
    }

    // A real MFE that validates clean, so both runners do the same non-trivial
    // work — read a manifest, a package.json and a federation config — rather
    // than agreeing on an error string.
    const target = path.join(REPO_ROOT, 'examples', 'abc-kids', 'animal-sounds');
    const args = ['mfe:validate', target, '--json'];
    const viaNode = execFileSync('node', [path.join(REPO_ROOT, 'bin', 'run.js'), ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    const viaBun = execFileSync(bun, [path.join(REPO_ROOT, 'bin', 'dev.ts'), ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    // Envelope telemetry carries timings and a fresh correlation id, so the
    // payload is what must match, not the bytes.
    const payload = (envelope: string): unknown => {
      const parsed = JSON.parse(envelope.trim().split('\n').pop() as string) as {
        ok: boolean;
        data?: unknown;
      };
      return { ok: parsed.ok, data: parsed.data };
    };
    expect(payload(viaBun)).toEqual(payload(viaNode));
  });
});

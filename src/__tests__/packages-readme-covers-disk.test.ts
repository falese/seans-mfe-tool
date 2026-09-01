/**
 * `packages/README.md` names every package that exists, and no package that doesn't.
 *
 * The README is the entry point to the reading order — the first file a
 * newcomer opens and the one they check `ls packages/` against second. That
 * makes a stale name there more expensive than a stale name anywhere else, and
 * it went stale in the same pull request that moved the packages: three
 * extractions landed, `bff-plugin` kept its old name in the table and the
 * layering diagram, and `plugin-api`/`plugin-adr` — the largest thing that
 * moved — had no row at all. Ten packages on disk, eight in the reading order.
 * A reviewer reading cold found it; nothing here did.
 *
 * The namespace assertion is the second half of the same class. ADR-021
 * reserves `@seans-mfe/*` for first-party packages and nothing checked package
 * *names*, which is how `@falese/bff-plugin` sat in violation until it was
 * renamed by hand — and how `@seans-mfe-tool/runtime` still does.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES = path.join(REPO_ROOT, 'packages');
const README = path.join(PACKAGES, 'README.md');

/**
 * `runtime` publishes as `@seans-mfe-tool/runtime`, which ADR-021's own table
 * lists as `@seans-mfe/runtime`. It is a real violation and is deliberately
 * not fixed here: every generated MFE imports that specifier and every
 * example's `package.json` declares it, so the rename is a platform migration
 * (ADR-082) rather than an edit. Tracked in #362; recorded here as one named
 * exception so it stays visible and no *new* violation can hide behind it.
 * Removing this entry is that issue's definition of done.
 */
const NAMESPACE_EXCEPTIONS: Record<string, string> = {
  runtime: '@seans-mfe-tool/runtime',
};

/** Directories under `packages/` that ship a `package.json`. */
function workspacePackages(): string[] {
  return fs
    .readdirSync(PACKAGES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(PACKAGES, name, 'package.json')))
    .sort();
}

describe('packages/README.md', () => {
  const readme = fs.readFileSync(README, 'utf8');

  it('finds the packages on disk', () => {
    expect(workspacePackages().length).toBeGreaterThan(5);
  });

  it.each(workspacePackages())('names %s', (pkg) => {
    // Bolded in the table row, which is how every existing entry writes it.
    expect(readme).toContain(`**${pkg}**`);
  });

  it('does not name a directory that no longer exists', () => {
    // Table rows only. Scanning the whole file for bold text sweeps up prose
    // emphasis — `**not**` in the control-plane note reads as a package named
    // "not" — so this reads the package cell of each `| n | **name** | …` row.
    const named = readme
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .flatMap((line) => [...line.matchAll(/\*\*([a-z][a-z0-9-]*)\*\*/g)].map((m) => m[1]));
    const onDisk = new Set([
      ...workspacePackages(),
      // Present under packages/ but not a workspace member: two Dockerised JS
      // services, documented as such in the README's own footnote row.
      'control-plane',
    ]);

    for (const name of new Set(named)) {
      expect({ name, onDisk: onDisk.has(name) }).toEqual({ name, onDisk: true });
    }
  });
});

describe('package namespaces (ADR-021)', () => {
  it.each(workspacePackages())('%s publishes under a first-party scope', (pkg) => {
    const { name } = JSON.parse(
      fs.readFileSync(path.join(PACKAGES, pkg, 'package.json'), 'utf8'),
    ) as { name: string };

    if (NAMESPACE_EXCEPTIONS[pkg]) {
      expect(name).toBe(NAMESPACE_EXCEPTIONS[pkg]);
      return;
    }

    expect(name).toBe(`@seans-mfe/${pkg}`);
  });
});

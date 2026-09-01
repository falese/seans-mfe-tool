/**
 * The package layering is one-way, and this test is what makes that true.
 *
 * `packages/` is a flat list of siblings, so nothing about the filesystem says
 * which package may depend on which. The direction is real architecture —
 * `@seans-mfe/contracts` is zero-dependency by invariant (ADR-061, ADR-080),
 * which is precisely what lets the DSL (zod), the runtime (staged into
 * generated MFEs) and codegen (build-time) all depend on it without pulling
 * each other in. A convenience import in the wrong direction would take that
 * away quietly, and nothing would go red.
 *
 * A directory grouping would have documented the layering; only a test
 * enforces it (ADR-077 §2: `enforcement: code`, never `convention`).
 *
 * WHY THIS PARSES INSTEAD OF GREPPING: a naive search for
 * `from '@seans-mfe/...'` reports three violations that do not exist —
 * contracts→runtime, dsl→codegen, codegen→runtime — because it matches
 * package names inside doc comments and inside test fixtures that assert on
 * import statements as string input (see codegen's platform-migrations tests).
 * Reading real ImportDeclaration nodes is the difference between a gate and a
 * false alarm.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const PACKAGES_DIR = path.resolve(__dirname, '..', '..', 'packages');

/**
 * Who each package is allowed to import. A package absent from a list is
 * forbidden, so adding an edge is a deliberate edit here — which is the point.
 */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  contracts: [],
  dsl: ['contracts'],
  runtime: ['contracts', 'dsl'],
  codegen: ['contracts', 'dsl'],
  'oclif-base': ['contracts'],
  'framework-react': ['contracts'],
  'framework-angular': ['contracts'],
  'plugin-bff': ['contracts', 'codegen', 'oclif-base'],
  'plugin-api': ['contracts', 'oclif-base'],
  'plugin-adr': ['contracts', 'oclif-base'],
  'plugin-coder': ['contracts', 'dsl', 'oclif-base'],
};

/** First-party scopes. `@seans-mfe-tool/runtime` is the runtime's published name. */
const FIRST_PARTY = /^@(?:seans-mfe|seans-mfe-tool|falese)\/([a-z-]+)/;

/** Package name as it appears on disk, from an import specifier. */
function resolvePackage(specifier: string): string | undefined {
  const m = FIRST_PARTY.exec(specifier);
  if (!m) return undefined;
  // @seans-mfe/plugin-bff and @seans-mfe/bff-plugin both live at packages/plugin-bff.
  return m[1];
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        // Tests legitimately import across packages, and fixtures contain
        // import statements as data. Neither is a production edge.
        if (entry.name !== '__tests__' && entry.name !== 'dist' && entry.name !== 'node_modules') {
          walk(p);
        }
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

/** Real module specifiers, from the AST — not from a regex over the text. */
function importedPackages(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const pkg = resolvePackage(node.moduleSpecifier.text);
      if (pkg) found.push(pkg);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const packagesOnDisk = fs
  .readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, e.name, 'src')))
  .map((e) => e.name)
  .sort();

describe('package import direction', () => {
  it('has an allow-list entry for every package with sources', () => {
    // A new package must declare its edges rather than inherit "anything goes".
    expect(packagesOnDisk.filter((p) => !(p in ALLOWED))).toEqual([]);
  });

  describe.each(packagesOnDisk.filter((p) => p in ALLOWED))('%s', (pkg) => {
    const allowed = ALLOWED[pkg];

    it(`imports only: ${allowed.length ? allowed.join(', ') : '(nothing first-party)'}`, () => {
      const violations: string[] = [];
      for (const file of sourceFiles(path.join(PACKAGES_DIR, pkg, 'src'))) {
        for (const dep of importedPackages(file)) {
          if (dep === pkg) continue; // self-reference via published name
          if (!allowed.includes(dep)) {
            violations.push(`${path.relative(PACKAGES_DIR, file)} -> ${dep}`);
          }
        }
      }
      expect(violations).toEqual([]);
    });
  });

  it('contracts depends on no first-party package (ADR-061, ADR-080)', () => {
    // Called out separately because it is the invariant the whole layering
    // rests on: contracts is the one package everything else may reach.
    expect(ALLOWED.contracts).toEqual([]);
    const edges = sourceFiles(path.join(PACKAGES_DIR, 'contracts', 'src')).flatMap((f) =>
      importedPackages(f).filter((d) => d !== 'contracts'),
    );
    expect(edges).toEqual([]);
  });

  it('no package imports the CLI', () => {
    const offenders: string[] = [];
    for (const pkg of packagesOnDisk) {
      for (const file of sourceFiles(path.join(PACKAGES_DIR, pkg, 'src'))) {
        const text = fs.readFileSync(file, 'utf8');
        const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
        sf.forEachChild((node) => {
          if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier) &&
            /(^|\/)src\/commands\//.test(node.moduleSpecifier.text)
          ) {
            offenders.push(`${path.relative(PACKAGES_DIR, file)} -> ${node.moduleSpecifier.text}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no cycles', () => {
    const seen = new Set<string>();
    const stack = new Set<string>();
    const cycles: string[] = [];
    const visit = (pkg: string, trail: string[]): void => {
      if (stack.has(pkg)) {
        cycles.push([...trail, pkg].join(' -> '));
        return;
      }
      if (seen.has(pkg)) return;
      seen.add(pkg);
      stack.add(pkg);
      for (const dep of ALLOWED[pkg] ?? []) visit(dep, [...trail, pkg]);
      stack.delete(pkg);
    };
    for (const pkg of Object.keys(ALLOWED)) visit(pkg, []);
    expect(cycles).toEqual([]);
  });
});

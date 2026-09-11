/**
 * A package that reads templates at runtime must ship them, and must find them
 * inside its own root.
 *
 * Both halves were broken, in opposite directions, and neither was visible in
 * the repo — every path resolves correctly from a monorepo checkout, which is
 * the only place any test or gate had ever run them:
 *
 *   @seans-mfe/plugin-bff   owns templates/, resolves them correctly, and
 *                           omitted them from `files`. `npm pack` produced a
 *                           tarball with ZERO template files, so the published
 *                           plugin could not scaffold a BFF at all.
 *
 *   @seans-mfe/codegen      ships its own templates/, but reaches the BFF ones
 *                           through `../../../packages/plugin-bff/templates` —
 *                           a path that escapes its package root, is undeclared
 *                           in package.json, and points at a package that
 *                           depends on codegen (a cycle npm cannot see).
 *
 * The escape is pinned rather than ignored: it is the known exception, and the
 * injection point that removes it is the file-plan work in
 * docs/generator-extraction-plan.md Phase 4, whose acceptance test is a plugin
 * contributing generated files without core naming its templates. Until then a
 * NEW escape fails here immediately, and deleting the known one is a deliberate
 * edit to this list rather than something that happens by accident.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES = path.join(REPO_ROOT, 'packages');

/** Packages that carry a `templates/` directory. */
function packagesWithTemplates(): string[] {
  return fs
    .readdirSync(PACKAGES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PACKAGES, d.name, 'templates')))
    .map((d) => d.name)
    .sort();
}

/**
 * Runtime template-directory resolutions that deliberately leave their own
 * package. Each entry is a defect with a known owner, not an approved pattern.
 */
const KNOWN_ESCAPES: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: 'packages/codegen/src/unified-generator.ts',
    reason:
      'reads plugin-bff templates via a relative path escape; removed when a plugin can ' +
      'contribute FileSpecs to the generation plan (extraction plan, Phase 4)',
  },
];

describe('packages ship the templates they read', () => {
  it('finds packages with templates (guards against a silently empty sweep)', () => {
    expect(packagesWithTemplates().length).toBeGreaterThan(0);
  });

  it.each(packagesWithTemplates())('%s declares templates/ in package.json files', (pkg) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(PACKAGES, pkg, 'package.json'), 'utf8'),
    ) as { files?: string[] };

    // `files` absent means "publish everything not ignored", which does ship
    // templates. An explicit list that omits them does not.
    if (!manifest.files) return;
    expect(manifest.files).toContain('templates');
  });
});

describe('template resolution stays inside its own package', () => {
  /** Every `path.resolve(__dirname, …, 'templates'…)` under packages/*_/src. */
  function templateResolutions(): Array<{ file: string; line: number; text: string }> {
    const hits: Array<{ file: string; line: number; text: string }> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'dist')
            continue;
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
        fs.readFileSync(full, 'utf8')
          .split('\n')
          .forEach((text, i) => {
            if (/path\.(resolve|join)\([^)]*templates/.test(text)) {
              hits.push({ file: path.relative(REPO_ROOT, full), line: i + 1, text: text.trim() });
            }
          });
      }
    };
    for (const pkg of fs.readdirSync(PACKAGES)) {
      const src = path.join(PACKAGES, pkg, 'src');
      if (fs.existsSync(src)) walk(src);
    }
    return hits;
  }

  it('finds template resolutions to check', () => {
    expect(templateResolutions().length).toBeGreaterThan(0);
  });

  it('has no unrecorded cross-package template reference', () => {
    // A resolution naming another package by path is an escape. `../..` alone
    // is fine — plugin-bff's commands sit two directories deep inside dist/.
    const escapes = templateResolutions()
      .filter((h) => /packages\//.test(h.text))
      .map((h) => `${h.file}:${h.line}`);

    const known = KNOWN_ESCAPES.map((e) => e.file);
    const unrecorded = escapes.filter((e) => !known.some((k) => e.startsWith(k)));

    expect(unrecorded).toEqual([]);
  });

  it('keeps the known-escape list honest — every entry still escapes', () => {
    // A stale allowance is how the original defect survived: remove the escape
    // and this fails, forcing the exception to be deleted with it rather than
    // left behind as permission for the next one.
    const escapeFiles = new Set(
      templateResolutions()
        .filter((h) => /packages\//.test(h.text))
        .map((h) => h.file),
    );
    for (const entry of KNOWN_ESCAPES) {
      expect(escapeFiles.has(entry.file)).toBe(true);
    }
  });
});

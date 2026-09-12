/**
 * `validateManifestPlugins` / `validateManifestTransforms` read pre-Zod YAML.
 *
 * Their own comments say so: the fields they read are not on `DSLManifest`, and
 * the unknown-narrowed access exists precisely to "defend against pre-Zod-parse
 * YAML that misplaces it". Defending against malformed input means surviving
 * it — and `Object.keys(null)` throws.
 *
 *     plugins:
 *       -
 *
 * is valid YAML producing `[null]`, and it took the whole generator down with a
 * bare `TypeError: Cannot convert undefined or null to object`. That violates
 * the repo's error contract twice over: it is not one of the typed errors, and
 * its message tells the author nothing about which manifest line is wrong.
 */

import { validateManifestPlugins, validateManifestTransforms } from '../manifest-validation';

const asManifest = (o: unknown) => o as never;

describe('malformed plugin/transform entries', () => {
  const malformed: Array<[string, unknown]> = [
    ['a bare list item (YAML null)', [null]],
    ['an explicit undefined', [undefined]],
    ['an empty mapping', [{}]],
    ['a number', [42]],
    ['a nested list', [[]]],
  ];

  it.each(malformed)('plugins: %s does not throw', (_label, entries) => {
    expect(() => validateManifestPlugins(asManifest({ plugins: entries }))).not.toThrow();
  });

  it.each(malformed)('transforms: %s does not throw', (_label, entries) => {
    expect(() => validateManifestTransforms(asManifest({ transforms: entries }))).not.toThrow();
  });

  it('reports a malformed entry rather than swallowing it', () => {
    // Silence would be worse than the crash: the author wrote something, and
    // the generator would emit a .meshrc.yaml that does not contain it.
    const result = validateManifestPlugins(asManifest({ plugins: [null, 'jwtAuth'] }));
    expect(result.warnings.join(' ')).toMatch(/could not be read|malformed/i);
    expect(result.classification.plugins).toContain('jwtAuth');
  });

  it('never reports a name of "undefined"', () => {
    // `Object.keys({})[0]` is `undefined`, which used to be interpolated
    // straight into the warning: `Unknown plugin "undefined"`.
    const result = validateManifestPlugins(asManifest({ plugins: [{}] }));
    expect(result.warnings.join(' ')).not.toContain('"undefined"');
  });

  it('still classifies well-formed entries exactly as before', () => {
    const ok = validateManifestPlugins(asManifest({ plugins: ['jwtAuth', 'prometheus'] }));
    expect(ok.valid).toBe(true);
    expect(ok.errors).toEqual([]);
    expect(ok.classification.plugins).toEqual(['jwtAuth', 'prometheus']);

    const misplaced = validateManifestPlugins(asManifest({ plugins: ['filterSchema'] }));
    expect(misplaced.valid).toBe(false);
    expect(misplaced.errors[0]).toMatch(/is a transform, not a plugin/);
  });
});

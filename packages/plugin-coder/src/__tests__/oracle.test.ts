import {
  stripFences,
  validateManifestText,
  validateFull,
  parseAndValidateDirectory,
} from '../oracle';

const VALID_MANIFEST = [
  'name: acme-widget',
  'version: 1.0.0',
  'type: remote',
  'language: typescript',
  'capabilities: []',
  '',
].join('\n');

describe('stripFences', () => {
  it('returns bare YAML unchanged (trimmed)', () => {
    expect(stripFences(VALID_MANIFEST)).toBe(VALID_MANIFEST.trim());
  });

  it('strips a ```yaml fence wrapper', () => {
    const fenced = '```yaml\n' + VALID_MANIFEST + '```';
    expect(stripFences(fenced)).toBe(VALID_MANIFEST.trim());
  });

  it('strips a bare ``` fence wrapper', () => {
    const fenced = '```\n' + VALID_MANIFEST + '\n```';
    expect(stripFences(fenced)).toBe(VALID_MANIFEST.trim());
  });
});

describe('validateManifestText (the DSL oracle)', () => {
  it('accepts a schema-valid manifest via @seans-mfe/dsl', () => {
    const result = validateManifestText(VALID_MANIFEST);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a valid manifest even when fenced', () => {
    const result = validateManifestText('```yaml\n' + VALID_MANIFEST + '```');
    expect(result.valid).toBe(true);
  });

  it('rejects an out-of-enum type and a bad version', () => {
    const bad = [
      'name: acme-widget',
      'version: not-semver',
      'type: banana',
      'language: typescript',
      'capabilities: []',
    ].join('\n');
    const result = validateManifestText(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports empty output as a single validation error, not a throw', () => {
    const result = validateManifestText('   \n  ');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/empty/i);
  });

  it('reports a YAML parse error as a validation error, not a throw', () => {
    const result = validateManifestText('name: [unterminated');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toMatch(/yaml parse error/i);
  });
});

describe('re-exported DSL primitives', () => {
  it('exposes validateFull and parseAndValidateDirectory from the seam', () => {
    expect(typeof validateFull).toBe('function');
    expect(typeof parseAndValidateDirectory).toBe('function');
  });
});

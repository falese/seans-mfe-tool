/**
 * `targets.rust` — the Rust native target (ADR-095, ADR-099).
 *
 * Declared in the schema for the reason `targets.swift` is: `TargetsSchema`
 * carries a catchall, so an undeclared `rust` key would survive parsing — but
 * as an opaque record, with no defaults and no validation of `crateName`.
 */
import { RustTargetSchema, TargetsSchema, KNOWN_TARGETS, DSLManifestSchema } from '../schema';

const baseManifest = {
  name: 'crew-services',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Health: { type: 'platform', description: 'Health check' } }],
};

describe('RustTargetSchema (ADR-099)', () => {
  it('accepts an empty object and defaults the edition', () => {
    const parsed = RustTargetSchema.parse({});
    expect(parsed.edition).toBe('2021');
    expect(parsed.wasm).toBe(false);
    expect(parsed.crateName).toBeUndefined();
    expect(parsed.capabilities).toBeUndefined();
  });

  it('accepts a kebab-case crate name — Cargo derives the lib name from it', () => {
    expect(RustTargetSchema.parse({ crateName: 'meridian-crew' }).crateName).toBe('meridian-crew');
    expect(RustTargetSchema.parse({ crateName: 'meridian_crew' }).crateName).toBe('meridian_crew');
  });

  it('rejects a crate name Cargo would reject', () => {
    expect(() => RustTargetSchema.parse({ crateName: '9lives' })).toThrow(/Cargo package name/);
    expect(() => RustTargetSchema.parse({ crateName: 'has space' })).toThrow(/Cargo package name/);
    expect(() => RustTargetSchema.parse({ crateName: '' })).toThrow();
  });

  it('accepts only editions the generated code is written for', () => {
    expect(RustTargetSchema.parse({ edition: '2024' }).edition).toBe('2024');
    expect(() => RustTargetSchema.parse({ edition: '2015' })).toThrow();
  });
});

describe('targets.rust.wasm (ADR-100)', () => {
  it('accepts true — the crate also builds a browser remote', () => {
    expect(RustTargetSchema.parse({ wasm: true }).wasm).toBe(true);
  });

  it('rejects anything but a boolean', () => {
    expect(() => RustTargetSchema.parse({ wasm: 'yes' })).toThrow();
  });
});

describe('targets.rust in a manifest', () => {
  it('names rust as a known target — no stderr warning for it', () => {
    expect(KNOWN_TARGETS).toContain('rust');
  });

  it('survives full manifest validation with its defaults applied', () => {
    const parsed = DSLManifestSchema.parse({ ...baseManifest, targets: { rust: {} } });
    expect(parsed.targets?.rust).toEqual({ edition: '2021', wasm: false });
  });

  it('sits beside swift — targets are independent of each other', () => {
    const parsed = TargetsSchema.parse({ swift: {}, rust: { crateName: 'crew' } });
    expect(parsed.swift).toBeDefined();
    expect(parsed.rust?.crateName).toBe('crew');
  });

  it('validates crateName through the manifest, not only the sub-schema', () => {
    expect(() => DSLManifestSchema.parse({ ...baseManifest, targets: { rust: { crateName: '1x' } } })).toThrow();
  });
});

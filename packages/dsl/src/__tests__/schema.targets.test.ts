/**
 * `targets:` — secondary build targets (ADR-095).
 *
 * A manifest names one primary web build through `framework`/`bundler`. A
 * secondary target is a SECOND artifact built from the SAME manifest: the
 * Swift lane emits an SPM package beside the Module Federation remote, from
 * the same capabilities.
 *
 * The schema is open in the same way `framework` and `bundler` are (ADR-036,
 * #181): an unknown target id warns on stderr rather than failing, so shipping
 * a new target generator does not require a schema change here.
 *
 * `DSLManifestSchema` is a plain (non-strict) Zod object, so an unrecognised
 * top-level key is STRIPPED rather than rejected. That is why `targets` has to
 * be declared here at all — without it a manifest declaring a Swift target
 * parses clean and silently loses the block.
 */
import {
  SwiftTargetSchema,
  TargetsSchema,
  KNOWN_TARGETS,
  DSLManifestSchema,
} from '../schema';

const baseManifest = {
  name: 'test-mfe',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Health: { type: 'platform', description: 'Health check' } }],
};

describe('SwiftTargetSchema (ADR-095)', () => {
  it('accepts an empty object — every field is defaulted', () => {
    expect(() => SwiftTargetSchema.parse({})).not.toThrow();
  });

  it('defaults swiftToolsVersion and deploymentTarget', () => {
    const parsed = SwiftTargetSchema.parse({});
    expect(parsed.swiftToolsVersion).toBe('5.9');
    expect(parsed.deploymentTarget).toBe('17.0');
  });

  it('leaves moduleName and bundleId undefined so codegen can derive them', () => {
    const parsed = SwiftTargetSchema.parse({});
    expect(parsed.moduleName).toBeUndefined();
    expect(parsed.bundleId).toBeUndefined();
  });

  it('accepts an explicit module name and bundle id', () => {
    const parsed = SwiftTargetSchema.parse({
      moduleName: 'MeridianCrewServices',
      bundleId: 'com.meridian.crew-services',
    });
    expect(parsed.moduleName).toBe('MeridianCrewServices');
    expect(parsed.bundleId).toBe('com.meridian.crew-services');
  });

  it('rejects a module name that is not a Swift identifier', () => {
    expect(() => SwiftTargetSchema.parse({ moduleName: 'crew-services' })).toThrow(/identifier/i);
    expect(() => SwiftTargetSchema.parse({ moduleName: '9Lives' })).toThrow(/identifier/i);
    expect(() => SwiftTargetSchema.parse({ moduleName: '' })).toThrow();
  });
});

describe('TargetsSchema (ADR-095)', () => {
  it('names swift as a known target', () => {
    expect(KNOWN_TARGETS).toContain('swift');
  });

  it('accepts a swift target', () => {
    expect(() => TargetsSchema.parse({ swift: {} })).not.toThrow();
  });

  it('accepts an empty targets block', () => {
    expect(() => TargetsSchema.parse({})).not.toThrow();
  });
});

describe('Unknown target ids survive validation (ADR-095 §2)', () => {
  // The defect this pins: TargetsSchema was a CLOSED z.object({ swift }), and a
  // non-strict Zod object STRIPS unknown keys. So a manifest declaring
  // `targets.kotlin` warned on stderr from the raw parse and then had the key
  // silently removed by the validated path every command actually uses — the
  // opposite of the open-world policy ADR-095 §2 claims, and invisible because
  // the original loader test built its manifest in memory and never
  // round-tripped through validation.
  it('keeps a target id this build has no generator for', () => {
    const parsed = DSLManifestSchema.parse({
      ...baseManifest,
      targets: { swift: {}, kotlin: {} },
    });
    expect(Object.keys(parsed.targets ?? {}).sort()).toEqual(['kotlin', 'swift']);
  });

  it('still applies the swift schema to the key it does know', () => {
    const parsed = DSLManifestSchema.parse({
      ...baseManifest,
      targets: { swift: {}, kotlin: { toolchain: '2.0' } },
    });
    expect(parsed.targets?.swift?.swiftToolsVersion).toBe('5.9');
  });

  it('still rejects a malformed swift target', () => {
    expect(() =>
      DSLManifestSchema.parse({ ...baseManifest, targets: { swift: { moduleName: 'no-dashes' }, kotlin: {} } })
    ).toThrow(/identifier/i);
  });
});

describe('DSLManifestSchema targets (ADR-095)', () => {
  it('parses a manifest with no targets block', () => {
    const parsed = DSLManifestSchema.parse(baseManifest);
    expect(parsed.targets).toBeUndefined();
  });

  it('PRESERVES a swift target rather than stripping it', () => {
    // The regression this test exists for: a non-strict Zod object drops
    // unknown keys silently, so before `targets` was declared this parsed
    // clean and lost the block.
    const parsed = DSLManifestSchema.parse({
      ...baseManifest,
      targets: { swift: { moduleName: 'TestMfe' } },
    });
    expect(parsed.targets?.swift).toBeDefined();
    expect(parsed.targets?.swift?.moduleName).toBe('TestMfe');
  });

  it('applies swift target defaults through the manifest schema', () => {
    const parsed = DSLManifestSchema.parse({ ...baseManifest, targets: { swift: {} } });
    expect(parsed.targets?.swift?.swiftToolsVersion).toBe('5.9');
  });

  it('rejects an invalid swift target nested in a manifest', () => {
    expect(() =>
      DSLManifestSchema.parse({ ...baseManifest, targets: { swift: { moduleName: 'not-swift' } } })
    ).toThrow(/identifier/i);
  });
});

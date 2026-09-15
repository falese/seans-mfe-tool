/**
 * A target may declare which domain capabilities it implements (ADR-095).
 *
 * Omitting the field means all of them, so every manifest written before this
 * existed keeps its meaning. Declaring it lets a target carry a subset — not
 * every capability belongs on every delivery mechanism.
 */
import { SwiftTargetSchema, DSLManifestSchema } from '../schema';

const baseManifest = {
  name: 'test-mfe',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Health: { type: 'platform', description: 'Health check' } }],
};

describe('targets.swift.capabilities', () => {
  it('is undefined when omitted — meaning all domain capabilities', () => {
    expect(SwiftTargetSchema.parse({}).capabilities).toBeUndefined();
  });

  it('accepts an explicit subset', () => {
    expect(SwiftTargetSchema.parse({ capabilities: ['CrewRoster'] }).capabilities).toEqual(['CrewRoster']);
  });

  it('accepts an empty list — a target that implements none, explicitly', () => {
    expect(SwiftTargetSchema.parse({ capabilities: [] }).capabilities).toEqual([]);
  });

  it('rejects a non-string entry', () => {
    expect(() => SwiftTargetSchema.parse({ capabilities: [1] })).toThrow();
  });

  it('rejects an empty capability name', () => {
    expect(() => SwiftTargetSchema.parse({ capabilities: [''] })).toThrow();
  });

  it('survives a full manifest parse', () => {
    const parsed = DSLManifestSchema.parse({
      ...baseManifest,
      targets: { swift: { capabilities: ['CrewRoster', 'PayStatus'] } },
    });
    expect(parsed.targets?.swift?.capabilities).toEqual(['CrewRoster', 'PayStatus']);
  });
});

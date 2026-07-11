/**
 * providesSlots manifest section (ADR-067): an MFE declares the slot ids it
 * registers at runtime, making the manifest the design-time contract that
 * registry rules validate against. Ids are assigned names (ADR-066) — the
 * schema rejects ordinal-form segments so a positional address can never
 * enter the contract, and rejects '/' because path composition belongs to
 * the host (ADR-057), not the declaring MFE. Refs #265.
 */
import { ProvidedSlotSchema, ProvidesSlotsSchema, DSLManifestSchema } from '../schema';

const baseManifest = {
  name: 'test-mfe',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [{ Health: { type: 'platform', description: 'Health check' } }],
};

describe('ProvidedSlotSchema (ADR-067)', () => {
  it('accepts a named slot with a description', () => {
    expect(() =>
      ProvidedSlotSchema.parse({ id: 'main-content', description: 'Primary region' })
    ).not.toThrow();
  });

  it('accepts a keyed pattern for repeated slots', () => {
    expect(() => ProvidedSlotSchema.parse({ id: 'card.{sku}' })).not.toThrow();
    expect(() => ProvidedSlotSchema.parse({ id: 'section.{sectionKey}.footer' })).not.toThrow();
  });

  it('rejects an empty id', () => {
    expect(() => ProvidedSlotSchema.parse({ id: '' })).toThrow();
  });

  it('rejects ordinal-form ids — a purely numeric segment is a position, not a name', () => {
    expect(() => ProvidedSlotSchema.parse({ id: '2' })).toThrow(/assigned name/i);
    expect(() => ProvidedSlotSchema.parse({ id: 'main.2' })).toThrow(/assigned name/i);
    expect(() => ProvidedSlotSchema.parse({ id: 'main.02.footer' })).toThrow(/assigned name/i);
  });

  it('rejects "/" — path composition is host-owned (ADR-057)', () => {
    expect(() => ProvidedSlotSchema.parse({ id: 'main/quiz' })).toThrow(/host/i);
  });

  it('rejects malformed pattern segments', () => {
    expect(() => ProvidedSlotSchema.parse({ id: 'card.{}' })).toThrow();
    expect(() => ProvidedSlotSchema.parse({ id: 'card.{1bad}' })).toThrow();
  });
});

describe('ProvidesSlotsSchema (ADR-067)', () => {
  it('rejects duplicate ids', () => {
    expect(() =>
      ProvidesSlotsSchema.parse([{ id: 'main' }, { id: 'main' }])
    ).toThrow(/duplicate/i);
  });

  it('accepts distinct ids', () => {
    expect(() =>
      ProvidesSlotsSchema.parse([{ id: 'main' }, { id: 'info' }, { id: 'card.{sku}' }])
    ).not.toThrow();
  });
});

describe('DSLManifestSchema.providesSlots (ADR-067)', () => {
  it('remains optional — MFEs that provide no slots declare nothing', () => {
    expect(() => DSLManifestSchema.parse(baseManifest)).not.toThrow();
  });

  it('accepts a manifest with declared slots', () => {
    const manifest = {
      ...baseManifest,
      providesSlots: [
        { id: 'main', description: 'Primary content region' },
        { id: 'info', description: 'Contextual info panel' },
      ],
    };
    const parsed = DSLManifestSchema.parse(manifest);
    expect(parsed.providesSlots).toHaveLength(2);
    expect(parsed.providesSlots?.[0].id).toBe('main');
  });

  it('rejects a manifest whose slot ids are ordinal-form', () => {
    const manifest = { ...baseManifest, providesSlots: [{ id: 'region.1' }] };
    expect(() => DSLManifestSchema.parse(manifest)).toThrow(/assigned name/i);
  });
});

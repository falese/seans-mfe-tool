/**
 * Slot contract codegen (ADR-067): when the manifest declares providesSlots,
 * the generator emits src/slots.tsx — the PROVIDED_SLOTS constant mirroring
 * the manifest and a DeclaredSlot component that registers regions via the
 * provideSlot render prop (ADR-058) and rejects undeclared ids. The file is
 * regenerated (overwrite: true) so code and manifest cannot drift. Refs #265.
 */
import { generateAllFiles } from '../unified-generator';
import * as fs from 'fs-extra';
import path from 'path';

describe('provided-slots codegen (ADR-067)', () => {
  const baseManifest = {
    name: 'SlotProvider',
    version: '1.0.0',
    description: 'Test slot-provider manifest',
    endpoint: 'http://localhost:3001',
    capabilities: [{ Health: { type: 'platform', description: 'Health check' } }],
    dependencies: { 'design-system': { '@mui/material': '^5.15.0' }, mfes: {} },
  };
  const basePath = path.join(__dirname, 'output-slots');

  beforeAll(async () => {
    await fs.remove(basePath);
  });
  afterAll(async () => {
    await fs.remove(basePath);
  });

  it('emits src/slots.tsx mirroring the manifest slot contract', async () => {
    const manifest = {
      ...baseManifest,
      providesSlots: [
        { id: 'main', description: "Primary content region — the game's canvas" },
        { id: 'info' },
        { id: 'card.{sku}', description: 'One card per product' },
      ],
    };
    const { files } = await generateAllFiles(manifest as never, basePath, { force: true });
    const slots = files.find((f) => f.path === path.join(basePath, 'src', 'slots.tsx'));

    expect(slots).toBeDefined();
    expect(slots?.overwrite).toBe(true); // generated contract — never user-owned
    expect(slots?.content).toContain('PROVIDED_SLOTS');
    expect(slots?.content).toContain('"main"');
    expect(slots?.content).toContain('"info"');
    expect(slots?.content).toContain('"card.{sku}"');
    expect(slots?.content).toContain("Primary content region — the game's canvas");
    expect(slots?.content).toContain('DeclaredSlot');
    expect(slots?.content).toContain('isDeclaredSlotId');
    expect(slots?.content).toContain('provideSlot');
    expect(slots?.content).toContain('data-declared-slot');
    expect(slots?.content).toContain('ADR-067');
  });

  it('emits nothing slot-related when the manifest declares no slots', async () => {
    const { files } = await generateAllFiles(baseManifest as never, basePath, { force: true });
    const slots = files.find((f) => f.path === path.join(basePath, 'src', 'slots.tsx'));
    expect(slots).toBeUndefined();
  });

  it('generated matcher logic distinguishes literals from keyed patterns', async () => {
    const manifest = {
      ...baseManifest,
      providesSlots: [{ id: 'main' }, { id: 'card.{sku}' }],
    };
    const { files } = await generateAllFiles(manifest as never, basePath, { force: true });
    const content = files.find((f) => f.path === path.join(basePath, 'src', 'slots.tsx'))?.content ?? '';

    // Extract and evaluate the pure matcher section (everything before React
    // enters), so the test exercises the actual generated logic.
    const matcherSource = content.slice(0, content.indexOf('export interface DeclaredSlotProps'));
    const stripped = matcherSource
      .replace(/^import .*$/gm, '')
      .replace(/export /g, '')
      .replace(/: readonly ProvidedSlotDeclaration\[\]/, '')
      .replace(/interface ProvidedSlotDeclaration \{[\s\S]*?\}/, '')
      .replace(/\((id|declaredId): string\)/g, '($1)')
      .replace(/: (boolean|RegExp)\b/g, '')
      .replace(/ as const/g, '');
    // eslint-disable-next-line no-new-func
    const probe = new Function(`${stripped}; return isDeclaredSlotId;`)() as (id: string) => boolean;

    expect(probe('main')).toBe(true);
    expect(probe('card.ABC-123')).toBe(true);
    expect(probe('card.ABC.123')).toBe(false); // one key segment, not two
    expect(probe('sidebar')).toBe(false); // undeclared
    expect(probe('main.2')).toBe(false); // ordinal-form never matches
  });
});

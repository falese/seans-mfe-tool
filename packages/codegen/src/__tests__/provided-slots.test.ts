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
    expect(slots?.content).toContain('provideSlot');
    expect(slots?.content).toContain('data-declared-slot');
    expect(slots?.content).toContain('ADR-067');
  });

  it('generates data only — contract logic is imported from the runtime, never embedded', async () => {
    const manifest = {
      ...baseManifest,
      providesSlots: [{ id: 'main' }, { id: 'card.{sku}' }],
    };
    const { files } = await generateAllFiles(manifest as never, basePath, { force: true });
    const content = files.find((f) => f.path === path.join(basePath, 'src', 'slots.tsx'))?.content ?? '';

    // Layer split (ADR-067): the generated file mirrors manifest data and
    // binds it; matching/guard logic lives once in @seans-mfe-tool/runtime.
    expect(content).toContain("from '@seans-mfe-tool/runtime'");
    expect(content).toContain('createSlotContract(PROVIDED_SLOTS)');
    expect(content).not.toContain('toMatcher');
    expect(content).not.toContain('new RegExp');
    expect(content).not.toContain('throw new Error');
  });

  it('emits nothing slot-related when the manifest declares no slots', async () => {
    const { files } = await generateAllFiles(baseManifest as never, basePath, { force: true });
    const slots = files.find((f) => f.path === path.join(basePath, 'src', 'slots.tsx'));
    expect(slots).toBeUndefined();
  });

});

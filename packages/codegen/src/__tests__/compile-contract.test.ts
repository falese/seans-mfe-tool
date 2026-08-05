/**
 * The compile contract is generator-owned and derived from the manifest
 * (ADR-085).
 *
 * `tsconfig.json` was developer-owned in full, so it froze at whatever the
 * template said the day an MFE was scaffolded. The fleet drifted into two
 * different module systems — and the split tracked one manifest fact almost
 * perfectly: MFEs with a BFF need commonjs for their Node `server.ts`,
 * browser-only MFEs want bundler resolution so TypeScript reads the `exports`
 * map the platform packages publish (ADR-084).
 *
 * These tests pin that derivation, and pin the ownership split itself — the
 * platform half must stay overwrite:true (so regeneration delivers it) and the
 * developer half overwrite:false (so nobody's edits are clobbered).
 */
import * as path from 'path';
import { generateAllFiles } from '../unified-generator';

const basePath = '/tmp/compile-contract-fixture';

const baseManifest = {
  name: 'widget',
  version: '1.0.0',
  framework: 'react',
  bundler: 'rspack',
  type: 'remote',
  capabilities: [],
};

const withBff = {
  ...baseManifest,
  data: {
    sources: [{ name: 'api', handler: { openapi: { source: './openapi.yaml' } } }],
  },
};

async function emit(manifest: unknown) {
  const { files } = await generateAllFiles(manifest as never, basePath, { force: true });
  const find = (name: string) => files.find((f) => f.path === path.join(basePath, name));
  return { platform: find('tsconfig.platform.json'), own: find('tsconfig.json') };
}

describe('the compile contract (ADR-085)', () => {
  it('emits a generator-owned platform config a browser-only MFE inherits', async () => {
    const { platform, own } = await emit(baseManifest);

    expect(platform).toBeDefined();
    // overwrite:true is the whole point — it is how a compiler setting the
    // platform needs actually reaches an MFE, and what puts it under
    // check:mfe-drift.
    expect(platform?.overwrite).toBe(true);

    expect(own).toBeDefined();
    // ...and the developer's file must stay theirs.
    expect(own?.overwrite).toBe(false);
    expect(own?.content).toContain('"extends": "./tsconfig.platform.json"');
  });

  it('gives a browser-only MFE bundler resolution', async () => {
    const { platform } = await emit(baseManifest);
    const cfg = JSON.parse(platform!.content) as { compilerOptions: Record<string, string> };
    expect(cfg.compilerOptions.moduleResolution).toBe('bundler');
    expect(cfg.compilerOptions.module).toBe('esnext');
  });

  it('gives a BFF MFE commonjs, because its server.ts runs in Node', async () => {
    const { platform } = await emit(withBff);
    const cfg = JSON.parse(platform!.content) as { compilerOptions: Record<string, string> };
    expect(cfg.compilerOptions.moduleResolution).toBe('node');
    expect(cfg.compilerOptions.module).toBe('commonjs');
  });

  it('emits the platform config for a BFF MFE too', async () => {
    // The BFF plugin owns the developer-owned tsconfig.json for these, so it
    // would be easy to skip the platform half and leave the extends dangling.
    const { platform } = await emit(withBff);
    expect(platform).toBeDefined();
    expect(platform?.overwrite).toBe(true);
  });

  it('keeps the platform half free of anything a developer owns', async () => {
    // include/exclude/paths/outDir vary per project. If they leaked into the
    // generator-owned file, regeneration would start clobbering real choices —
    // which is exactly what this split exists to avoid.
    const { platform } = await emit(baseManifest);
    const cfg = JSON.parse(platform!.content) as Record<string, unknown> & {
      compilerOptions: Record<string, unknown>;
    };
    expect(cfg.include).toBeUndefined();
    expect(cfg.exclude).toBeUndefined();
    expect(cfg.compilerOptions.paths).toBeUndefined();
    expect(cfg.compilerOptions.outDir).toBeUndefined();
  });

  it('produces valid JSON despite the conditional template blocks', async () => {
    // The file is built with EJS branches on hasBff; a stray comma between them
    // would break every generated MFE's compile at once.
    for (const manifest of [baseManifest, withBff]) {
      const { platform } = await emit(manifest);
      expect(() => JSON.parse(platform!.content)).not.toThrow();
    }
  });
});

// A BFF MFE's tsconfig restricted include to "*.ts", so its React components
// were never typechecked — 28 .tsx files across four MFEs, invisible to every
// gate because tsc was simply never handed them. The BFF's own server.ts is
// plain .ts and was always covered; only the UI half was missing.
describe('a BFF MFE typechecks its React components too', () => {
  it('includes src/**/*.tsx in the BFF tsconfig template', () => {
    const tpl = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../../bff-plugin/templates/tsconfig.json'),
      'utf8'
    ) as string;
    const include = (JSON.parse(tpl) as { include: string[] }).include;
    expect(include).toContain('src/**/*.tsx');
    // The server half must stay covered — it is the reason this file exists.
    expect(include).toContain('*.ts');
  });
});

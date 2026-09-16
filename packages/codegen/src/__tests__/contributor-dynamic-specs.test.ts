/**
 * A contributor's specs may depend on the manifest (ADR-095).
 *
 * `FileSpec.out` is a static string, so a fixed `specs` array can only describe
 * files whose paths are known before any manifest is read. The web lane never
 * had that limit — `featureSpecs(ctx, capability)` runs in a loop inside the
 * generator and emits `src/features/<Cap>/<Cap>.tsx` per capability — but a
 * contributor could not do the same, and the Swift lane was shaped around the
 * gap: one developer-owned file holding every view, so a capability added later
 * had nowhere to land.
 */
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  generateAllFiles,
  registerFileContributor,
  unregisterFileContributor,
  contributorSpecs,
} from '../index';
import type { DSLManifest } from '@seans-mfe/dsl';

const basePath = path.join(__dirname, 'output-dynamic');
const templateRoot = path.join(__dirname, 'fixtures-dynamic');

beforeAll(async () => {
  await fs.ensureDir(templateRoot);
  await fs.writeFile(path.join(templateRoot, 'per-cap.ejs'), 'view for <%= name %>\n');
});

afterAll(async () => {
  unregisterFileContributor('dynamic-probe');
  await fs.remove(basePath);
  await fs.remove(templateRoot);
});

const manifest = (caps: string[]): DSLManifest =>
  ({
    name: 'probe',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    endpoint: 'http://localhost:3000',
    capabilities: caps.map((c) => ({ [c]: { type: 'domain', description: c } })),
  }) as unknown as DSLManifest;

describe('contributorSpecs', () => {
  it('returns a static array unchanged — the BFF form still works', () => {
    const specs = [{ template: 'x.ejs', out: 'x', owner: 'generator' as const }];
    expect(contributorSpecs({ id: 'a', templateRoot: '/t', specs }, {})).toBe(specs);
  });

  it('calls a function form with the plan context', () => {
    const seen: unknown[] = [];
    contributorSpecs(
      { id: 'b', templateRoot: '/t', specs: (ctx) => { seen.push(ctx); return []; } },
      { marker: 1 },
    );
    expect(seen).toEqual([{ marker: 1 }]);
  });
});

describe('a contributor emitting one file per capability', () => {
  beforeAll(() => {
    registerFileContributor({
      id: 'dynamic-probe',
      templateRoot,
      specs: (ctx) =>
        (ctx as { domainCapabilities: string[] }).domainCapabilities.map((name) => ({
          template: 'per-cap.ejs',
          out: `probe/${name}View.txt`,
          owner: 'developer' as const,
          root: 'dynamic-probe',
          vars: () => ({ name }),
        })),
    });
  });

  it('emits one file per capability, named after it', async () => {
    const { files } = await generateAllFiles(manifest(['Alpha', 'Beta']), basePath);
    const emitted = files
      .map((f) => path.relative(basePath, f.path).split(path.sep).join('/'))
      .filter((p) => p.startsWith('probe/'));
    expect(emitted).toEqual(['probe/AlphaView.txt', 'probe/BetaView.txt']);
  });

  it('tracks the manifest — a third capability gets a third file', async () => {
    // This is the property the Swift lane needed and did not have: a new
    // capability produces a new developer-owned file, which does not exist
    // yet and is therefore written, rather than needing to be added by hand
    // to a file regeneration will never touch.
    const { files } = await generateAllFiles(manifest(['Alpha', 'Beta', 'Gamma']), basePath);
    const emitted = files
      .map((f) => path.relative(basePath, f.path).split(path.sep).join('/'))
      .filter((p) => p.startsWith('probe/'));
    expect(emitted).toContain('probe/GammaView.txt');
  });

  it('renders per-capability vars into each file', async () => {
    const { files } = await generateAllFiles(manifest(['Alpha']), basePath);
    const alpha = files.find((f) => f.path.endsWith('AlphaView.txt'))!;
    expect(alpha.content).toBe('view for Alpha\n');
    expect(alpha.overwrite).toBe(false);
  });
});

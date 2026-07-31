/**
 * Cross-package pin (ADR-080): codegen classifies manifest capabilities as
 * platform vs domain from the canonical set in `@falese/smt-contracts`, not
 * from a hand-written list.
 *
 * Codegen had its own nine-entry map and its EJS templates had two more inline
 * arrays — one of nine, one of ten. `UpdateControlPlaneState` was missing from
 * the map and from the test-template array, so a manifest declaring it was
 * generated as a *domain* capability: a `UpdateControlPlaneStateOutputs` type
 * import that does not exist, a feature stub, and a smoke test calling it as
 * user code. This suite fails if that classification ever comes apart from the
 * contract again.
 */
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  PLATFORM_CAPABILITIES,
  PLATFORM_CAPABILITY_SPECS,
  type PlatformCapability,
} from '@falese/smt-contracts';
import { generateAllFiles, extractManifestVars } from '../unified-generator';
import type { DSLManifest } from '@falese/smt-dsl';

/** A manifest declaring every platform capability plus one domain capability. */
function manifestWithEveryPlatformCapability(
  overrides: Partial<DSLManifest> = {}
): DSLManifest {
  return {
    name: 'PinTest',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    description: 'Declares all ten platform capabilities',
    endpoint: 'http://localhost:3199',
    capabilities: [
      ...PLATFORM_CAPABILITIES.map((name) => ({
        [PLATFORM_CAPABILITY_SPECS[name].manifestKey]: {
          type: 'platform' as const,
          description: PLATFORM_CAPABILITY_SPECS[name].description,
        },
      })),
      { PlayGame: { type: 'domain' as const, description: 'The one real domain capability' } },
    ],
    ...overrides,
  } as DSLManifest;
}

describe('codegen ↔ platform contract pin', () => {
  const basePath = path.join(__dirname, 'output-platform-contract-pin');

  beforeAll(async () => {
    await fs.remove(basePath);
  });

  afterAll(async () => {
    await fs.remove(basePath);
  });

  it('hands the templates the canonical capability list, not a copy', () => {
    const vars = extractManifestVars(manifestWithEveryPlatformCapability());
    expect(vars.platformCapabilityNames).toEqual([...PLATFORM_CAPABILITIES]);
  });

  it('generates no feature stub for any platform capability', async () => {
    const { files } = await generateAllFiles(manifestWithEveryPlatformCapability(), basePath, {
      force: true,
    });
    const featureDir = path.join(basePath, 'src', 'features');
    const featurePaths = files.map((f) => f.path).filter((p) => p.startsWith(featureDir));

    for (const name of PLATFORM_CAPABILITIES) {
      const spec = PLATFORM_CAPABILITY_SPECS[name];
      for (const spelling of [spec.name, spec.manifestKey]) {
        expect(featurePaths.some((p) => p.includes(path.join(featureDir, spelling)))).toBe(false);
      }
    }
    // The one domain capability still gets its stub — this is a classification
    // pin, not a "generate nothing" pin.
    expect(featurePaths.some((p) => p.startsWith(path.join(featureDir, 'PlayGame')))).toBe(true);
  });

  it('never imports a fabricated Outputs type for a platform capability', async () => {
    const { files } = await generateAllFiles(manifestWithEveryPlatformCapability(), basePath, {
      force: true,
    });
    const mfe = files.find((f) => f.path.endsWith(path.join('platform', 'base-mfe', 'mfe.ts')));
    expect(mfe).toBeDefined();

    for (const name of PLATFORM_CAPABILITIES) {
      const spec = PLATFORM_CAPABILITY_SPECS[name];
      // e.g. `UpdateControlPlaneStateOutputs` — the symptom of misclassification.
      expect(mfe!.content).not.toContain(`${spec.manifestKey}Outputs`);
      expect(mfe!.content).not.toContain(`${spec.name}Outputs`);
    }
    expect(mfe!.content).toContain('PlayGameOutputs');
  });

  it('never writes a domain smoke test for a platform capability', async () => {
    const { files } = await generateAllFiles(manifestWithEveryPlatformCapability(), basePath, {
      force: true,
    });
    const spec = files.find((f) => f.path.endsWith(path.join('platform', 'base-mfe', 'mfe.test.ts')));
    expect(spec).toBeDefined();

    for (const name of PLATFORM_CAPABILITIES) {
      expect(spec!.content).not.toContain(`should call ${name}() and return an object`);
      expect(spec!.content).not.toContain(
        `should call ${PLATFORM_CAPABILITY_SPECS[name].manifestKey}() and return an object`
      );
    }
    expect(spec!.content).toContain('should call PlayGame() and return an object');
  });

  it('applies the same classification to the Angular variant', async () => {
    const angularBase = path.join(basePath, 'angular');
    const { files } = await generateAllFiles(
      manifestWithEveryPlatformCapability({
        framework: 'angular',
        bundler: 'webpack',
        dependencies: {
          runtime: {
            '@angular/core': '^19.0.0',
            '@angular/common': '^19.0.0',
            '@angular/platform-browser': '^19.0.0',
            rxjs: '^7.8.0',
            'zone.js': '~0.15.0',
          },
        },
      }),
      angularBase,
      { force: true }
    );

    const mfe = files.find((f) => f.path.endsWith(path.join('platform', 'base-mfe', 'mfe.ts')));
    const spec = files.find((f) => f.path.endsWith(path.join('platform', 'base-mfe', 'mfe.test.ts')));
    expect(mfe).toBeDefined();
    expect(spec).toBeDefined();

    for (const name of PLATFORM_CAPABILITIES) {
      expect(mfe!.content).not.toContain(`${PLATFORM_CAPABILITY_SPECS[name].manifestKey}Outputs`);
      expect(spec!.content).not.toContain(`should call ${name}() and return an object`);
    }
  });

  it('updateControlPlaneState specifically — the capability the old lists dropped', async () => {
    const manifest: DSLManifest = {
      name: 'PinTestUcps',
      version: '1.0.0',
      type: 'remote',
      language: 'typescript',
      description: 'Declares only updateControlPlaneState plus one domain capability',
      endpoint: 'http://localhost:3198',
      capabilities: [
        { UpdateControlPlaneState: { type: 'platform', description: 'Push domain state' } },
        { PlayGame: { type: 'domain', description: 'Domain capability' } },
      ],
    } as DSLManifest;

    const ucpsBase = path.join(basePath, 'ucps');
    const { files } = await generateAllFiles(manifest, ucpsBase, { force: true });
    const mfe = files.find((f) => f.path.endsWith(path.join('platform', 'base-mfe', 'mfe.ts')));

    expect(mfe).toBeDefined();
    expect(mfe!.content).not.toContain('UpdateControlPlaneStateOutputs');
    expect(
      files.some((f) => f.path.includes(path.join('src', 'features', 'UpdateControlPlaneState')))
    ).toBe(false);
  });

  it('every capability the contract defines has a result type codegen can emit', () => {
    for (const name of PLATFORM_CAPABILITIES) {
      const { resultType } = PLATFORM_CAPABILITY_SPECS[name as PlatformCapability];
      expect(resultType).toBeTruthy();
      expect(resultType).not.toMatch(/Outputs$/);
    }
  });
});

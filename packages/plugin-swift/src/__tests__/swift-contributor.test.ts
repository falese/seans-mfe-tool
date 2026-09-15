/**
 * The Swift target is a FileContributor, not a framework variant (ADR-095).
 *
 * A CodegenVariant is mutually exclusive — one per MFE — so it cannot express
 * a SECOND build. The BFF already proved the contributor seam does exactly
 * that: files from another package's template root, gated on a manifest
 * section. Swift is the third contributor on the same seam, which is why
 * `unified-generator.ts` is untouched by this feature.
 */
import * as path from 'path';
import * as fs from 'fs-extra';
import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import '../codegen';

const basePath = path.join(__dirname, 'output');

function manifest(overrides: Partial<DSLManifest> = {}): DSLManifest {
  return {
    name: 'crew-services',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    description: 'Crew roster and pay status',
    owner: 'meridian-station',
    endpoint: 'http://localhost:5005',
    capabilities: [
      { CrewRoster: { type: 'domain', description: 'Crew roster' } },
      { PayStatus: { type: 'domain', description: 'Pay status' } },
      { Load: { type: 'platform', description: 'Initialization' } },
      { Render: { type: 'platform', description: 'Render' } },
    ],
    ...overrides,
  } as DSLManifest;
}

const swiftManifest = () => manifest({ targets: { swift: {} } } as Partial<DSLManifest>);

afterAll(async () => {
  await fs.remove(basePath);
});

/**
 * `GeneratedFile.path` is absolute — `resolveFilePlan` joins every `out`
 * onto basePath. Normalize to MFE-relative so these assertions read as the
 * layout they are describing.
 */
async function generate(m: DSLManifest) {
  const { files } = await generateAllFiles(m, basePath);
  return files.map((f) => ({ ...f, path: path.relative(basePath, f.path).split(path.sep).join('/') }));
}

describe('Swift contributor gating (ADR-095)', () => {
  it('emits NO swift/ files when the manifest declares no swift target', async () => {
    const files = await generate(manifest());
    expect(files.filter((f) => f.path.startsWith('swift/'))).toHaveLength(0);
  });

  it('emits swift/ files when the manifest declares targets.swift', async () => {
    const files = await generate(swiftManifest());
    expect(files.filter((f) => f.path.startsWith('swift/')).length).toBeGreaterThan(0);
  });

  it('still emits the web build alongside the Swift package — one manifest, two builds', async () => {
    const files = await generate(swiftManifest());
    const paths = files.map((f) => f.path);
    // The point of the feature: the React remote is untouched by the Swift target.
    expect(paths).toContain('src/platform/base-mfe/mfe.ts');
    expect(paths.some((p) => p.startsWith('swift/'))).toBe(true);
  });
});

describe('Swift package layout and ownership (ADR-096)', () => {
  const expectedGenerator = [
    'swift/mfe-manifest.json',
    'swift/.gitignore',
    'swift/Plugins/ManifestCodegen/plugin.swift',
    'swift/Sources/MFE/Platform/MFELifecycle.swift',
    'swift/Sources/MFE/Platform/MFEBase.swift',
    'swift/Sources/MFE/Platform/NativeMFEBase.swift',
    'swift/Sources/MFE/Platform/GeneratedMFE.swift',
    'swift/Sources/MFE/Platform/Types.swift',
    'swift/Sources/MFE/Platform/DataProvider.swift',
    'swift/Sources/MFE/Platform/CapabilityViewRegistry.swift',
    'swift/Tests/MFETests/LifecycleTests.swift',
  ];
  const expectedDeveloper = [
    'swift/Package.swift',
    'swift/README.md',
    'swift/Sources/MFE/Features/CapabilityViews.swift',
  ];

  it.each(expectedGenerator)('%s is generator-owned', async (p) => {
    const files = await generate(swiftManifest());
    const f = files.find((x) => x.path === p);
    expect(f).toBeDefined();
    expect(f!.overwrite).toBe(true);
  });

  it.each(expectedDeveloper)('%s is developer-owned', async (p) => {
    const files = await generate(swiftManifest());
    const f = files.find((x) => x.path === p);
    expect(f).toBeDefined();
    expect(f!.overwrite).toBe(false);
  });

  it('puts Platform/ under the generator and Features/ under the developer', async () => {
    // The ownership rule restated: it is the same split the web lane already
    // uses (src/platform/** generator, src/features/** developer), which is
    // why a Swift author's edits survive regeneration.
    const files = await generate(swiftManifest());
    for (const f of files.filter((x) => x.path.startsWith('swift/Sources/MFE/Platform/'))) {
      expect(f.overwrite).toBe(true);
    }
    for (const f of files.filter((x) => x.path.startsWith('swift/Sources/MFE/Features/'))) {
      expect(f.overwrite).toBe(false);
    }
  });
});

describe('Module naming (ADR-095)', () => {
  it('derives a PascalCase module name from the MFE name', async () => {
    const files = await generate(swiftManifest());
    const pkg = files.find((f) => f.path === 'swift/Package.swift')!;
    expect(pkg.content).toContain('name: "CrewServices"');
    // SPM target paths are fixed; the module name is carried by `path:` so the
    // file plan can use static output paths (FileSpec.out is not a function).
    expect(pkg.content).toContain('path: "Sources/MFE"');
  });

  it('honours an explicit moduleName override', async () => {
    const files = await generate(
      manifest({ targets: { swift: { moduleName: 'MeridianCrew' } } } as Partial<DSLManifest>)
    );
    const pkg = files.find((f) => f.path === 'swift/Package.swift')!;
    expect(pkg.content).toContain('name: "MeridianCrew"');
  });

  it('pins the declared swift-tools-version and deployment target', async () => {
    const files = await generate(swiftManifest());
    const pkg = files.find((f) => f.path === 'swift/Package.swift')!;
    expect(pkg.content).toContain('swift-tools-version:5.9');
    expect(pkg.content).toContain('.iOS(.v17)');
  });
});

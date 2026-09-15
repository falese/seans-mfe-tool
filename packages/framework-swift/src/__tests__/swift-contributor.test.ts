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
import { registerSwiftCodegen } from '../codegen';

registerSwiftCodegen();

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
    'swift/Sources/MFE/Features/CrewRosterView.swift',
    'swift/Sources/MFE/Features/PayStatusView.swift',
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

describe('One view file per capability, like the web lane (ADR-095)', () => {
  // The property the single-file design lacked: a capability added later gets
  // its OWN file, which does not exist yet and is therefore written, instead
  // of needing a hand-edit to a developer-owned file regeneration never
  // touches. Mirrors `src/features/<Cap>/<Cap>.tsx`.
  it('emits a view per domain capability and no monolithic views file', async () => {
    const files = await generate(swiftManifest());
    const paths = files.map((f) => f.path);
    expect(paths).toContain('swift/Sources/MFE/Features/CrewRosterView.swift');
    expect(paths).toContain('swift/Sources/MFE/Features/PayStatusView.swift');
    expect(paths).not.toContain('swift/Sources/MFE/Features/CapabilityViews.swift');
  });

  it('gives a newly added capability its own new file', async () => {
    const withThird = {
      ...manifest(),
      capabilities: [
        ...manifest().capabilities,
        { ShiftRoster: { type: 'domain', description: 'Upcoming shifts' } },
      ],
      targets: { swift: {} },
    } as unknown as DSLManifest;
    const files = await generate(withThird);
    const shift = files.find((f) => f.path === 'swift/Sources/MFE/Features/ShiftRosterView.swift');
    expect(shift).toBeDefined();
    expect(shift!.overwrite).toBe(false);
    expect(shift!.content).toContain('public struct ShiftRosterView: View');
    expect(shift!.content).toContain('Upcoming shifts');
  });

  it('registry and views agree on the capability set', async () => {
    const files = await generate(swiftManifest());
    const registry = files.find((f) => f.path.endsWith('CapabilityViewRegistry.swift'))!;
    for (const cap of ['CrewRoster', 'PayStatus']) {
      expect(registry.content).toContain(`case "${cap}": return AnyView(${cap}View())`);
      expect(files.some((f) => f.path.endsWith(`${cap}View.swift`))).toBe(true);
    }
  });
});

describe('A target may implement a subset of capabilities (ADR-095)', () => {
  const subset = () =>
    ({ ...manifest(), targets: { swift: { capabilities: ['CrewRoster'] } } }) as unknown as DSLManifest;

  it('emits views only for the capabilities the target declares', async () => {
    const paths = (await generate(subset())).map((f) => f.path);
    expect(paths).toContain('swift/Sources/MFE/Features/CrewRosterView.swift');
    expect(paths).not.toContain('swift/Sources/MFE/Features/PayStatusView.swift');
  });

  it('keeps the unselected capability in the WEB build', async () => {
    // The subset is this target's contract, not the manifest's.
    const paths = (await generate(subset())).map((f) => f.path);
    expect(paths).toContain('src/features/PayStatus/PayStatus.tsx');
  });

  it('omits the unselected capability from the registry and the provider', async () => {
    const files = await generate(subset());
    const registry = files.find((f) => f.path.endsWith('CapabilityViewRegistry.swift'))!;
    const provider = files.find((f) => f.path.endsWith('DataProvider.swift'))!;
    expect(registry.content).toContain('"CrewRoster"');
    expect(registry.content).not.toContain('PayStatus');
    expect(provider.content).not.toContain('payStatus()');
  });

  it('omits it from the manifest projection the SPM plugin reads', async () => {
    const files = await generate(subset());
    const json = JSON.parse(files.find((f) => f.path.endsWith('swift/mfe-manifest.json'))!.content);
    const names = json.capabilities.map((c: { name: string }) => c.name);
    expect(names).toContain('CrewRoster');
    expect(names).not.toContain('PayStatus');
  });
});

describe('The symmetric spelling (ADR-095 §6)', () => {
  // The sentence a team actually wants to write: "this MFE targets web and
  // mobile", as one list, rather than "it is a React MFE that also does Swift".
  const symmetric = () =>
    ({
      ...manifest(),
      framework: undefined,
      bundler: undefined,
      targets: { web: { framework: 'react', bundler: 'rspack' }, swift: {} },
    }) as unknown as DSLManifest;

  it('generates BOTH builds from targets alone, with no top-level framework', async () => {
    const files = await generate(symmetric());
    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/platform/base-mfe/mfe.ts');
    expect(paths).toContain('swift/Package.swift');
  });

  it('produces the same files as the scalar spelling', async () => {
    const viaTargets = (await generate(symmetric())).map((f) => f.path).sort();
    const viaScalars = (await generate(swiftManifest())).map((f) => f.path).sort();
    expect(viaTargets).toEqual(viaScalars);
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

describe('The Swift target connects to the MFE’s BFF (ADR-012, ADR-095)', () => {
  const withBff = () =>
    ({
      ...manifest(),
      targets: { swift: {} },
      data: {
        sources: [{ name: 'StationOS', handler: { openapi: { source: './specs/station-os.yaml' } } }],
        serve: { endpoint: '/graphql', playground: true },
      },
    }) as unknown as DSLManifest;

  const noBff = () => ({ ...manifest(), targets: { swift: {} } }) as unknown as DSLManifest;

  it('emits a generator-owned BFF client and provider', async () => {
    const files = await generate(withBff());
    for (const p of [
      'swift/Sources/MFE/Platform/BFFClient.swift',
      'swift/Sources/MFE/Platform/BFFDataProvider.swift',
    ]) {
      const f = files.find((x) => x.path === p);
      expect(f).toBeDefined();
      // The wiring from a capability to a query is mechanical, so the platform
      // writes it and keeps writing it.
      expect(f!.overwrite).toBe(true);
    }
  });

  it('bakes the manifest’s BFF endpoint into the client', async () => {
    const client = (await generate(withBff())).find((f) => f.path.endsWith('BFFClient.swift'))!;
    // The MFE and its BFF are one deployable unit on the same origin, so the
    // absolute URL has to be carried — a relative path would resolve against
    // the host app.
    expect(client.content).toContain('http://localhost:5005/graphql');
    expect(client.content).toContain('ProcessInfo.processInfo.environment["BFF_URL"]');
  });

  it('imports FoundationNetworking behind a canImport guard', async () => {
    // URLSession is in FoundationNetworking on Linux. Without this the package
    // stops compiling there, which is where the non-UI surface is verified.
    const client = (await generate(withBff())).find((f) => f.path.endsWith('BFFClient.swift'))!;
    expect(client.content).toContain('#if canImport(FoundationNetworking)');
    expect(client.content).toContain('import FoundationNetworking');
  });

  it('implements the provider protocol, one query per capability', async () => {
    const provider = (await generate(withBff())).find((f) => f.path.endsWith('BFFDataProvider.swift'))!;
    expect(provider.content).toContain('struct BFFCrewServicesDataProvider: CrewServicesDataProvider');
    expect(provider.content).toContain('func crewRoster() async throws -> CrewRosterOutputs');
    expect(provider.content).toContain('try await client.query(CrewRosterQuery.document)');
    expect(provider.content).toContain('try await client.query(PayStatusQuery.document)');
  });

  it('seeds a developer-owned query document per capability', async () => {
    const files = await generate(withBff());
    const q = files.find((f) => f.path === 'swift/Sources/MFE/Features/CrewRosterQuery.swift')!;
    expect(q).toBeDefined();
    // Developer-owned: the BFF's schema is composed by Mesh from data.sources
    // at build time, so codegen cannot know the field names.
    expect(q.overwrite).toBe(false);
    expect(q.content).toContain('public enum CrewRosterQuery');
    expect(q.content).toContain('static let document');
  });

  it('surfaces GraphQL errors ahead of partial data', async () => {
    const client = (await generate(withBff())).find((f) => f.path.endsWith('BFFClient.swift'))!;
    expect(client.content).toContain('throw BFFError.graphQL(errors)');
    expect(client.content).toContain('case network(String, status: Int?)');
  });

  it('emits NONE of it when the manifest declares no data source', async () => {
    // No `data:` means no BFF is generated, so there is nothing to connect to
    // and the provider stays a bare protocol for the host to implement.
    const paths = (await generate(noBff())).map((f) => f.path);
    expect(paths).not.toContain('swift/Sources/MFE/Platform/BFFClient.swift');
    expect(paths).not.toContain('swift/Sources/MFE/Platform/BFFDataProvider.swift');
    expect(paths).not.toContain('swift/Sources/MFE/Features/CrewRosterQuery.swift');
    // The protocol survives either way.
    expect(paths).toContain('swift/Sources/MFE/Platform/DataProvider.swift');
  });

  it('respects the target’s capability subset', async () => {
    const subset = {
      ...withBff(),
      targets: { swift: { capabilities: ['CrewRoster'] } },
    } as unknown as DSLManifest;
    const files = await generate(subset);
    const provider = files.find((f) => f.path.endsWith('BFFDataProvider.swift'))!;
    expect(provider.content).toContain('crewRoster()');
    expect(provider.content).not.toContain('payStatus()');
    expect(files.map((f) => f.path)).not.toContain('swift/Sources/MFE/Features/PayStatusQuery.swift');
  });
});

describe('The BFF provider only returns types the package declares', () => {
  const withBff = () =>
    ({
      ...manifest(),
      targets: { swift: {} },
      data: {
        sources: [{ name: 'StationOS', handler: { openapi: { source: './specs/station-os.yaml' } } }],
        serve: { endpoint: '/graphql', playground: true },
      },
    }) as unknown as DSLManifest;

  it('decodes into a Codable type declared in Types.swift', async () => {
    // `BFFClient.query` needs `T: Decodable`. If a capability's result type
    // were ever emitted as something else — or not emitted at all — the
    // provider would not compile, and no gate here runs a Swift compiler. So
    // assert the pairing directly rather than trusting it.
    const files = await generate(withBff());
    const provider = files.find((f) => f.path.endsWith('BFFDataProvider.swift'))!;
    const types = files.find((f) => f.path.endsWith('Platform/Types.swift'))!;

    const returned = [...provider.content.matchAll(/async throws -> (\w+)/g)].map((m) => m[1]);
    expect(returned.length).toBeGreaterThan(0);
    for (const type of returned) {
      expect(types.content).toContain(`public struct ${type}: Sendable, Codable`);
    }
  });

  it('takes arbitrary Encodable variables, not just strings', async () => {
    // GraphQL variables are arbitrary JSON. A `[String: String]` signature
    // would make any document with a non-string argument unusable.
    const client = (await generate(withBff())).find((f) => f.path.endsWith('BFFClient.swift'))!;
    expect(client.content).toContain('func query<T: Decodable, V: Encodable>(');
    expect(client.content).toContain('variables: V,');
  });
});

describe('The query capability is a concrete default on MFEBase (ADR-053/070)', () => {
  const withBff = () =>
    ({
      ...manifest(),
      targets: { swift: {} },
      data: {
        sources: [{ name: 'StationOS', handler: { openapi: { source: './specs/station-os.yaml' } } }],
        serve: { endpoint: '/graphql', playground: true },
      },
    }) as unknown as DSLManifest;

  const noBff = () => ({ ...manifest(), targets: { swift: {} } }) as unknown as DSLManifest;

  const fileIn = async (m: DSLManifest, suffix: string) =>
    (await generate(m)).find((f) => f.path.endsWith(suffix))!;

  it('lives on MFEBase, the layer BaseMFE.doQuery lives at', async () => {
    // BaseMFE.doQuery is the ONE hook that is not abstract — a working default
    // on the base class. An earlier version of this put it on the generated
    // concrete class, which is a layer the web lane does not use.
    const base = await fileIn(withBff(), 'Platform/MFEBase.swift');
    expect(base.content).toContain('open func doQuery(_ context: MFEContext) async throws -> QueryResult');
    expect(base.content).not.toContain('fatalError("doQuery must be overridden")');

    // The comment explains why; what must not be there is an override.
    const mfe = await fileIn(withBff(), 'Platform/GeneratedMFE.swift');
    expect(mfe.content).not.toContain('override func doQuery');
  });

  it('is emitted with or without a BFF — the capability is uniform (ADR-070)', async () => {
    // An MFE with no data: section answers `data: nil` rather than dialing a
    // non-existent endpoint. That is what makes query uniform across MFEs.
    for (const m of [withBff(), noBff()]) {
      const base = await fileIn(m, 'Platform/MFEBase.swift');
      expect(base.content).toContain('open func doQuery(');
      expect(base.content).toContain('guard let target = override ?? identity.bffEndpoint');
      expect(base.content).toContain('return QueryResult(data: nil, errors: [])');
    }
  });

  it('resolves the endpoint in ADR-053 order', async () => {
    const base = await fileIn(withBff(), 'Platform/MFEBase.swift');
    const body = base.content.slice(base.content.indexOf('open func doQuery('));
    const inputs = body.indexOf('context.inputs["bffUrl"]');
    const env = body.indexOf('environment["BFF_URL"]');
    const baked = body.indexOf('identity.bffEndpoint');
    expect(inputs).toBeGreaterThan(-1);
    expect(env).toBeGreaterThan(inputs);
    expect(baked).toBeGreaterThan(env);
  });

  it('forwards auth and headers off the context', async () => {
    // The web lane's generated doQuery sets Authorization from context.jwt.
    // MFEContext had neither field, so there was nowhere to read it from.
    const base = await fileIn(withBff(), 'Platform/MFEBase.swift');
    expect(base.content).toContain('public var jwt: String?');
    expect(base.content).toContain('public var headers: [String: String]');
    expect(base.content).toContain('request.setValue("Bearer \\(jwt)", forHTTPHeaderField: "Authorization")');
    expect(base.content).toContain('for (field, value) in context.headers');
  });

  it('carries arbitrary JSON inputs, not just strings', async () => {
    // Context.inputs is Record<string, unknown>. [String: String] could not
    // carry a GraphQL variable that is a number, a bool or an object.
    const base = await fileIn(withBff(), 'Platform/MFEBase.swift');
    expect(base.content).toContain('public enum JSONValue: Codable, Sendable, Equatable');
    expect(base.content).toContain('public var inputs: [String: JSONValue]');
    expect(base.content).toContain('payload["variables"] = variables');
  });

  it('still defaults the data provider to the generated BFF-backed one', async () => {
    const mfe = await fileIn(withBff(), 'Platform/GeneratedMFE.swift');
    expect(mfe.content).toContain(
      'provider: CrewServicesDataProvider = BFFCrewServicesDataProvider()',
    );
    expect(mfe.content).toContain('super.init(provider: provider, identity: identity)');
  });

  it('gives the no-BFF package no client and no generated provider', async () => {
    const mfe = await fileIn(noBff(), 'Platform/GeneratedMFE.swift');
    expect(mfe.content).not.toContain('BFFClient');
    expect(mfe.content).not.toContain('public init(');
  });
});

describe('A capability the native lane cannot do throws, rather than claiming success', () => {
  const noBff = () => ({ ...manifest(), targets: { swift: {} } }) as unknown as DSLManifest;

  it('emit and updateControlPlaneState throw MFENotImplementedError', async () => {
    // Both used to return `accepted: true` with no transport behind them —
    // a capability reporting success for work it did not do.
    const native = (await generate(noBff())).find((f) => f.path.endsWith('NativeMFEBase.swift'))!;
    expect(native.content).not.toContain('EmitResult(accepted: true)');
    expect(native.content).not.toContain('ControlPlaneStateResult(accepted: true');
    expect(native.content).toContain('throw MFENotImplementedError(\n            capability: .emit');
    expect(native.content).toContain('capability: .updateControlPlaneState');
  });

  it('names the missing transport, not just the capability', async () => {
    const base = (await generate(noBff())).find((f) => f.path.endsWith('Platform/MFEBase.swift'))!;
    expect(base.content).toContain('public struct MFENotImplementedError');
    const native = (await generate(noBff())).find((f) => f.path.endsWith('NativeMFEBase.swift'))!;
    expect(native.content).toContain('deps.telemetry');
    expect(native.content).toContain('attachControlPlane(wsClient:)');
  });
});

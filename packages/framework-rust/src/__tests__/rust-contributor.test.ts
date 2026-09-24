/**
 * The Rust target's file contribution (ADR-095, ADR-099).
 *
 * The same seam as the Swift lane — a FileContributor gated on its manifest
 * section — so these pin the gate, the layout, the ownership split and the
 * rendering helpers. Whether the output COMPILES is `check:rust-build`'s job:
 * every assertion here is a text assertion, and the Swift lane measured what
 * that costs (ADR-096 §Boundaries).
 */
import * as path from 'path';
import { generateAllFiles } from '@seans-mfe/codegen';
import type { DSLManifest } from '@seans-mfe/dsl';
import { registerRustCodegen, snakeCase, pascalCase, rustText } from '../codegen';

registerRustCodegen();

const basePath = path.join(__dirname, 'output');

function manifest(overrides: Record<string, unknown> = {}): DSLManifest {
  return {
    name: 'crew-services',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    owner: 'meridian-station',
    endpoint: 'http://localhost:5005',
    capabilities: [
      { CrewRoster: { type: 'domain', description: 'Crew & roster' } },
      { PayStatus: { type: 'domain', description: 'Pay status' } },
      {
        Load: {
          type: 'platform',
          lifecycle: {
            before: [{ onLoadBegin: { handler: 'onLoadBegin' } }],
            error: [{ onLoadError: { handler: ['logIt', 'alertIt'], contained: true } }],
          },
        },
      },
    ],
    targets: { rust: {} },
    ...overrides,
  } as unknown as DSLManifest;
}

const withBff = (over: Record<string, unknown> = {}) =>
  manifest({
    data: {
      sources: [{ name: 'StationOS', handler: { openapi: { source: './specs/station-os.yaml' } } }],
      serve: { endpoint: '/graphql' },
    },
    ...over,
  });

async function generate(m: DSLManifest) {
  const { files } = await generateAllFiles(m, basePath);
  return files.map((f) => ({ ...f, path: path.relative(basePath, f.path).split(path.sep).join('/') }));
}

const file = (files: Array<{ path: string; content: string }>, p: string) => {
  const f = files.find((x) => x.path === p);
  if (!f) throw new Error(`not generated: ${p}`);
  return f;
};

describe('Rust contributor gating (ADR-095)', () => {
  it('emits NO rust/ files when the manifest declares no rust target', async () => {
    const files = await generate(manifest({ targets: undefined }));
    expect(files.filter((f) => f.path.startsWith('rust/'))).toHaveLength(0);
  });

  it('emits rust/ beside the web build — one manifest, two builds', async () => {
    const paths = (await generate(manifest())).map((f) => f.path);
    expect(paths).toContain('src/platform/base-mfe/mfe.ts');
    expect(paths).toContain('rust/Cargo.toml');
  });

  it('is independent of the swift target', async () => {
    const paths = (await generate(manifest({ targets: { swift: {}, rust: {} } }))).map((f) => f.path);
    expect(paths).toContain('rust/Cargo.toml');
    // The swift contributor is not registered in this suite, so its absence
    // proves nothing; what is pinned is that declaring swift does not
    // suppress rust.
  });
});

describe('Crate layout and ownership', () => {
  const generator = [
    'rust/.gitignore',
    'rust/src/platform/mod.rs',
    'rust/src/platform/error.rs',
    'rust/src/platform/mfe_lifecycle.rs',
    'rust/src/platform/types.rs',
    'rust/src/platform/manifest_metadata.rs',
    'rust/src/platform/mfe_base.rs',
    'rust/src/platform/native_mfe_base.rs',
    'rust/src/platform/generated_mfe.rs',
    'rust/src/platform/data_provider.rs',
    'rust/src/platform/executor.rs',
    'rust/src/features/mod.rs',
    'rust/tests/lifecycle.rs',
  ];
  const developer = ['rust/Cargo.toml', 'rust/README.md', 'rust/src/lib.rs'];

  it.each(generator)('%s is generator-owned', async (p) => {
    expect(file(await generate(manifest()), p).overwrite).toBe(true);
  });

  it.each(developer)('%s is developer-owned', async (p) => {
    expect(file(await generate(manifest()), p).overwrite).toBe(false);
  });

  it('puts every platform/ file under the generator', async () => {
    const files = await generate(withBff());
    const platform = files.filter((f) => f.path.startsWith('rust/src/platform/'));
    expect(platform.length).toBeGreaterThan(0);
    for (const f of platform) expect(f.overwrite).toBe(true);
  });

  it('keeps generator-owned code out of rustfmt\'s reach', async () => {
    // A developer running `cargo fmt` must not rewrite generator-owned files,
    // or check:mfe-drift reports drift nobody authored.
    const files = await generate(manifest());
    expect(file(files, 'rust/src/lib.rs').content).toMatch(/#\[rustfmt::skip\]\npub mod platform;/);
    expect(file(files, 'rust/tests/lifecycle.rs').content).toMatch(/#\[rustfmt::skip\]\nmod contract \{/);
  });
});

describe('The BFF half is gated on data: (ADR-012, ADR-096 §7)', () => {
  it('emits no client, provider or query documents without a data section', async () => {
    const paths = (await generate(manifest())).map((f) => f.path);
    expect(paths).not.toContain('rust/src/platform/bff_client.rs');
    expect(paths).not.toContain('rust/src/platform/bff_data_provider.rs');
    expect(paths.filter((p) => p.endsWith('_query.rs'))).toEqual([]);
  });

  it('emits them with one developer-owned document per capability', async () => {
    const files = await generate(withBff());
    expect(file(files, 'rust/src/platform/bff_client.rs').overwrite).toBe(true);
    expect(file(files, 'rust/src/platform/bff_data_provider.rs').overwrite).toBe(true);
    const crew = file(files, 'rust/src/features/crew_roster_query.rs');
    expect(crew.overwrite).toBe(false);
    expect(crew.content).toContain('pub const DOCUMENT: &str = "query CrewRoster { __typename }";');
    expect(file(files, 'rust/src/features/pay_status_query.rs').overwrite).toBe(false);
  });

  it('declares every document module in the generator-owned features/mod.rs', async () => {
    const mod = file(await generate(withBff()), 'rust/src/features/mod.rs').content;
    expect(mod).toContain('pub mod crew_roster_query;');
    expect(mod).toContain('pub mod pay_status_query;');
  });

  it('has the provider call each document by the module features/mod.rs declares', async () => {
    const provider = file(await generate(withBff()), 'rust/src/platform/bff_data_provider.rs').content;
    expect(provider).toContain('crate::features::crew_roster_query::DOCUMENT');
    expect(provider).toContain('crate::features::pay_status_query::DOCUMENT');
  });

  it('bakes the composed BFF endpoint into the client and the metadata', async () => {
    const files = await generate(withBff());
    expect(file(files, 'rust/src/platform/bff_client.rs').content).toContain(
      'DEFAULT_ENDPOINT: &\'static str = "http://localhost:5005/graphql"',
    );
    expect(file(files, 'rust/src/platform/manifest_metadata.rs').content).toContain(
      'BFF_ENDPOINT: Option<&str> = Some("http://localhost:5005/graphql")',
    );
  });

  it('bakes None when there is no BFF', async () => {
    const meta = file(await generate(manifest()), 'rust/src/platform/manifest_metadata.rs').content;
    expect(meta).toContain('BFF_ENDPOINT: Option<&str> = None;');
  });
});

describe('A target may implement a subset of capabilities (ADR-095)', () => {
  const subset = () => withBff({ targets: { rust: { capabilities: ['CrewRoster'] } } });

  it('emits documents and provider methods only for the selected capabilities', async () => {
    const files = await generate(subset());
    const paths = files.map((f) => f.path);
    expect(paths).toContain('rust/src/features/crew_roster_query.rs');
    expect(paths).not.toContain('rust/src/features/pay_status_query.rs');
    expect(file(files, 'rust/src/platform/data_provider.rs').content).not.toContain('fn pay_status');
  });

  it('keeps the unselected capability in the WEB build', async () => {
    const paths = (await generate(subset())).map((f) => f.path);
    expect(paths).toContain('src/features/PayStatus/PayStatus.tsx');
  });

  it('omits it from DOMAIN_CAPABILITIES and from what describe reports', async () => {
    const meta = file(await generate(subset()), 'rust/src/platform/manifest_metadata.rs').content;
    expect(meta).toContain('DOMAIN_CAPABILITIES: &[&str] = &["CrewRoster"];');
    expect(meta).not.toContain('"PayStatus"');
    // Platform capabilities are always part of the contract.
    expect(meta).toContain('name: "Load"');
  });
});

describe('Naming', () => {
  it('uses the manifest name as the package, and its underscore form as the lib', async () => {
    const files = await generate(manifest());
    expect(file(files, 'rust/Cargo.toml').content).toContain('name = "crew-services"');
    expect(file(files, 'rust/tests/lifecycle.rs').content).toContain('use crew_services::*;');
    expect(file(files, 'rust/src/platform/generated_mfe.rs').content).toContain(
      'pub type CrewServicesMfe = MfeBase<CrewServicesNative>;',
    );
  });

  it('honours an explicit crateName', async () => {
    const files = await generate(manifest({ targets: { rust: { crateName: 'meridian_crew' } } }));
    expect(file(files, 'rust/Cargo.toml').content).toContain('name = "meridian_crew"');
    expect(file(files, 'rust/src/platform/generated_mfe.rs').content).toContain('pub type MeridianCrewMfe');
  });

  it('prefixes a name Cargo would reject for its leading digit', async () => {
    const files = await generate(manifest({ name: '3d-viewer' }));
    expect(file(files, 'rust/Cargo.toml').content).toContain('name = "mfe-3d-viewer"');
    expect(file(files, 'rust/src/platform/manifest_metadata.rs').content).toContain('NAME: &str = "3d-viewer";');
  });

  it('pins rust-version to what the edition needs', async () => {
    expect(file(await generate(manifest()), 'rust/Cargo.toml').content).toContain('rust-version = "1.75"');
    const e2024 = await generate(manifest({ targets: { rust: { edition: '2024' } } }));
    expect(file(e2024, 'rust/Cargo.toml').content).toContain('edition = "2024"');
    expect(file(e2024, 'rust/Cargo.toml').content).toContain('rust-version = "1.85"');
  });

  it.each([
    ['CrewRoster', 'crew_roster'],
    ['authorizeAccess', 'authorize_access'],
    ['updateControlPlaneState', 'update_control_plane_state'],
    ['HTTPStatus', 'http_status'],
    ['3dView', 'mfe_3d_view'],
  ])('snakeCase(%s) = %s', (input, expected) => {
    expect(snakeCase(input)).toBe(expected);
  });

  it('pascalCases kebab-case names', () => {
    expect(pascalCase('meridian-crew-services')).toBe('MeridianCrewServices');
    expect(pascalCase('9lives')).toBe('Mfe9lives');
  });
});

describe('Text reaches Rust unescaped by HTML and escaped for Rust', () => {
  it('does not HTML-escape descriptions — Rust has nothing to decode &amp;', async () => {
    const meta = file(await generate(manifest()), 'rust/src/platform/manifest_metadata.rs').content;
    expect(meta).toContain('description: "Crew & roster"');
    expect(meta).not.toContain('&amp;');
  });

  it('escapes what a Rust string literal needs', () => {
    expect(rustText('say "hi"\\ now\nplease')).toBe('say \\"hi\\"\\\\ now\\nplease');
  });
});

describe('Manifest lifecycle hooks reach the crate (ADR-098 §5)', () => {
  it('renders every hook into HOOKS, with handler arrays and containment', async () => {
    const meta = file(await generate(manifest()), 'rust/src/platform/manifest_metadata.rs').content;
    expect(meta).toContain('hook: "onLoadBegin"');
    expect(meta).toContain('phase: MfeLifecyclePhase::Before');
    expect(meta).toContain('handlers: &["logIt", "alertIt"]');
    expect(meta).toContain('contained: true');
  });

  it('generates a stub for every handler name, so load() does not fail out of the box', async () => {
    const mfe = file(await generate(manifest()), 'rust/src/platform/generated_mfe.rs').content;
    for (const h of ['onLoadBegin', 'logIt', 'alertIt']) {
      expect(mfe).toContain(`handlers.insert("${h}".to_string()`);
    }
  });

  it('generates a test that RUNS the hooks, not one that reads for them', async () => {
    const test = file(await generate(manifest()), 'rust/tests/lifecycle.rs').content;
    expect(test).toContain('fn manifest_hooks_fire()');
    expect(test).toContain('"before hook onLoadBegin did not fire"');
  });
});

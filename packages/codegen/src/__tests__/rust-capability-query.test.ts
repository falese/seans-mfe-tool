/**
 * Design-time checks for a Rust target (ADR-099).
 *
 * `rust-capability-query` is the Rust lane's `native-capability-query`: the
 * generator-owned `platform/bff_data_provider.rs` and `features/mod.rs` name
 * `<cap>_query` modules that live in DEVELOPER-owned files, so deleting one
 * leaves generated code referring to a module nothing declares. `cargo build`
 * would say `file not found for module` — true, and silent about the fix.
 *
 * `capability-has-a-target` applies to the Rust subset exactly as to Swift's.
 */
import { validateMfeConsistency } from '../validate';
import type { DSLManifest } from '@seans-mfe/dsl';

const MFE = '/abs/mfe';
const FEATURES = `${MFE}/rust/src/features/`;

function manifest(
  capabilities: string[],
  rust: { capabilities?: string[] } | false = {},
  data = true,
): DSLManifest {
  return {
    name: 'crew-services',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    capabilities: [
      ...capabilities.map((c) => ({ [c]: { type: 'domain', description: `The ${c}` } })),
      { Load: { type: 'platform', description: 'Init' } },
    ],
    ...(rust === false ? {} : { targets: { rust } }),
    ...(data
      ? { data: { sources: [{ name: 'S', handler: { openapi: { source: './s.yaml' } } }], serve: { endpoint: '/graphql' } } }
      : {}),
  } as unknown as DSLManifest;
}

const queries = (files: string[]) =>
  files.map((f) => ({ path: `${FEATURES}${f}_query.rs`, text: 'pub const DOCUMENT: &str = "";' }));

/** A fixture the OTHER rules are happy with, so `ok` reflects these rules. */
const base = {
  framework: 'react',
  packageDependencies: {
    react: '~18.2.0',
    'react-dom': '~18.2.0',
    '@seans-mfe-tool/runtime': '^0.1.0',
  },
  sharedEntries: [],
};

const run = (m: DSLManifest, sources?: { path: string; text: string }[]) =>
  validateMfeConsistency({ ...base, manifest: m, sources });

const issuesFor = (r: ReturnType<typeof run>, rule: string) => r.issues.filter((i) => i.rule === rule);

describe('rust-capability-query', () => {
  it('passes when every implemented capability has its document', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus']), queries(['crew_roster', 'pay_status']));
    expect(r.checked).toContain('rust-capability-query');
    expect(issuesFor(r, 'rust-capability-query')).toHaveLength(0);
  });

  it('REPORTS a deleted document by its snake_case file, and fails validation', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus']), queries(['crew_roster']));
    const found = issuesFor(r, 'rust-capability-query');
    expect(found).toHaveLength(1);
    expect(found[0].package).toBe('PayStatus');
    expect(found[0].message).toContain('rust/src/features/pay_status_query.rs');
    expect(found[0].message).toContain('bff_data_provider.rs');
    expect(found[0].fix).toContain('remote:generate');
    expect(r.ok).toBe(false);
  });

  it('does NOT run without a data source — no BFF, no documents', () => {
    const r = run(manifest(['CrewRoster'], {}, false), []);
    expect(r.checked).not.toContain('rust-capability-query');
  });

  it('does NOT run without a rust target', () => {
    const r = run(manifest(['CrewRoster'], false), []);
    expect(r.checked).not.toContain('rust-capability-query');
  });

  it('does NOT run without sources — a scan over nothing reports everything', () => {
    const r = run(manifest(['CrewRoster']));
    expect(r.checked).not.toContain('rust-capability-query');
  });

  it('follows the target\'s capability subset', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus'], { capabilities: ['CrewRoster'] }), queries(['crew_roster']));
    expect(issuesFor(r, 'rust-capability-query')).toHaveLength(0);
  });

  it('is not fooled by a Swift document of the same capability', () => {
    const r = run(manifest(['PayStatus']), [
      { path: `${MFE}/swift/Sources/MFE/Features/PayStatusQuery.swift`, text: '' },
    ]);
    expect(issuesFor(r, 'rust-capability-query')).toHaveLength(1);
  });
});

describe('capability-has-a-target, for the Rust subset', () => {
  it('warns about a domain capability the Rust target does not implement', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus'], { capabilities: ['CrewRoster'] }), queries(['crew_roster']));
    const found = issuesFor(r, 'capability-has-a-target');
    expect(found).toHaveLength(1);
    expect(found[0].package).toBe('PayStatus');
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('Rust');
    expect(found[0].fix).toContain('targets.rust.capabilities');
  });

  it('lists the rule once in checked even when both targets declare a subset', () => {
    const m = {
      ...manifest(['CrewRoster', 'PayStatus'], { capabilities: ['CrewRoster'] }, false),
      targets: { rust: { capabilities: ['CrewRoster'] }, swift: { capabilities: ['PayStatus'] } },
    } as unknown as DSLManifest;
    const r = run(m, [{ path: `${MFE}/swift/Sources/MFE/Features/PayStatusView.swift`, text: '' }]);
    expect(r.checked.filter((c) => c === 'capability-has-a-target')).toHaveLength(1);
    expect(issuesFor(r, 'capability-has-a-target').map((i) => i.package).sort()).toEqual(['CrewRoster', 'PayStatus']);
  });
});

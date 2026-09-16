/**
 * Design-time checks for a Swift target's capability views (ADR-095/096).
 *
 * `native-capability-view` is a BACKSTOP now, not the mechanism. Views are
 * emitted one file per capability, so a capability added to the manifest gets
 * its own new file that regeneration writes — the same behaviour the web lane
 * has always had via `featureSpecs()`. This rule catches what is left: a view
 * someone deleted.
 *
 * It exists at all because the compiler cannot be relied on. The registry's
 * reference to `<Cap>View` sits inside `#if canImport(SwiftUI)`, which compiles
 * out on Linux where the package otherwise builds — so a missing view would
 * still reach `declared`, `mount()` would still accept it, and the capability
 * would render nothing.
 *
 * `capability-has-a-target` is the companion: a domain capability the native
 * target does not implement is a warning, because a target whose generator does
 * not exist yet is a legitimate reason not to implement it.
 */
import { validateMfeConsistency } from '../validate';
import type { DSLManifest } from '@seans-mfe/dsl';

// Absolute, as `collectSources` supplies them: the command relativises
// `issue.location` when printing, so it cannot hand relative paths in.
const MFE = '/abs/mfe';
const FEATURES = `${MFE}/swift/Sources/MFE/Features/`;

function manifest(capabilities: string[], swift?: { capabilities?: string[] } | false): DSLManifest {
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
    ...(swift === false ? {} : { targets: { swift: swift ?? {} } }),
  } as unknown as DSLManifest;
}

/** The same manifest, plus the `data:` section that generates a BFF. */
function withBff(m: DSLManifest): DSLManifest {
  return {
    ...m,
    data: {
      sources: [{ name: 'StationOS', handler: { openapi: { source: './specs/station-os.yaml' } } }],
      serve: { endpoint: '/graphql', playground: true },
    },
  } as unknown as DSLManifest;
}

/** One source entry per existing query document. */
const queries = (names: string[]) =>
  names.map((n) => ({
    path: `${FEATURES}${n}Query.swift`,
    text: `public enum ${n}Query { public static let document = "" }`,
  }));

/** One source entry per existing view file. */
const views = (names: string[]) =>
  names.map((n) => ({ path: `${FEATURES}${n}View.swift`, text: `public struct ${n}View: View {}` }));

/**
 * A fixture the OTHER rules are happy with, so `result.ok` reflects the rules
 * under test. An earlier version used `^18.2.0` and no design-system deps,
 * which made `react-pinned` and `manifest-package-sync` fail — and two
 * assertions here passed for that reason rather than their own.
 */
const base = {
  framework: 'react',
  packageDependencies: {
    react: '~18.2.0',
    'react-dom': '~18.2.0',
    '@seans-mfe-tool/runtime': '^0.1.0',
    '@mui/material': '^5.14.0',
    '@mui/system': '^5.14.0',
    '@emotion/react': '^11.11.1',
    '@emotion/styled': '^11.11.0',
  },
  sharedEntries: [],
};

const run = (m: DSLManifest, sources?: { path: string; text: string }[]) =>
  validateMfeConsistency({ ...base, manifest: m, sources });

const issuesFor = (r: ReturnType<typeof run>, rule: string) => r.issues.filter((i) => i.rule === rule);

describe('native-capability-view', () => {
  it('passes when every implemented capability has its view file', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus']), views(['CrewRoster', 'PayStatus']));
    expect(r.checked).toContain('native-capability-view');
    expect(issuesFor(r, 'native-capability-view')).toHaveLength(0);
  });

  it('REPORTS a deleted view — the case the compiler misses on Linux', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus']), views(['CrewRoster']));
    const found = issuesFor(r, 'native-capability-view');
    expect(found).toHaveLength(1);
    expect(found[0].package).toBe('PayStatus');
  });

  it('fails validation — a capability that renders nothing is a broken build', () => {
    const clean = run(manifest(['PayStatus']), views(['PayStatus']));
    expect(clean.ok).toBe(true); // the fixture itself is otherwise valid

    const r = run(manifest(['PayStatus']), views([]));
    expect(issuesFor(r, 'native-capability-view')).toHaveLength(1);
    expect(r.ok).toBe(false);
  });

  it('names the file and a fix, without repeating the path in the message', () => {
    const r = run(manifest(['PayStatus']), views([]));
    const issue = issuesFor(r, 'native-capability-view')[0];
    // No `location`: the file is missing, so there is no real path to
    // relativise and a synthesised one renders wrong (it resolved against cwd
    // and printed as `../../../swift/...`).
    expect(issue.location).toBeUndefined();
    expect(issue.message).toMatch(/PayStatusView\.swift does not exist/);
    expect(issue.fix).toMatch(/PayStatusView/);
  });

  it('reports every missing view, not just the first', () => {
    const r = run(manifest(['A', 'B', 'C']), views(['B']));
    expect(issuesFor(r, 'native-capability-view').map((i) => i.package)).toEqual(['A', 'C']);
  });

  it('does not mistake a neighbouring file for the view', () => {
    // `CrewRosterDetailView.swift` must not satisfy `CrewRoster`.
    const r = run(manifest(['CrewRoster']), views(['CrewRosterDetail']));
    expect(issuesFor(r, 'native-capability-view')).toHaveLength(1);
  });

  it('only requires views for the capabilities the target implements', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus'], { capabilities: ['CrewRoster'] }), views(['CrewRoster']));
    expect(issuesFor(r, 'native-capability-view')).toHaveLength(0);
  });

  it('ignores a declared capability the manifest does not have', () => {
    const r = run(manifest(['CrewRoster'], { capabilities: ['CrewRoster', 'Ghost'] }), views(['CrewRoster']));
    expect(issuesFor(r, 'native-capability-view')).toHaveLength(0);
  });
});

describe('capability-has-a-target', () => {
  it('warns about a domain capability the native target does not implement', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus'], { capabilities: ['CrewRoster'] }), views(['CrewRoster']));
    const found = issuesFor(r, 'capability-has-a-target');
    expect(found).toHaveLength(1);
    expect(found[0].package).toBe('PayStatus');
  });

  it('warns rather than failing — the web build still carries it', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus'], { capabilities: ['CrewRoster'] }), views(['CrewRoster']));
    expect(issuesFor(r, 'capability-has-a-target')[0].severity).toBe('warning');
    expect(r.ok).toBe(true);
  });

  it('is not evaluated when the target declares no subset — all means all', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus']), views(['CrewRoster', 'PayStatus']));
    expect(r.checked).not.toContain('capability-has-a-target');
  });
});

describe('scoping', () => {
  it('neither rule runs without a swift target', () => {
    const r = run(manifest(['CrewRoster'], false), views([]));
    expect(r.checked).not.toContain('native-capability-view');
    expect(r.checked).not.toContain('capability-has-a-target');
  });

  it('neither rule runs without sources', () => {
    const r = run(manifest(['CrewRoster']));
    expect(r.checked).not.toContain('native-capability-view');
  });

  it('platform capabilities need no view', () => {
    const r = run(manifest([]), views([]));
    expect(issuesFor(r, 'native-capability-view')).toHaveLength(0);
  });
});

describe('native-views-legacy-file', () => {
  it('reports the pre-split monolith, which regeneration cannot delete', () => {
    const r = run(manifest(['CrewRoster']), [
      ...views(['CrewRoster']),
      { path: `${FEATURES}CapabilityViews.swift`, text: 'public struct CrewRosterView: View {}' },
    ]);
    const found = issuesFor(r, 'native-views-legacy-file');
    expect(found).toHaveLength(1);
    // A real file, so the location is a real absolute path the command can
    // relativise for display.
    expect(found[0].location).toBe(`${FEATURES}CapabilityViews.swift`);
    expect(found[0].fix).toMatch(/delete this file/);
    expect(r.ok).toBe(false);
  });

  it('stays silent once the file is gone', () => {
    const r = run(manifest(['CrewRoster']), views(['CrewRoster']));
    expect(issuesFor(r, 'native-views-legacy-file')).toHaveLength(0);
  });

  it('is not a PLATFORM_MIGRATIONS entry, and could not have been', () => {
    // `findMigrationHits` matches line by line, and the old and new files carry
    // byte-identical lines (`public struct CrewRosterView: View {`). The
    // distinguishing fact is the file's existence, which no line pattern can
    // express. An earlier attempt shipped a multi-line regex that could never
    // fire, and its test passed only because it bypassed the scanner.
    const { PLATFORM_MIGRATIONS } = require('../platform-migrations');
    expect(PLATFORM_MIGRATIONS.map((m: { id: string }) => m.id)).not.toContain(
      'swift-views-split-per-capability',
    );
  });
});

/**
 * `native-capability-query` — the companion backstop for a deleted DOCUMENT.
 *
 * Sharper than the view case: `Platform/BFFDataProvider.swift` is
 * GENERATOR-owned and calls `<Cap>Query.document` by name, so a deleted
 * document leaves generated code referring to a symbol nothing declares. A
 * Swift compiler would catch it — nothing in CI runs one, and the message it
 * would give (`cannot find 'PayStatusQuery' in scope`) names the symbol and no
 * fix.
 */
describe('native-capability-query', () => {
  it('passes when every implemented capability has its document', () => {
    const r = run(withBff(manifest(['CrewRoster', 'PayStatus'])), [
      ...views(['CrewRoster', 'PayStatus']),
      ...queries(['CrewRoster', 'PayStatus']),
    ]);
    expect(r.checked).toContain('native-capability-query');
    expect(issuesFor(r, 'native-capability-query')).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('REPORTS a deleted document, and fails validation', () => {
    const r = run(withBff(manifest(['CrewRoster', 'PayStatus'])), [
      ...views(['CrewRoster', 'PayStatus']),
      ...queries(['CrewRoster']),
    ]);
    const found = issuesFor(r, 'native-capability-query');
    expect(found).toHaveLength(1);
    expect(found[0].package).toBe('PayStatus');
    // Generated code would not compile against it — not a warning.
    expect(r.ok).toBe(false);
  });

  it('names the generated caller, so the fix is actionable without the ADR', () => {
    const r = run(withBff(manifest(['PayStatus'])), views(['PayStatus']));
    const issue = issuesFor(r, 'native-capability-query')[0];
    expect(issue.location).toBeUndefined();
    expect(issue.message).toContain('PayStatusQuery.document');
    expect(issue.message).toContain('BFFDataProvider.swift');
    expect(issue.fix).toContain('remote:generate');
  });

  it('does NOT run when the manifest declares no data source', () => {
    // No `data:` means no BFF, so no query documents are emitted and none can
    // be missing. Views are still checked.
    const r = run(manifest(['CrewRoster']), views(['CrewRoster']));
    expect(r.checked).toContain('native-capability-view');
    expect(r.checked).not.toContain('native-capability-query');
    expect(issuesFor(r, 'native-capability-query')).toHaveLength(0);
  });

  it('follows the target’s capability subset, not every domain capability', () => {
    // PayStatus is web-only here, so the native target owes it no document.
    const r = run(
      withBff(manifest(['CrewRoster', 'PayStatus'], { capabilities: ['CrewRoster'] })),
      [...views(['CrewRoster']), ...queries(['CrewRoster'])],
    );
    expect(issuesFor(r, 'native-capability-query')).toHaveLength(0);
  });
});

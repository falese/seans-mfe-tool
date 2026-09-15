/**
 * Every domain capability a Swift target declares must have a view
 * (ADR-095/096) — checked at design time, not left to a compiler.
 *
 * The first implementation had no check at all. It relied on the generated
 * `CapabilityViewRegistry.swift` referencing `<Cap>View` and therefore failing
 * to compile until the author wrote it, and ADR-096 called that "the ADR-082
 * posture". Two things were wrong with that:
 *
 *   1. The reference lives inside `#if canImport(SwiftUI)`. On Linux — where
 *      the package demonstrably builds — the whole function compiles out, so
 *      NOTHING fails. `declared` still gains the id, `mount()` still accepts
 *      it via `declared.contains`, and rendering that capability succeeds with
 *      no view behind it.
 *   2. ADR-082's mechanism is a diagnostic naming a file, a line and a fix.
 *      A compile error that only happens on Apple platforms is not that.
 *
 * So the rule lives here, beside the other design-time rules, and fires
 * wherever `mfe:validate` and `check:mfe-consistency` run.
 */
import { validateMfeConsistency } from '../validate';
import type { DSLManifest } from '@seans-mfe/dsl';

const VIEWS_PATH = 'swift/Sources/MFE/Features/CapabilityViews.swift';

function manifest(capabilities: string[], withSwift = true): DSLManifest {
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
    ...(withSwift ? { targets: { swift: {} } } : {}),
  } as unknown as DSLManifest;
}

const viewsFile = (views: string[]) => ({
  path: VIEWS_PATH,
  text:
    '#if canImport(SwiftUI)\nimport SwiftUI\n\n' +
    views.map((v) => `public struct ${v}View: View {\n  public var body: some View { EmptyView() }\n}`).join('\n\n') +
    '\n#endif\n',
});

const base = {
  framework: 'react',
  packageDependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', '@seans-mfe-tool/runtime': '^0.1.0' },
  sharedEntries: [],
};

const run = (m: DSLManifest, sources?: { path: string; text: string }[]) =>
  validateMfeConsistency({ ...base, manifest: m, sources });

describe('native-capability-view', () => {
  it('passes when every declared capability has a view', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus']), [viewsFile(['CrewRoster', 'PayStatus'])]);
    expect(r.checked).toContain('native-capability-view');
    expect(r.issues.filter((i) => i.rule === 'native-capability-view')).toHaveLength(0);
  });

  it('REPORTS a capability with no view — the case the compiler misses on Linux', () => {
    const r = run(manifest(['CrewRoster', 'PayStatus', 'ShiftRoster']), [
      viewsFile(['CrewRoster', 'PayStatus']),
    ]);
    const found = r.issues.filter((i) => i.rule === 'native-capability-view');
    expect(found).toHaveLength(1);
    expect(found[0].package).toBe('ShiftRoster');
  });

  it('fails validation — this is an error, not an advisory warning', () => {
    // A capability that renders nothing is a broken build, not a nudge.
    const r = run(manifest(['ShiftRoster']), [viewsFile([])]);
    expect(r.ok).toBe(false);
  });

  it('names the file and a fix the author can act on without reading an ADR', () => {
    const r = run(manifest(['ShiftRoster']), [viewsFile([])]);
    const issue = r.issues.find((i) => i.rule === 'native-capability-view')!;
    expect(issue.location).toBe(VIEWS_PATH);
    // The reporter renders `location` after `message`, so the message must not
    // repeat the path or it reads as a stutter.
    expect(issue.message).not.toContain(VIEWS_PATH);
    expect(issue.fix).toMatch(/ShiftRosterView/);
    expect(issue.fix).toMatch(/CapabilityViews\.swift/);
  });

  it('reports every missing capability, not just the first', () => {
    const r = run(manifest(['A', 'B', 'C']), [viewsFile(['B'])]);
    expect(r.issues.filter((i) => i.rule === 'native-capability-view').map((i) => i.package)).toEqual(['A', 'C']);
  });
});

describe('native-capability-view is scoped', () => {
  it('is not checked when the manifest declares no swift target', () => {
    const r = run(manifest(['CrewRoster'], false), [viewsFile([])]);
    expect(r.checked).not.toContain('native-capability-view');
    expect(r.issues.filter((i) => i.rule === 'native-capability-view')).toHaveLength(0);
  });

  it('is not checked when the caller supplied no sources', () => {
    // Same posture as slots-implemented: a scan over nothing would report
    // every capability as missing.
    const r = run(manifest(['CrewRoster']));
    expect(r.checked).not.toContain('native-capability-view');
  });

  it('ignores platform capabilities — only domain capabilities get views', () => {
    const r = run(manifest([]), [viewsFile([])]);
    expect(r.issues.filter((i) => i.rule === 'native-capability-view')).toHaveLength(0);
  });

  it('does not mistake a substring for a match', () => {
    // `CrewRosterDetailView` must not satisfy `CrewRoster`.
    const r = run(manifest(['CrewRoster']), [viewsFile(['CrewRosterDetail'])]);
    expect(r.issues.filter((i) => i.rule === 'native-capability-view')).toHaveLength(1);
  });
});

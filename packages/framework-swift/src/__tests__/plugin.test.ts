/**
 * The Swift target is a BaseFrameworkPlugin, not a fourth kind of thing
 * (ADR-097).
 *
 * The earlier shape split a target's two halves across two objects: a
 * framework plugin with a build lifecycle and no codegen, and a contributor
 * with codegen and no build lifecycle. React and Angular already had that
 * split, joined only by the string `plugin.id`. This suite pins that the Swift
 * target carries BOTH halves on one object, so `swift build` is reachable from
 * the CLI at all.
 */
import { BaseFrameworkPlugin } from '@seans-mfe/contracts';
import { frameworkPlugin, SwiftSpmPlugin } from '../index';

describe('SwiftSpmPlugin identity', () => {
  it('is a BaseFrameworkPlugin', () => {
    expect(frameworkPlugin).toBeInstanceOf(BaseFrameworkPlugin);
    expect(frameworkPlugin).toBeInstanceOf(SwiftSpmPlugin);
  });

  it('uses the same framework+bundler id shape as the other two plugins', () => {
    // react-rspack, angular-webpack, swiftui-spm.
    expect(frameworkPlugin.id).toBe('swiftui-spm');
    expect(frameworkPlugin.framework).toBe('swiftui');
    expect(frameworkPlugin.bundler).toBe('spm');
  });

  it('declares targetId "swift" — selected by targets:, not by framework:', () => {
    expect(frameworkPlugin.targetId).toBe('swift');
  });

  it('exports the well-known singleton the loader resolves', () => {
    expect(frameworkPlugin).toBeDefined();
  });
});

describe('The build lifecycle the contributor-only shape lacked', () => {
  it('implements checkEnvironment', async () => {
    const checks = await frameworkPlugin.checkEnvironment();
    expect(checks).toHaveLength(1);
    expect(checks[0].tool).toBe('swift');
    // No Swift toolchain in CI, so `ok` is environment-dependent; what is
    // pinned is that the check exists and names a fix.
    expect(checks[0].fix).toMatch(/swift\.org|Xcode/);
  });

  it('implements buildProduction', () => {
    expect(typeof frameworkPlugin.buildProduction).toBe('function');
  });
});

describe('The web-shaped members are absent, not stubbed (ADR-097)', () => {
  // Absent rather than throwing, so a caller narrows on the type instead of
  // discovering it at runtime.
  it.each(['defaultPort', 'startDevServer', 'getDockerStrategy'] as const)(
    'does not declare %s',
    (member) => {
      expect(frameworkPlugin[member]).toBeUndefined();
    },
  );
});

describe('getSharedDependencies is empty by contract, not by accident', () => {
  it('returns no shared deps', () => {
    // A Module Federation shared scope deduplicates singletons across
    // separately-fetched bundles. SPM resolves at build time and the linker
    // emits one copy, so there is nothing to negotiate (ADR-096).
    expect(frameworkPlugin.getSharedDependencies({})).toEqual([]);
  });
});

describe('registerCodegen carries the other half', () => {
  it('registers the Swift file contributor', () => {
    const { fileContributors, unregisterFileContributor } = jest.requireActual('@seans-mfe/codegen');
    unregisterFileContributor('swift');
    expect(fileContributors().map((c: { id: string }) => c.id)).not.toContain('swift');

    frameworkPlugin.registerCodegen();

    expect(fileContributors().map((c: { id: string }) => c.id)).toContain('swift');
  });

  it('is idempotent — the drift gate calls it once per manifest in a fleet loop', () => {
    const { fileContributors } = jest.requireActual('@seans-mfe/codegen');
    frameworkPlugin.registerCodegen();
    frameworkPlugin.registerCodegen();
    const swift = fileContributors().filter((c: { id: string }) => c.id === 'swift');
    expect(swift).toHaveLength(1);
  });
});

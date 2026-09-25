/**
 * Plural target resolution (ADR-097).
 *
 * `loadFrameworkPlugin` answers "which ONE plugin does this manifest's
 * `framework` field name". Five production call sites assumed that was the
 * whole answer. Once a manifest can declare `targets:` (ADR-095) it is not:
 * such a manifest produces two artifacts and therefore has two plugins, and
 * anything that checks environments or runs builds has to see both.
 */
import { loadTargetPlugins, loadTargetPlugin, assertServesHttp } from '../loader';
import { loadFrameworkPlugin } from '../loader';
import type { DSLManifest } from '@seans-mfe/dsl';

function manifest(overrides: Partial<DSLManifest> = {}): DSLManifest {
  return {
    name: 'crew-services',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    framework: 'react',
    bundler: 'rspack',
    capabilities: [{ Health: { type: 'platform', description: 'Health' } }],
    ...overrides,
  } as DSLManifest;
}

describe('loadTargetPlugins', () => {
  it('returns just the primary plugin when no targets are declared', () => {
    const plugins = loadTargetPlugins(manifest());
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe('react-rspack');
    expect(plugins[0].targetId).toBe('web');
  });

  it('returns the primary AND the swift plugin when targets.swift is declared', () => {
    const plugins = loadTargetPlugins(manifest({ targets: { swift: {} } } as Partial<DSLManifest>));
    expect(plugins.map((p) => p.id)).toEqual(['react-rspack', 'swiftui-spm']);
  });

  it('returns the rust plugin for targets.rust (ADR-099)', () => {
    const plugins = loadTargetPlugins(manifest({ targets: { rust: {} } } as Partial<DSLManifest>));
    expect(plugins.map((p) => p.id)).toEqual(['react-rspack', 'rust-cargo']);
    expect(plugins[1].targetId).toBe('rust');
  });

  it('returns one plugin per declared target, in declaration order', () => {
    const plugins = loadTargetPlugins(manifest({ targets: { swift: {}, rust: {} } } as Partial<DSLManifest>));
    expect(plugins.map((p) => p.id)).toEqual(['react-rspack', 'swiftui-spm', 'rust-cargo']);
  });

  it('puts the primary first — build order and result aggregation depend on it', () => {
    const plugins = loadTargetPlugins(manifest({ targets: { swift: {} } } as Partial<DSLManifest>));
    expect(plugins[0].targetId).toBe('web');
  });

  it('works for an Angular primary too — targets are orthogonal to framework', () => {
    const plugins = loadTargetPlugins(
      manifest({ framework: 'angular', bundler: 'webpack', targets: { swift: {} } } as Partial<DSLManifest>)
    );
    expect(plugins.map((p) => p.id)).toEqual(['angular-webpack', 'swiftui-spm']);
  });

  it('skips an unknown target with a warning rather than failing the command', () => {
    // Open-world policy, same as `framework` and `bundler` (ADR-036, #181): a
    // manifest naming a target this install has no generator for is not an
    // invalid manifest.
    const warn = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const plugins = loadTargetPlugins(
      manifest({ targets: { kotlin: {} } } as unknown as Partial<DSLManifest>)
    );
    expect(plugins.map((p) => p.id)).toEqual(['react-rspack']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('kotlin'));
    warn.mockRestore();
  });
});

describe('loadTargetPlugin', () => {
  it('resolves swift to the built-in package', () => {
    expect(loadTargetPlugin('swift').id).toBe('swiftui-spm');
  });
});

describe('assertServesHttp', () => {
  it('passes for the web plugins', () => {
    expect(() => assertServesHttp(loadFrameworkPlugin('react'), 'build:dev')).not.toThrow();
    expect(() => assertServesHttp(loadFrameworkPlugin('angular'), 'build:dev')).not.toThrow();
  });

  it('rejects a natively-linked target, naming the command and the target', () => {
    expect(() => assertServesHttp(loadTargetPlugin('swift'), 'build:dev')).toThrow(/build:dev/);
    expect(() => assertServesHttp(loadTargetPlugin('swift'), 'build:docker')).toThrow(/swift/);
  });
});

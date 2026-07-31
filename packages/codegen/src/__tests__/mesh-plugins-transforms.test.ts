import { resolveNeededMeshPluginsAndTransforms } from '../unified-generator';
import type { DSLManifest } from '@falese/smt-dsl';

const baseManifest: DSLManifest = {
  name: 'demo-widget',
  version: '1.0.0',
  type: 'remote',
  language: 'typescript',
  capabilities: [],
} as unknown as DSLManifest;

describe('resolveNeededMeshPluginsAndTransforms', () => {
  it('defaults to responseCache + prometheus + namingConvention with no performance config', () => {
    const { neededPlugins, neededTransforms } = resolveNeededMeshPluginsAndTransforms(baseManifest);
    expect(neededPlugins.sort()).toEqual(['prometheus', 'responseCache']);
    expect(neededTransforms).toEqual(['namingConvention']);
  });

  it('drops responseCache when caching is explicitly disabled', () => {
    const manifest = { ...baseManifest, performance: { caching: { enabled: false } } } as DSLManifest;
    const { neededPlugins } = resolveNeededMeshPluginsAndTransforms(manifest);
    expect(neededPlugins).not.toContain('responseCache');
  });

  it('adds opentelemetry only when explicitly enabled', () => {
    const manifest = {
      ...baseManifest,
      performance: { observability: { opentelemetry: { enabled: true } } },
    } as DSLManifest;
    const { neededPlugins } = resolveNeededMeshPluginsAndTransforms(manifest);
    expect(neededPlugins).toContain('opentelemetry');
  });

  it('adds resolversComposition when the manifest declares custom transforms', () => {
    const manifest = { ...baseManifest, transforms: ['- someTransform: {}'] } as DSLManifest;
    const { neededTransforms } = resolveNeededMeshPluginsAndTransforms(manifest);
    expect(neededTransforms).toContain('resolversComposition');
  });

  it('adds resolversComposition when the demo-mode mock switch is enabled (ADR-052)', () => {
    const manifest = {
      ...baseManifest,
      data: { sources: [], mockSwitch: { enabled: true } },
    } as unknown as DSLManifest;
    const { neededTransforms } = resolveNeededMeshPluginsAndTransforms(manifest);
    expect(neededTransforms).toContain('resolversComposition');
  });
});

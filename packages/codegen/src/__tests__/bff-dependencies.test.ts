import { resolveBffDependencies, resolveNeededMeshPluginsAndTransforms, DEPENDENCY_VERSIONS } from '../unified-generator';
import type { DSLManifest } from '@seans-mfe/dsl';

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

describe('resolveBffDependencies', () => {
  it('returns null when the manifest has no data: section', () => {
    expect(resolveBffDependencies(baseManifest)).toBeNull();
  });

  it('returns the base Mesh dependency set package.json.ejs renders for a plain data: manifest', () => {
    const manifest = { ...baseManifest, data: { sources: [] } } as unknown as DSLManifest;
    const result = resolveBffDependencies(manifest);
    expect(result).not.toBeNull();
    expect(result!.dependencies).toMatchObject({
      '@graphql-mesh/serve-runtime': DEPENDENCY_VERSIONS.graphqlMesh.serveRuntime,
      '@graphql-tools/delegate': DEPENDENCY_VERSIONS.graphqlTools.delegate,
      '@graphql-tools/utils': DEPENDENCY_VERSIONS.graphqlTools.utils,
      '@graphql-tools/wrap': DEPENDENCY_VERSIONS.graphqlTools.wrap,
      express: DEPENDENCY_VERSIONS.core.express,
      graphql: DEPENDENCY_VERSIONS.core.graphql,
      cors: DEPENDENCY_VERSIONS.core.cors,
      helmet: DEPENDENCY_VERSIONS.core.helmet,
      tslib: DEPENDENCY_VERSIONS.core.tslib,
      '@graphql-mesh/plugin-response-cache': DEPENDENCY_VERSIONS.meshPlugins.responseCache,
      '@graphql-mesh/plugin-prometheus': DEPENDENCY_VERSIONS.meshPlugins.prometheus,
      '@graphql-mesh/transform-naming-convention': DEPENDENCY_VERSIONS.meshTransforms.namingConvention,
    });
    expect(result!.devDependencies).toMatchObject({
      '@graphql-mesh/cli': DEPENDENCY_VERSIONS.graphqlMesh.cli,
      '@graphql-mesh/openapi': DEPENDENCY_VERSIONS.graphqlMesh.openapi,
      '@types/cors': DEPENDENCY_VERSIONS.types.cors,
      '@types/express': DEPENDENCY_VERSIONS.types.express,
      'ts-node': DEPENDENCY_VERSIONS.buildTools.tsNode,
      concurrently: DEPENDENCY_VERSIONS.buildTools.concurrently,
    });
  });

  it('omits opentelemetry, rate-limit, and filter-schema transforms when not requested', () => {
    const manifest = { ...baseManifest, data: { sources: [] } } as unknown as DSLManifest;
    const result = resolveBffDependencies(manifest)!;
    expect(result.dependencies).not.toHaveProperty('@graphql-mesh/plugin-opentelemetry');
    expect(result.dependencies).not.toHaveProperty('@graphql-mesh/transform-rate-limit');
    expect(result.dependencies).not.toHaveProperty('@graphql-mesh/transform-filter-schema');
    expect(result.dependencies).not.toHaveProperty('@graphql-mesh/transform-resolvers-composition');
  });

  it('includes the rate-limit transform when the manifest turns it on', () => {
    const manifest = {
      ...baseManifest,
      data: { sources: [] },
      performance: { rateLimit: { enabled: true } },
    } as unknown as DSLManifest;
    const result = resolveBffDependencies(manifest)!;
    expect(result.dependencies['@graphql-mesh/transform-rate-limit']).toBe(
      DEPENDENCY_VERSIONS.meshTransforms.rateLimit,
    );
  });
});

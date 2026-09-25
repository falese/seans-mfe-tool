/**
 * The Rust target is a BaseFrameworkPlugin carrying both halves of a target —
 * build lifecycle and codegen — on one object (ADR-097, ADR-099).
 */
import { BaseFrameworkPlugin } from '@seans-mfe/contracts';
import { fileContributors, unregisterFileContributor } from '@seans-mfe/codegen';

const findFileContributor = (id: string) => fileContributors().find((c) => c.id === id);
import { frameworkPlugin, RustCargoPlugin } from '../index';

describe('RustCargoPlugin identity', () => {
  it('is a BaseFrameworkPlugin', () => {
    expect(frameworkPlugin).toBeInstanceOf(BaseFrameworkPlugin);
    expect(frameworkPlugin).toBeInstanceOf(RustCargoPlugin);
  });

  it('uses the framework+bundler id shape the other plugins use', () => {
    // react-rspack, angular-webpack, swiftui-spm, rust-cargo.
    expect(frameworkPlugin.id).toBe('rust-cargo');
    expect(frameworkPlugin.framework).toBe('rust');
    expect(frameworkPlugin.bundler).toBe('cargo');
  });

  it('declares targetId "rust" — selected by targets:, not by framework:', () => {
    expect(frameworkPlugin.targetId).toBe('rust');
  });

  it('declares no HTTP surface — a linked library has none (ADR-097)', () => {
    expect(frameworkPlugin.defaultPort).toBeUndefined();
    expect(frameworkPlugin.startDevServer).toBeUndefined();
    expect(frameworkPlugin.getDockerStrategy).toBeUndefined();
  });

  it('has no shared scope to negotiate — Cargo links one copy', () => {
    expect(frameworkPlugin.getSharedDependencies({})).toEqual([]);
  });
});

describe('The build lifecycle', () => {
  it('checks for cargo and names a fix', async () => {
    const checks = await frameworkPlugin.checkEnvironment();
    expect(checks).toHaveLength(1);
    expect(checks[0].tool).toBe('cargo');
    expect(checks[0].required).toBe('>=1.75');
    // Whether cargo is installed is environment-dependent; what is pinned is
    // that the check exists and says how to fix a miss.
    expect(checks[0].fix).toMatch(/rustup/);
  });

  it('reports a failed build as a BuildResult rather than throwing', async () => {
    const result = await frameworkPlugin.buildProduction({}, { cwd: '/nonexistent-mfe', outputDir: 'dist' });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('registerCodegen', () => {
  afterEach(() => unregisterFileContributor('rust'));

  it('registers the rust file contributor', () => {
    unregisterFileContributor('rust');
    expect(findFileContributor('rust')).toBeUndefined();
    frameworkPlugin.registerCodegen();
    expect(findFileContributor('rust')).toBeDefined();
  });

  it('is idempotent', () => {
    frameworkPlugin.registerCodegen();
    frameworkPlugin.registerCodegen();
    expect(findFileContributor('rust')).toBeDefined();
  });
});

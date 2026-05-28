/**
 * BaseFrameworkPlugin — type-level contract tests (ADR-036)
 *
 * Verify the abstract class shape compiles correctly and that
 * concrete implementations satisfy the contract.
 */

import {
  BaseFrameworkPlugin,
  type EnvCheckResult,
  type SharedDep,
  type DockerStrategy,
  type BuildResult,
  type BuildError,
  type DevServerHandle,
} from '../framework-plugin';

/** Minimal concrete implementation for compile-time verification. */
class TestPlugin extends BaseFrameworkPlugin {
  readonly id = 'test-bundler';
  readonly displayName = 'Test Framework';
  readonly framework = 'test';
  readonly bundler = 'bundler';
  readonly defaultPort = 9999;
  readonly directoryStructure = ['src', 'public'];

  getRuntimeDependencies(): Record<string, string> {
    return { 'test-lib': '^1.0.0' };
  }

  getTemplateDir(): string {
    return '/templates/test';
  }

  getTemplateVars(): Record<string, unknown> {
    return { testVar: true };
  }

  getRuntimeImport(): string {
    return '@test/runtime';
  }

  getRuntimeClassName(): string {
    return 'TestMFE';
  }

  getSourceExtension(): string {
    return '.ts';
  }

  getTestExtension(): string {
    return '.test.ts';
  }

  getSharedDependencies(): SharedDep[] {
    return [{ name: 'test-lib', singleton: true, requiredVersion: '^1.0.0' }];
  }

  async checkEnvironment(): Promise<EnvCheckResult[]> {
    return [{ tool: 'node', required: '>=18', found: '20.0.0', ok: true }];
  }

  async startDevServer(): Promise<DevServerHandle> {
    return { stop: async () => {}, url: 'http://localhost:9999' };
  }

  async buildProduction(): Promise<BuildResult> {
    return { success: true, artifacts: ['dist/'], duration_ms: 100, warnings: [], errors: [] };
  }

  getDockerStrategy(): DockerStrategy {
    return {
      builderImage: 'node:20-slim',
      runtimeImage: 'nginx:alpine',
      buildCommands: ['npm ci', 'npm run build'],
      artifactPaths: ['dist/'],
      cmd: ['nginx', '-g', 'daemon off;'],
      needsCliBuilder: false,
    };
  }
}

describe('BaseFrameworkPlugin', () => {
  let plugin: TestPlugin;

  beforeEach(() => {
    plugin = new TestPlugin();
  });

  it('is an instance of BaseFrameworkPlugin', () => {
    expect(plugin).toBeInstanceOf(BaseFrameworkPlugin);
  });

  it('exposes identity properties', () => {
    expect(plugin.id).toBe('test-bundler');
    expect(plugin.displayName).toBe('Test Framework');
    expect(plugin.framework).toBe('test');
    expect(plugin.bundler).toBe('bundler');
  });

  it('exposes scaffold properties', () => {
    expect(plugin.defaultPort).toBe(9999);
    expect(plugin.directoryStructure).toEqual(['src', 'public']);
  });

  it('returns runtime dependencies', () => {
    expect(plugin.getRuntimeDependencies()).toEqual({ 'test-lib': '^1.0.0' });
  });

  it('returns template directory', () => {
    expect(plugin.getTemplateDir()).toBe('/templates/test');
  });

  it('returns template variables', () => {
    expect(plugin.getTemplateVars()).toEqual({ testVar: true });
  });

  it('returns runtime import and class name', () => {
    expect(plugin.getRuntimeImport()).toBe('@test/runtime');
    expect(plugin.getRuntimeClassName()).toBe('TestMFE');
  });

  it('returns file extensions', () => {
    expect(plugin.getSourceExtension()).toBe('.ts');
    expect(plugin.getTestExtension()).toBe('.test.ts');
  });

  it('returns shared dependencies', () => {
    const deps = plugin.getSharedDependencies();
    expect(deps).toHaveLength(1);
    expect(deps[0]).toEqual({
      name: 'test-lib',
      singleton: true,
      requiredVersion: '^1.0.0',
    });
  });

  it('checks environment', async () => {
    const checks = await plugin.checkEnvironment();
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ tool: 'node', ok: true });
  });

  it('starts dev server', async () => {
    const handle = await plugin.startDevServer(
      {} as never,
      { port: 9999, cwd: '/tmp' },
    );
    expect(handle.url).toBe('http://localhost:9999');
    expect(typeof handle.stop).toBe('function');
  });

  it('runs production build', async () => {
    const result = await plugin.buildProduction(
      {} as never,
      { cwd: '/tmp', outputDir: '/tmp/dist' },
    );
    expect(result.success).toBe(true);
    expect(result.artifacts).toContain('dist/');
  });

  it('returns docker strategy', () => {
    const strategy = plugin.getDockerStrategy({} as never);
    expect(strategy.builderImage).toBe('node:20-slim');
    expect(strategy.runtimeImage).toBe('nginx:alpine');
    expect(strategy.needsCliBuilder).toBe(false);
  });
});

describe('BuildError interface', () => {
  it('accepts all error categories', () => {
    const categories: BuildError['category'][] = [
      'syntax', 'type', 'dependency', 'config', 'runtime', 'unknown',
    ];
    for (const category of categories) {
      const err: BuildError = { message: 'test', category };
      expect(err.category).toBe(category);
    }
  });

  it('accepts optional fields', () => {
    const err: BuildError = {
      file: 'src/app.ts',
      line: 10,
      column: 5,
      message: 'Type error',
      category: 'type',
      suggestion: 'Fix the type',
    };
    expect(err.file).toBe('src/app.ts');
    expect(err.suggestion).toBe('Fix the type');
  });
});

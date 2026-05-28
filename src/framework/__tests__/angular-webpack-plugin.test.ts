/**
 * AngularWebpackPlugin — concrete plugin tests (ADR-036, #171).
 */

import { BaseFrameworkPlugin } from '@seans-mfe/contracts';
import { AngularWebpackPlugin } from '@seans-mfe/framework-angular';

describe('AngularWebpackPlugin', () => {
  const plugin = new AngularWebpackPlugin();

  it('extends BaseFrameworkPlugin', () => {
    expect(plugin).toBeInstanceOf(BaseFrameworkPlugin);
  });

  describe('identity', () => {
    it('has correct id', () => expect(plugin.id).toBe('angular-webpack'));
    it('has correct displayName', () => expect(plugin.displayName).toBe('Angular + webpack'));
    it('has correct framework', () => expect(plugin.framework).toBe('angular'));
    it('has correct bundler', () => expect(plugin.bundler).toBe('webpack'));
  });

  describe('scaffold', () => {
    it('defaults to port 3101', () => expect(plugin.defaultPort).toBe(3101));

    it('defines directory structure with src/app', () => {
      expect(plugin.directoryStructure).toContain('src/app');
      expect(plugin.directoryStructure).toContain('src/features');
    });

    it('returns Angular runtime dependencies', () => {
      const deps = plugin.getRuntimeDependencies();
      expect(deps).toHaveProperty('@angular/core');
      expect(deps).toHaveProperty('@angular/common');
      expect(deps).toHaveProperty('rxjs');
      expect(deps).toHaveProperty(['zone.js']);
    });
  });

  describe('codegen', () => {
    it('returns a template directory containing base-mfe-angular', () => {
      expect(plugin.getTemplateDir()).toMatch(/templates\/base-mfe-angular$/);
    });

    it('returns angular template variables', () => {
      const vars = plugin.getTemplateVars({});
      expect(vars.framework).toBe('angular');
      expect(vars.bundler).toBe('webpack');
    });

    it('returns AngularRemoteMFE runtime class', () => {
      expect(plugin.getRuntimeImport()).toBe('@seans-mfe-tool/runtime/angular');
      expect(plugin.getRuntimeClassName()).toBe('AngularRemoteMFE');
    });

    it('uses .ts source extension and .spec.ts test extension', () => {
      expect(plugin.getSourceExtension()).toBe('.ts');
      expect(plugin.getTestExtension()).toBe('.spec.ts');
    });

    it('returns Angular shared deps with strictVersion', () => {
      const deps = plugin.getSharedDependencies({});
      expect(deps.length).toBeGreaterThanOrEqual(4);

      const coreDep = deps.find(d => d.name === '@angular/core');
      expect(coreDep).toBeDefined();
      expect(coreDep!.singleton).toBe(true);
      expect(coreDep!.strictVersion).toBe(true);

      const zoneDep = deps.find(d => d.name === 'zone.js');
      expect(zoneDep).toBeDefined();
      expect(zoneDep!.eager).toBe(true);
    });
  });

  describe('environment', () => {
    it('checks node, npm, and ng', async () => {
      const checks = await plugin.checkEnvironment();
      expect(checks.length).toBe(3);
      const tools = checks.map(c => c.tool);
      expect(tools).toContain('node');
      expect(tools).toContain('npm');
      expect(tools).toContain('ng');
    });

    it('node check passes in this environment', async () => {
      const checks = await plugin.checkEnvironment();
      const nodeCheck = checks.find(c => c.tool === 'node');
      expect(nodeCheck!.ok).toBe(true);
    });
  });

  describe('docker', () => {
    it('returns cli-builder strategy', () => {
      const strategy = plugin.getDockerStrategy({});
      expect(strategy.runtimeImage).toBe('nginx:alpine');
      expect(strategy.needsCliBuilder).toBe(true);
      expect(strategy.buildCommands).toContain('npm ci');
    });
  });
});

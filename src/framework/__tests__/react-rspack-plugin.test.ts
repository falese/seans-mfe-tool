/**
 * ReactRspackPlugin — concrete plugin tests (ADR-036, #170).
 */

import { BaseFrameworkPlugin } from '@seans-mfe/contracts';
import { ReactRspackPlugin } from '@seans-mfe/framework-react';

describe('ReactRspackPlugin', () => {
  const plugin = new ReactRspackPlugin();

  it('extends BaseFrameworkPlugin', () => {
    expect(plugin).toBeInstanceOf(BaseFrameworkPlugin);
  });

  describe('identity', () => {
    it('has correct id', () => expect(plugin.id).toBe('react-rspack'));
    it('has correct displayName', () => expect(plugin.displayName).toBe('React + rspack'));
    it('has correct framework', () => expect(plugin.framework).toBe('react'));
    it('has correct bundler', () => expect(plugin.bundler).toBe('rspack'));
  });

  describe('scaffold', () => {
    it('defaults to port 3001', () => expect(plugin.defaultPort).toBe(3001));

    it('defines directory structure', () => {
      expect(plugin.directoryStructure).toEqual(['src', 'src/features', 'public']);
    });

    it('returns React runtime dependencies', () => {
      const deps = plugin.getRuntimeDependencies();
      expect(deps).toHaveProperty('react');
      expect(deps).toHaveProperty('react-dom');
    });
  });

  describe('codegen', () => {
    it('returns a template directory containing base-mfe', () => {
      expect(plugin.getTemplateDir()).toMatch(/templates\/base-mfe$/);
    });

    it('returns react template variables', () => {
      const vars = plugin.getTemplateVars({});
      expect(vars.framework).toBe('react');
      expect(vars.bundler).toBe('rspack');
    });

    it('returns RemoteMFE runtime class', () => {
      expect(plugin.getRuntimeImport()).toBe('@seans-mfe-tool/runtime');
      expect(plugin.getRuntimeClassName()).toBe('RemoteMFE');
    });

    it('uses .tsx source extension', () => {
      expect(plugin.getSourceExtension()).toBe('.tsx');
      expect(plugin.getTestExtension()).toBe('.test.tsx');
    });

    it('returns React shared deps as singletons', () => {
      const deps = plugin.getSharedDependencies({});
      expect(deps.length).toBeGreaterThanOrEqual(2);
      const reactDep = deps.find(d => d.name === 'react');
      expect(reactDep).toBeDefined();
      expect(reactDep!.singleton).toBe(true);
      expect(reactDep!.eager).toBe(true);
    });
  });

  describe('environment', () => {
    it('checks node, npm, and rspack', async () => {
      const checks = await plugin.checkEnvironment();
      expect(checks.length).toBe(3);
      const tools = checks.map(c => c.tool);
      expect(tools).toContain('node');
      expect(tools).toContain('npm');
      expect(tools).toContain('rspack');
    });

    it('node check passes in this environment', async () => {
      const checks = await plugin.checkEnvironment();
      const nodeCheck = checks.find(c => c.tool === 'node');
      expect(nodeCheck!.ok).toBe(true);
      expect(nodeCheck!.found).not.toBeNull();
    });
  });

  describe('docker', () => {
    it('returns a hardened, non-root nginx strategy', () => {
      const strategy = plugin.getDockerStrategy({});
      expect(strategy.runtimeImage).toBe('nginxinc/nginx-unprivileged:alpine');
      expect(strategy.needsCliBuilder).toBe(true);
      expect(strategy.buildCommands).toContain('npm ci');
      expect(strategy.expose).toBe(8080);
      expect(strategy.healthcheck).toContain('/health');
      expect(strategy.configFiles?.[0]).toMatchObject({
        from: 'cli-builder',
        dest: '/etc/nginx/conf.d/default.conf',
      });
    });
  });
});

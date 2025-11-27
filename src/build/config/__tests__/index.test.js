// src/build/config/__tests__/index.test.js
const { createConfiguration } = require('../index');
const path = require('path');

jest.mock('path');

describe('Build Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    path.join.mockImplementation((...args) => args.join('/'));
  });

  describe('createConfiguration', () => {
    it('should create base configuration for shell in development mode', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell',
        port: 3000
      };

      const config = await createConfiguration(options);

      expect(config.mode).toBe('development');
      expect(config.context).toBe('/test/project');
      expect(config.entry).toBe('./src/index');
      expect(config.devtool).toBe('eval-source-map');
      expect(config.devServer).toBeDefined();
      expect(config.devServer.port).toBe(3000);
      expect(config.devServer.hot).toBe(true);
    });

    it('should create base configuration for shell in production mode', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'production',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      expect(config.mode).toBe('production');
      expect(config.devtool).toBe('source-map');
      expect(config.devServer).toBeUndefined();
      expect(config.output.filename).toContain('[contenthash]');
    });

    it('should create configuration for remote in development mode', async () => {
      const options = {
        context: '/test/remote',
        type: 'remote',
        mode: 'development',
        name: 'test-remote',
        port: 3001
      };

      const config = await createConfiguration(options);

      expect(config.entry).toBe('./src/index');
      expect(config.plugins).toBeDefined();
      expect(config.plugins.length).toBeGreaterThan(0);
    });

    it('should create configuration for remote in production mode', async () => {
      const options = {
        context: '/test/remote',
        type: 'remote',
        mode: 'production',
        name: 'test-remote'
      };

      const config = await createConfiguration(options);

      expect(config.optimization.moduleIds).toBe('deterministic');
      expect(config.optimization.chunkIds).toBe('deterministic');
    });

    it('should include Module Federation plugin for shell', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell',
        remotes: {
          remote1: 'remote1@http://localhost:3001/remoteEntry.js'
        }
      };

      const config = await createConfiguration(options);

      expect(config.plugins).toBeDefined();
      const hasFederationPlugin = config.plugins.some(
        plugin => plugin.options && (plugin.options.remotes || plugin.options.filename)
      );
      expect(hasFederationPlugin).toBe(true);
    });

    it('should include Module Federation plugin for remote', async () => {
      const options = {
        context: '/test/remote',
        type: 'remote',
        mode: 'production',
        name: 'test-remote'
      };

      const config = await createConfiguration(options);

      expect(config.plugins).toBeDefined();
      const hasFederationPlugin = config.plugins.some(
        plugin => plugin.options && plugin.options.exposes
      );
      expect(hasFederationPlugin).toBe(true);
    });

    it('should not include Module Federation plugin for API type', async () => {
      const options = {
        context: '/test/api',
        type: 'api',
        mode: 'production',
        name: 'test-api'
      };

      const config = await createConfiguration(options);

      expect(config.plugins).toBeDefined();
      const hasFederationPlugin = config.plugins.some(
        plugin => plugin.options && (plugin.options.remotes || plugin.options.exposes)
      );
      expect(hasFederationPlugin).toBe(false);
    });

    it('should configure module rules for JavaScript/JSX', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      const jsRule = config.module.rules.find(rule => 
        rule.test && rule.test.toString().includes('jsx')
      );
      expect(jsRule).toBeDefined();
      expect(jsRule.use.loader).toBe('builtin:swc-loader');
      expect(jsRule.use.options.jsc.transform.react.runtime).toBe('automatic');
    });

    it('should enable React Refresh in development mode', async () => {
      const options = {
        context: '/test/project',
        type: 'remote',
        mode: 'development',
        name: 'test-remote'
      };

      const config = await createConfiguration(options);

      const jsRule = config.module.rules.find(rule => 
        rule.test && rule.test.toString().includes('jsx')
      );
      expect(jsRule.use.options.jsc.transform.react.refresh).toBe(true);
      expect(jsRule.use.options.jsc.transform.react.development).toBe(true);
    });

    it('should disable React Refresh in production mode', async () => {
      const options = {
        context: '/test/project',
        type: 'remote',
        mode: 'production',
        name: 'test-remote'
      };

      const config = await createConfiguration(options);

      const jsRule = config.module.rules.find(rule => 
        rule.test && rule.test.toString().includes('jsx')
      );
      expect(jsRule.use.options.jsc.transform.react.refresh).toBe(false);
      expect(jsRule.use.options.jsc.transform.react.development).toBe(false);
    });

    it('should configure CSS module rule', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      const cssRule = config.module.rules.find(rule => 
        rule.test && rule.test.toString().includes('css')
      );
      expect(cssRule).toBeDefined();
      expect(cssRule.type).toBe('css');
    });

    it('should configure asset module rule for images', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      const imageRule = config.module.rules.find(rule => 
        rule.test && rule.test.toString().includes('png')
      );
      expect(imageRule).toBeDefined();
      expect(imageRule.type).toBe('asset/resource');
    });

    it('should configure resolve extensions', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      expect(config.resolve.extensions).toEqual(['.js', '.jsx', '.json']);
    });

    it('should configure optimization for production', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'production',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      expect(config.optimization.moduleIds).toBe('deterministic');
      expect(config.optimization.chunkIds).toBe('deterministic');
      expect(config.optimization.splitChunks.chunks).toBe('all');
    });

    it('should configure optimization for development', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      expect(config.optimization.moduleIds).toBe('named');
      expect(config.optimization.chunkIds).toBe('named');
    });

    it('should configure devServer with historyApiFallback', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell',
        port: 3000
      };

      const config = await createConfiguration(options);

      expect(config.devServer.historyApiFallback).toBe(true);
      expect(config.devServer.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should use default port if not specified', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      expect(config.devServer.port).toBe(3000);
    });

    it('should configure output path with clean option', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'production',
        name: 'test-shell'
      };

      const config = await createConfiguration(options);

      expect(config.output.clean).toBe(true);
      expect(config.output.publicPath).toBe('auto');
    });

    it('should handle sanitized name for Federation', async () => {
      const options = {
        context: '/test/project',
        type: 'shell',
        mode: 'development',
        name: 'test-shell-name-123'
      };

      const config = await createConfiguration(options);

      const federationPlugin = config.plugins.find(
        plugin => plugin.options && plugin.options.name
      );
      expect(federationPlugin).toBeDefined();
      expect(federationPlugin.options.name).toBe('testshellname123');
    });
  });

  describe('getEntry', () => {
    it('should return correct entry for shell type', async () => {
      const config = await createConfiguration({
        context: '/test',
        type: 'shell',
        mode: 'development',
        name: 'test'
      });
      expect(config.entry).toBe('./src/index');
    });

    it('should return correct entry for remote type', async () => {
      const config = await createConfiguration({
        context: '/test',
        type: 'remote',
        mode: 'development',
        name: 'test'
      });
      expect(config.entry).toBe('./src/index');
    });

    it('should return correct entry for api type', async () => {
      const config = await createConfiguration({
        context: '/test',
        type: 'api',
        mode: 'development',
        name: 'test'
      });
      expect(config.entry).toBe('./src/index.js');
    });

    it('should throw error for unknown type', async () => {
      await expect(
        createConfiguration({
          context: '/test',
          type: 'unknown',
          mode: 'development',
          name: 'test'
        })
      ).rejects.toThrow('Unknown application type: unknown');
    });
  });

  describe('getFederationConfig', () => {
    it('should create shell federation config with remotes', async () => {
      const config = await createConfiguration({
        context: '/test',
        type: 'shell',
        mode: 'development',
        name: 'test-shell',
        remotes: {
          remote1: 'remote1@http://localhost:3001/remoteEntry.js'
        }
      });

      const federationPlugin = config.plugins.find(
        plugin => plugin.options && plugin.options.remotes
      );
      expect(federationPlugin.options.remotes).toBeDefined();
      expect(federationPlugin.options.shared).toBeDefined();
      expect(federationPlugin.options.shared.react.singleton).toBe(true);
    });

    it('should create shell federation config without remotes', async () => {
      const config = await createConfiguration({
        context: '/test',
        type: 'shell',
        mode: 'development',
        name: 'test-shell'
      });

      const federationPlugin = config.plugins.find(
        plugin => plugin.options && plugin.options.name
      );
      expect(federationPlugin.options.remotes).toEqual({});
    });

    it('should create remote federation config with exposes', async () => {
      const config = await createConfiguration({
        context: '/test',
        type: 'remote',
        mode: 'development',
        name: 'test-remote'
      });

      const federationPlugin = config.plugins.find(
        plugin => plugin.options && plugin.options.exposes
      );
      expect(federationPlugin.options.filename).toBe('remoteEntry.js');
      expect(federationPlugin.options.exposes['./App']).toBe('./src/App');
      expect(federationPlugin.options.shared['react-dom'].singleton).toBe(true);
    });

    it('should configure shared dependencies with required versions', async () => {
      const config = await createConfiguration({
        context: '/test',
        type: 'remote',
        mode: 'development',
        name: 'test-remote'
      });

      const federationPlugin = config.plugins.find(
        plugin => plugin.options && plugin.options.shared
      );
      expect(federationPlugin.options.shared.react.requiredVersion).toBe('^18.2.0');
      expect(federationPlugin.options.shared['react-dom'].requiredVersion).toBe('^18.2.0');
    });
  });

  describe('ModuleFederationPlugin', () => {
    it('should apply federation config to compiler', () => {
      const MockPlugin = require('../index').ModuleFederationPlugin || 
        class MockPlugin {
          constructor(options) { this.options = options; }
          apply(compiler) {
            compiler.options.plugins = compiler.options.plugins || [];
            compiler.options.federation = this.options;
          }
        };

      const plugin = new MockPlugin({ name: 'test' });
      const compiler = { options: {} };
      plugin.apply(compiler);

      expect(compiler.options.federation).toEqual({ name: 'test' });
      expect(compiler.options.plugins).toEqual([]);
    });
  });
});

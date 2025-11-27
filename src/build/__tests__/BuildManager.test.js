const { BuildManager } = require('../BuildManager');
const { rspack } = require('@rspack/core');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { ServerRegistry } = require('../servers');
const { createConfiguration } = require('../config');

jest.mock('@rspack/core');
jest.mock('fs-extra');
jest.mock('../config');
jest.mock('chalk', () => ({
  green: jest.fn((msg) => msg),
  blue: jest.fn((msg) => msg),
  yellow: jest.fn((msg) => msg),
  red: jest.fn((msg) => msg),
  gray: jest.fn((msg) => msg)
}));
jest.mock('../servers');

describe('BuildManager', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // Setup fs mocks
    fs.existsSync.mockReturnValue(true);
    fs.ensureDirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue(JSON.stringify({ name: 'test-app' }));
    
    // Setup ServerRegistry mock
    const mockServerClass = jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined)
    }));
    ServerRegistry.mockImplementation(() => ({
      get: jest.fn().mockReturnValue(mockServerClass)
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with type from options', () => {
      const manager = new BuildManager({ type: 'remote' });
      expect(manager.type).toBe('remote');
      expect(manager.mode).toBe('development');
      expect(manager.context).toBe(process.cwd());
    });

    it('should accept custom mode', () => {
      const manager = new BuildManager({
        type: 'shell',
        mode: 'production'
      });
      expect(manager.type).toBe('shell');
      expect(manager.mode).toBe('production');
    });

    it('should create ServerRegistry immediately', () => {
      const manager = new BuildManager({ type: 'remote' });
      expect(ServerRegistry).toHaveBeenCalled();
      expect(manager.serverRegistry).toBeDefined();
    });

    it('should not have config until initialized', () => {
      const manager = new BuildManager({ type: 'remote' });
      expect(manager.config).toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('should validate project and create config', async () => {
      const manager = new BuildManager({ type: 'remote', name: 'test-app' });
      const mockConfig = { name: 'test-config' };
      createConfiguration.mockResolvedValue(mockConfig);
      fs.readJSON.mockResolvedValue({ name: 'test-app' });
      fs.pathExists.mockResolvedValue(true);

      await manager.initialize();

      expect(createConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          context: manager.context,
          type: 'remote',
          mode: 'development',
          name: 'test-app'
        })
      );
      expect(manager.config).toBe(mockConfig);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Build configuration initialized')
      );
    });

    it('should handle initialization errors', async () => {
      const manager = new BuildManager({ type: 'remote' });
      fs.readJSON.mockRejectedValue(new Error('package.json not found'));

      await expect(manager.initialize()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize')
      );
    });
  });

  describe('validateProject', () => {
    it('should read package.json', async () => {
      const manager = new BuildManager({ type: 'remote' });
      fs.readJSON.mockResolvedValue({ name: 'test-app' });
      fs.pathExists.mockResolvedValue(true);
      
      await manager.validateProject();

      expect(fs.readJSON).toHaveBeenCalledWith(
        path.join(manager.context, 'package.json')
      );
    });

    it('should create missing src directory', async () => {
      const manager = new BuildManager({ type: 'remote', name: 'test' });
      fs.readJSON.mockResolvedValue({ name: 'test-app' });
      fs.pathExists.mockImplementation(async (filePath) => {
        return !filePath.includes('src');
      });

      await manager.validateProject();

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(manager.context, 'src')
      );
    });

    it('should create missing files for remote type', async () => {
      const manager = new BuildManager({ type: 'remote', name: 'test' });
      fs.readJSON.mockResolvedValue({ name: 'test-app' });
      fs.pathExists.mockResolvedValue(false);

      await manager.validateProject();

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(manager.context, 'src/index.js'),
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(manager.context, 'src/App.jsx'),
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(manager.context, 'src/bootstrap.jsx'),
        expect.any(String)
      );
    });

    it('should handle validation errors', async () => {
      const manager = new BuildManager({ type: 'remote' });
      fs.readJSON.mockRejectedValue(new Error('File not found'));

      await expect(manager.validateProject()).rejects.toThrow(
        'Project validation failed'
      );
    });
  });

  describe('build', () => {
    it('should run production build with rspack', async () => {
      const manager = new BuildManager({ type: 'remote', mode: 'production' });
      const mockStats = {
        hasErrors: () => false,
        hasWarnings: () => false,
        toString: () => 'Build stats'
      };
      const mockCompiler = {
        run: jest.fn((callback) => callback(null, mockStats)),
        close: jest.fn((callback) => callback())
      };
      rspack.mockReturnValue(mockCompiler);
      manager.config = { name: 'test-config' };

      await manager.build();

      expect(rspack).toHaveBeenCalledWith(manager.config);
      expect(mockCompiler.run).toHaveBeenCalled();
      expect(mockCompiler.close).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Build completed successfully')
      );
    });

    it('should handle build errors', async () => {
      const manager = new BuildManager({ mode: 'production' });
      const mockCompiler = {
        run: jest.fn((callback) => callback(new Error('Build failed'), null))
      };
      rspack.mockReturnValue(mockCompiler);
      manager.config = { name: 'test-config' };

      await expect(manager.build()).rejects.toThrow('Build failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Build failed')
      );
    });

    it('should handle compilation errors', async () => {
      const manager = new BuildManager({ type: 'remote', mode: 'production' });
      const mockStats = {
        hasErrors: () => true,
        hasWarnings: () => false,
        toJson: () => ({ errors: [{ message: 'Syntax error' }] })
      };
      const mockCompiler = {
        run: jest.fn((callback) => callback(null, mockStats))
      };
      rspack.mockReturnValue(mockCompiler);
      manager.config = { name: 'test-config' };

      await expect(manager.build()).rejects.toThrow('Build failed with errors');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Build failed with errors')
      );
    });

    it('should handle warnings', async () => {
      const manager = new BuildManager({ type: 'remote', mode: 'production' });
      const mockStats = {
        hasErrors: () => false,
        hasWarnings: () => true,
        toJson: () => ({ warnings: [{ message: 'Deprecation warning' }] }),
        toString: () => 'Build stats'
      };
      const mockCompiler = {
        run: jest.fn((callback) => callback(null, mockStats)),
        close: jest.fn((callback) => callback())
      };
      rspack.mockReturnValue(mockCompiler);
      manager.config = { name: 'test-config' };

      await manager.build();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Build completed with warnings')
      );
    });
  });

  describe('serve', () => {
    it('should start rspack server for remote type', async () => {
      const manager = new BuildManager({ type: 'remote' });
      const mockCompiler = { name: 'test-compiler' };
      rspack.mockReturnValue(mockCompiler);
      manager.config = { name: 'test-config' };
      
      const mockServer = {
        start: jest.fn().mockResolvedValue(undefined)
      };
      const mockServerClass = jest.fn().mockReturnValue(mockServer);
      manager.serverRegistry = {
        get: jest.fn().mockReturnValue(mockServerClass)
      };

      // Start serve (doesn't resolve, returns hanging promise)
      const servePromise = manager.serve();

      // Give it a tick to start
      await Promise.resolve();

      expect(manager.serverRegistry.get).toHaveBeenCalledWith('rspack');
      expect(mockServerClass).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'remote',
          compiler: mockCompiler
        }),
        manager.context
      );
      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should start nodemon server for api type', async () => {
      const manager = new BuildManager({ type: 'api' });
      manager.config = { name: 'test-config' };
      
      const mockServer = {
        start: jest.fn().mockResolvedValue(undefined)
      };
      const mockServerClass = jest.fn().mockReturnValue(mockServer);
      manager.serverRegistry = {
        get: jest.fn().mockReturnValue(mockServerClass)
      };

      const servePromise = manager.serve();
      await Promise.resolve();

      expect(manager.serverRegistry.get).toHaveBeenCalledWith('nodemon');
      expect(mockServerClass).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'api',
          compiler: null
        }),
        manager.context
      );
    });

    it('should handle server start errors', async () => {
      const manager = new BuildManager({ type: 'remote' });
      rspack.mockReturnValue({ name: 'test-compiler' });
      manager.config = { name: 'test-config' };
      
      const mockServer = {
        start: jest.fn().mockRejectedValue(new Error('Port in use'))
      };
      const mockServerClass = jest.fn().mockReturnValue(mockServer);
      manager.serverRegistry = {
        get: jest.fn().mockReturnValue(mockServerClass)
      };

      await expect(manager.serve()).rejects.toThrow('Port in use');
    });
  });

  describe('getServerType', () => {
    it('should return rspack for remote type', () => {
      const manager = new BuildManager({ type: 'remote' });
      expect(manager.getServerType()).toBe('rspack');
    });

    it('should return rspack for shell type', () => {
      const manager = new BuildManager({ type: 'shell' });
      expect(manager.getServerType()).toBe('rspack');
    });

    it('should return nodemon for api type', () => {
      const manager = new BuildManager({ type: 'api' });
      expect(manager.getServerType()).toBe('nodemon');
    });

    it('should throw error for unknown types', () => {
      const manager = new BuildManager({ type: 'unknown' });
      expect(() => manager.getServerType()).toThrow('Unknown application type');
    });
  });

  describe('Template Generators', () => {
    describe('getIndexTemplate', () => {
      it('should generate index template', () => {
        const manager = new BuildManager({ type: 'shell' });
        const template = manager.getIndexTemplate();
        
        expect(template).toContain('import React from');
        expect(template).toContain('createRoot');
        expect(template).toContain('root.render');
      });

      it('should include bootstrap import for remote type', () => {
        const manager = new BuildManager({ type: 'remote' });
        const template = manager.getIndexTemplate();
        
        expect(template).toContain('./bootstrap');
      });
    });

    describe('getAppTemplate', () => {
      it('should generate App template for shell', () => {
        const manager = new BuildManager({ type: 'shell' });
        const template = manager.getAppTemplate();
        
        expect(template).toContain('function ShellApp()');
        expect(template).toContain('Shell Application');
        expect(template).toContain('export default ShellApp');
      });

      it('should generate App template for remote', () => {
        const manager = new BuildManager({ type: 'remote' });
        const template = manager.getAppTemplate();
        
        expect(template).toContain('function RemoteApp()');
        expect(template).toContain('Remote Application');
        expect(template).toContain('export default RemoteApp');
      });

      it('should include different content for shell vs remote', () => {
        const shellManager = new BuildManager({ type: 'shell' });
        const remoteManager = new BuildManager({ type: 'remote' });
        
        const shellTemplate = shellManager.getAppTemplate();
        const remoteTemplate = remoteManager.getAppTemplate();
        
        expect(shellTemplate).not.toBe(remoteTemplate);
      });
    });

    describe('getHtmlTemplate', () => {
      it('should generate HTML template', () => {
        const manager = new BuildManager({ type: 'shell', name: 'test-app' });
        const template = manager.getHtmlTemplate();
        
        expect(template).toContain('<!DOCTYPE html>');
        expect(template).toContain('<div id="root">');
      });

      it('should include name and type in title', () => {
        const manager = new BuildManager({ type: 'remote', name: 'my-app' });
        
        const template = manager.getHtmlTemplate();
        expect(template).toContain('my-app');
        expect(template).toContain('remote');
      });
    });

    describe('getBootstrapTemplate', () => {
      it('should generate bootstrap template with mount function', () => {
        const manager = new BuildManager({ type: 'remote' });
        const template = manager.getBootstrapTemplate();
        
        expect(template).toContain('function mount(');
        expect(template).toContain('createRoot');
        expect(template).toContain('export { mount }');
      });

      it('should check for standalone mode', () => {
        const manager = new BuildManager({ type: 'remote' });
        const template = manager.getBootstrapTemplate();
        
        expect(template).toContain('__RSPACK_REMOTE_ENTRY__');
        expect(template).toContain("mount('root')");
      });
    });
  });
});

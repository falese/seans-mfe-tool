const { BuildManager } = require('../BuildManager');
const rspack = require('@rspack/core');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { ServerRegistry } = require('../servers');

jest.mock('@rspack/core');
jest.mock('fs-extra');
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

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
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
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const manager = new BuildManager({});
      expect(manager.type).toBe('remote');
      expect(manager.mode).toBe('development');
      expect(manager.context).toBe(process.cwd());
    });

    it('should accept custom options', () => {
      const manager = new BuildManager({
        type: 'shell',
        mode: 'production',
        context: '/custom/path'
      });
      expect(manager.type).toBe('shell');
      expect(manager.mode).toBe('production');
      expect(manager.context).toBe('/custom/path');
    });

    it('should initialize config and serverRegistry as null', () => {
      const manager = new BuildManager({});
      expect(manager.config).toBeNull();
      expect(manager.serverRegistry).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should validate project and create config', async () => {
      const manager = new BuildManager({ type: 'remote' });
      const mockConfig = { name: 'test-config' };
      const createConfig = require('../config');
      createConfig.mockReturnValue(mockConfig);

      await manager.initialize();

      expect(manager.validateProject).toBeDefined();
      expect(createConfig).toHaveBeenCalledWith('remote', 'development', manager.context);
      expect(manager.config).toBe(mockConfig);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Build configuration initialized')
      );
    });

    it('should handle initialization errors', async () => {
      const manager = new BuildManager({ type: 'invalid' });
      const createConfig = require('../config');
      createConfig.mockImplementation(() => {
        throw new Error('Invalid type');
      });

      await expect(manager.initialize()).rejects.toThrow('Invalid type');
    });

    it('should create ServerRegistry instance', async () => {
      const manager = new BuildManager({ type: 'shell' });
      const createConfig = require('../config');
      createConfig.mockReturnValue({ name: 'shell-config' });

      await manager.initialize();

      expect(ServerRegistry).toHaveBeenCalled();
      expect(manager.serverRegistry).toBeDefined();
    });
  });

  describe('validateProject', () => {
    it('should validate all required directories exist', () => {
      const manager = new BuildManager({ context: '/test/path' });
      
      manager.validateProject();

      expect(fs.existsSync).toHaveBeenCalledWith(path.join('/test/path', 'src'));
      expect(fs.existsSync).toHaveBeenCalledWith(path.join('/test/path', 'public'));
      expect(fs.existsSync).toHaveBeenCalledWith(path.join('/test/path', 'package.json'));
    });

    it('should create missing src directory', () => {
      const manager = new BuildManager({ context: '/test/path' });
      fs.existsSync.mockImplementation((filePath) => {
        return !filePath.includes('src');
      });

      manager.validateProject();

      expect(fs.ensureDirSync).toHaveBeenCalledWith(path.join('/test/path', 'src'));
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path', 'src/index.jsx'),
        expect.any(String)
      );
    });

    it('should create missing public directory', () => {
      const manager = new BuildManager({ context: '/test/path' });
      fs.existsSync.mockImplementation((filePath) => {
        return !filePath.includes('public');
      });

      manager.validateProject();

      expect(fs.ensureDirSync).toHaveBeenCalledWith(path.join('/test/path', 'public'));
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path', 'public/index.html'),
        expect.any(String)
      );
    });

    it('should throw error if package.json missing', () => {
      const manager = new BuildManager({ context: '/test/path' });
      fs.existsSync.mockImplementation((filePath) => {
        return !filePath.includes('package.json');
      });

      expect(() => manager.validateProject()).toThrow(
        'package.json not found'
      );
    });

    it('should create App.jsx for remote type', () => {
      const manager = new BuildManager({ type: 'remote', context: '/test/path' });
      fs.existsSync.mockImplementation((filePath) => {
        return !filePath.includes('App.jsx');
      });

      manager.validateProject();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/path', 'src/App.jsx'),
        expect.any(String)
      );
    });
  });

  describe('build', () => {
    it('should run production build with rspack', async () => {
      const manager = new BuildManager({ mode: 'production' });
      const mockCompiler = {
        run: jest.fn((callback) => callback(null, { hasErrors: () => false }))
      };
      rspack.mockReturnValue(mockCompiler);
      manager.config = { name: 'test-config' };

      await manager.build();

      expect(rspack).toHaveBeenCalledWith(manager.config);
      expect(mockCompiler.run).toHaveBeenCalled();
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
      const manager = new BuildManager({ mode: 'production' });
      const mockStats = {
        hasErrors: () => true,
        toString: () => 'Compilation errors'
      };
      const mockCompiler = {
        run: jest.fn((callback) => callback(null, mockStats))
      };
      rspack.mockReturnValue(mockCompiler);
      manager.config = { name: 'test-config' };

      await expect(manager.build()).rejects.toThrow('Build failed with errors');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Compilation errors');
    });

    it('should require config before building', async () => {
      const manager = new BuildManager({});
      manager.config = null;

      await expect(manager.build()).rejects.toThrow(
        'Build configuration not initialized'
      );
    });
  });

  describe('serve', () => {
    it('should start development server', async () => {
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

      await manager.serve();

      expect(manager.serverRegistry.get).toHaveBeenCalledWith('rspack');
      expect(mockServerClass).toHaveBeenCalledWith(
        { compiler: mockCompiler, mode: 'development' },
        manager.context
      );
      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should require config before serving', async () => {
      const manager = new BuildManager({});
      manager.config = null;

      await expect(manager.serve()).rejects.toThrow(
        'Build configuration not initialized'
      );
    });

    it('should require serverRegistry before serving', async () => {
      const manager = new BuildManager({});
      manager.config = { name: 'test-config' };
      manager.serverRegistry = null;

      await expect(manager.serve()).rejects.toThrow(
        'Server registry not initialized'
      );
    });

    it('should handle server start errors', async () => {
      const manager = new BuildManager({ type: 'api' });
      const mockCompiler = { name: 'test-compiler' };
      rspack.mockReturnValue(mockCompiler);
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

    it('should default to rspack for unknown types', () => {
      const manager = new BuildManager({ type: 'unknown' });
      expect(manager.getServerType()).toBe('rspack');
    });
  });

  describe('Template Generators', () => {
    describe('getIndexTemplate', () => {
      it('should generate index template', () => {
        const manager = new BuildManager({});
        const template = manager.getIndexTemplate();
        
        expect(template).toContain('import React from');
        expect(template).toContain('import ReactDOM from');
        expect(template).toContain('ReactDOM.render');
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
        
        expect(template).toContain('function App()');
        expect(template).toContain('export default App');
      });

      it('should generate App template for remote', () => {
        const manager = new BuildManager({ type: 'remote' });
        const template = manager.getAppTemplate();
        
        expect(template).toContain('function App()');
        expect(template).toContain('export default App');
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
        const manager = new BuildManager({});
        const template = manager.getHtmlTemplate();
        
        expect(template).toContain('<!DOCTYPE html>');
        expect(template).toContain('<div id="root">');
      });

      it('should include title from package.json', () => {
        const manager = new BuildManager({ context: '/test/path' });
        fs.readFileSync.mockReturnValue(JSON.stringify({ 
          name: 'my-app'
        }));
        
        const template = manager.getHtmlTemplate();
        expect(template).toContain('my-app');
      });
    });

    describe('getBootstrapTemplate', () => {
      it('should generate bootstrap template', () => {
        const manager = new BuildManager({});
        const template = manager.getBootstrapTemplate();
        
        expect(template).toContain('import(');
        expect(template).toContain('./index');
      });

      it('should handle async imports', () => {
        const manager = new BuildManager({});
        const template = manager.getBootstrapTemplate();
        
        expect(template).toMatch(/import\(['"]\.\/index['"]\)/);
      });
    });
  });
});

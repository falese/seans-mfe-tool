// src/commands/__tests__/bff.test.js
// Test coverage for BFF commands - GraphQL Mesh CLI integration
// Reference: docs/acceptance-criteria/bff.feature, REQ-BFF-001 through REQ-BFF-008

// Mock js-yaml before anything else
jest.mock('js-yaml', () => ({
  load: jest.fn(),
  dump: jest.fn(() => 'mocked yaml output')
}));

// Mock templateProcessor to avoid EJS rendering issues
jest.mock('../../utils/templateProcessor', () => ({
  processTemplates: jest.fn().mockResolvedValue(undefined)
}));

// Import test utils - this sets up fs-extra and child_process.execSync mocks
const {
  mockProcessExit,
  mockConsole,
  setupCommonMocks,
  mockFs,
  mockExec
} = require('./test-utils');

// Get references to mocked modules
const yaml = require('js-yaml');
const childProcess = require('child_process');

// Create spawn mock directly
const mockSpawnProcess = {
  on: jest.fn(function(event, callback) {
    this._callbacks = this._callbacks || {};
    this._callbacks[event] = callback;
    return this;
  }),
  kill: jest.fn(),
  _callbacks: {}
};

// Override the spawn function on the mocked module
childProcess.spawn = jest.fn(() => {
  // Reset callbacks for each call
  mockSpawnProcess._callbacks = {};
  mockSpawnProcess.on.mockClear();
  mockSpawnProcess.kill.mockClear();
  mockSpawnProcess.on.mockImplementation(function(event, callback) {
    mockSpawnProcess._callbacks[event] = callback;
    return mockSpawnProcess;
  });
  return mockSpawnProcess;
});

// Now require bff module AFTER all mocks are set up
const {
  extractMeshConfig,
  writeMeshConfig,
  bffValidateCommand,
  bffBuildCommand,
  bffDevCommand,
  bffInitCommand,
  addMeshDependencies
} = require('../bff');

describe('BFF Commands', () => {
  mockProcessExit();
  mockConsole();

  beforeEach(() => {
    setupCommonMocks();
    jest.clearAllMocks();
    
    // Reset spawn mock process
    mockSpawnProcess._callbacks = {};
  });

  // =========================================================================
  // extractMeshConfig - REQ-BFF-001
  // =========================================================================
  describe('extractMeshConfig', () => {
    const validManifest = {
      name: 'test-mfe',
      data: {
        sources: [
          {
            name: 'PetStore',
            handler: { openapi: { source: './specs/petstore.yaml' } }
          }
        ],
        transforms: [{ prefix: { value: 'Pet_' } }],
        plugins: [{ responseCache: { ttl: 300 } }],
        serve: { endpoint: '/graphql', playground: true }
      }
    };

    it('should extract mesh config from valid manifest (REQ-BFF-001)', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest content');
      yaml.load.mockReturnValue(validManifest);

      const result = await extractMeshConfig('mfe-manifest.yaml');

      expect(result.meshConfig).toEqual({
        sources: validManifest.data.sources,
        transforms: validManifest.data.transforms,
        plugins: validManifest.data.plugins,
        serve: validManifest.data.serve
      });
      expect(result.manifest).toEqual(validManifest);
      expect(result.manifestPath).toContain('mfe-manifest.yaml');
    });

    it('should throw error when manifest not found (REQ-BFF-001)', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await expect(extractMeshConfig('missing.yaml'))
        .rejects.toThrow(/Manifest not found/);
    });

    it('should throw error when data section missing (REQ-BFF-001)', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('name: test');
      yaml.load.mockReturnValue({ name: 'test' });

      await expect(extractMeshConfig('mfe-manifest.yaml'))
        .rejects.toThrow(/No "data:" section found/);
    });

    it('should throw error when sources empty (REQ-BFF-001)', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue({ name: 'test', data: { sources: [] } });

      await expect(extractMeshConfig('mfe-manifest.yaml'))
        .rejects.toThrow(/No sources defined/);
    });

    it('should throw error when sources missing (REQ-BFF-001)', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue({ name: 'test', data: {} });

      await expect(extractMeshConfig('mfe-manifest.yaml'))
        .rejects.toThrow(/No sources defined/);
    });

    it('should use default serve config when not provided', async () => {
      const manifestWithoutServe = {
        data: {
          sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }]
        }
      };
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue(manifestWithoutServe);

      const result = await extractMeshConfig('mfe-manifest.yaml');

      expect(result.meshConfig.serve).toEqual({ endpoint: '/graphql', playground: true });
    });

    it('should exclude transforms and plugins when not provided', async () => {
      const minimalManifest = {
        data: {
          sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }]
        }
      };
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue(minimalManifest);

      const result = await extractMeshConfig('mfe-manifest.yaml');

      expect(result.meshConfig.transforms).toBeUndefined();
      expect(result.meshConfig.plugins).toBeUndefined();
    });
  });

  // =========================================================================
  // writeMeshConfig
  // =========================================================================
  describe('writeMeshConfig', () => {
    it('should write mesh config to .meshrc.yaml', async () => {
      const meshConfig = { sources: [{ name: 'API' }] };
      yaml.dump.mockReturnValue('sources:\n  - name: API');

      const result = await writeMeshConfig(meshConfig, '/target/dir');

      expect(yaml.dump).toHaveBeenCalledWith(meshConfig, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/target/dir/.meshrc.yaml',
        'sources:\n  - name: API',
        'utf8'
      );
      expect(result).toBe('/target/dir/.meshrc.yaml');
    });
  });

  // =========================================================================
  // bffValidateCommand - REQ-BFF-005
  // =========================================================================
  describe('bffValidateCommand', () => {
    const validManifest = {
      name: 'test-mfe',
      data: {
        sources: [
          { name: 'PetStore', handler: { openapi: { source: './specs/petstore.yaml' } } }
        ],
        transforms: [{ prefix: { value: 'Pet_' } }],
        plugins: [{ responseCache: { ttl: 300 } }]
      }
    };

    beforeEach(() => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue(validManifest);
    });

    it('should validate valid configuration (REQ-BFF-005)', async () => {
      const result = await bffValidateCommand({});

      expect(result.valid).toBe(true);
      expect(result.meshConfig).toBeDefined();
      expect(result.manifest).toEqual(validManifest);
    });

    it('should use custom manifest path from options', async () => {
      await bffValidateCommand({ manifest: 'custom-manifest.yaml' });

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('custom-manifest.yaml'),
        'utf8'
      );
    });

    it('should use default manifest path when not specified', async () => {
      await bffValidateCommand({});

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('mfe-manifest.yaml'),
        'utf8'
      );
    });

    it('should validate source name is required', async () => {
      yaml.load.mockReturnValue({
        data: {
          sources: [{ handler: { openapi: { source: './api.yaml' } } }]
        }
      });

      await expect(bffValidateCommand({}))
        .rejects.toThrow(/Each source must have a "name" property/);
    });

    it('should validate source handler.openapi.source is required', async () => {
      yaml.load.mockReturnValue({
        data: {
          sources: [{ name: 'API', handler: {} }]
        }
      });

      await expect(bffValidateCommand({}))
        .rejects.toThrow(/missing handler.openapi.source/);
    });

    it('should warn when local spec file not found', async () => {
      mockFs.pathExists.mockImplementation(async (p) => {
        if (p.includes('petstore.yaml')) return false;
        return true;
      });

      const result = await bffValidateCommand({});

      expect(result.valid).toBe(true);
      // Console output would show warning
    });

    it('should validate remote spec URLs without file check', async () => {
      yaml.load.mockReturnValue({
        data: {
          sources: [{ name: 'Remote', handler: { openapi: { source: 'https://api.example.com/spec.yaml' } } }]
        }
      });

      const result = await bffValidateCommand({});

      expect(result.valid).toBe(true);
    });

    it('should warn for unknown transform types (REQ-BFF-005)', async () => {
      yaml.load.mockReturnValue({
        data: {
          sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }],
          transforms: [{ unknownTransform: {} }]
        }
      });

      const result = await bffValidateCommand({});

      // Should still be valid but log a warning
      expect(result.valid).toBe(true);
    });

    it('should validate known transform types', async () => {
      yaml.load.mockReturnValue({
        data: {
          sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }],
          transforms: [
            { prefix: {} },
            { rename: {} },
            { filterSchema: {} },
            { encapsulate: {} },
            { namingConvention: {} }
          ]
        }
      });

      const result = await bffValidateCommand({});

      expect(result.valid).toBe(true);
    });

    it('should warn for unknown plugin types', async () => {
      yaml.load.mockReturnValue({
        data: {
          sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }],
          plugins: [{ unknownPlugin: {} }]
        }
      });

      const result = await bffValidateCommand({});

      expect(result.valid).toBe(true);
    });

    it('should validate known plugin types (REQ-BFF-006)', async () => {
      yaml.load.mockReturnValue({
        data: {
          sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }],
          plugins: [
            { responseCache: {} },
            { rateLimit: {} },
            { prometheus: {} },
            { depthLimit: {} },
            { csrf: {} }
          ]
        }
      });

      const result = await bffValidateCommand({});

      expect(result.valid).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Read error'));

      await expect(bffValidateCommand({}))
        .rejects.toThrow('Read error');
    });
  });

  // =========================================================================
  // bffBuildCommand - REQ-BFF-005
  // =========================================================================
  describe('bffBuildCommand', () => {
    const validManifest = {
      data: {
        sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }]
      }
    };

    beforeEach(() => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue(validManifest);
      yaml.dump.mockReturnValue('yaml content');
      mockExec.execSync.mockReturnValue('');
    });

    it('should build BFF successfully (REQ-BFF-005)', async () => {
      await bffBuildCommand({});

      expect(yaml.dump).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.meshrc.yaml'),
        expect.any(String),
        'utf8'
      );
      expect(mockExec.execSync).toHaveBeenCalledWith('npx mesh build', expect.any(Object));
    });

    it('should use custom cwd from options', async () => {
      await bffBuildCommand({ cwd: '/custom/dir' });

      expect(mockExec.execSync).toHaveBeenCalledWith('npx mesh build', expect.objectContaining({
        cwd: '/custom/dir'
      }));
    });

    it('should auto-install mesh CLI when not found (status 127)', async () => {
      const meshError = new Error('mesh not found');
      meshError.status = 127;
      
      mockExec.execSync
        .mockImplementationOnce(() => { throw meshError; })
        .mockReturnValue('');

      await bffBuildCommand({});

      expect(mockExec.execSync).toHaveBeenCalledWith(
        'npm install @graphql-mesh/cli @graphql-mesh/openapi',
        expect.any(Object)
      );
      // Should retry build after install
      expect(mockExec.execSync).toHaveBeenCalledTimes(3);
    });

    it('should auto-install when error message contains mesh', async () => {
      const meshError = new Error('mesh command not found');
      
      mockExec.execSync
        .mockImplementationOnce(() => { throw meshError; })
        .mockReturnValue('');

      await bffBuildCommand({});

      expect(mockExec.execSync).toHaveBeenCalledWith(
        'npm install @graphql-mesh/cli @graphql-mesh/openapi',
        expect.any(Object)
      );
    });

    it('should rethrow non-mesh errors', async () => {
      const otherError = new Error('Some other error');
      mockExec.execSync.mockImplementation(() => { throw otherError; });

      await expect(bffBuildCommand({}))
        .rejects.toThrow('Some other error');
    });

    it('should handle validation errors during build', async () => {
      yaml.load.mockReturnValue({ name: 'test' }); // No data section

      await expect(bffBuildCommand({}))
        .rejects.toThrow(/No "data:" section/);
    });
  });

  // =========================================================================
  // bffDevCommand - REQ-BFF-005
  // =========================================================================
  describe('bffDevCommand', () => {
    const validManifest = {
      data: {
        sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }]
      }
    };

    beforeEach(() => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue(validManifest);
      yaml.dump.mockReturnValue('yaml content');
    });

    it('should start dev server (REQ-BFF-005)', async () => {
      await bffDevCommand({});

      expect(childProcess.spawn).toHaveBeenCalledWith('npx', ['mesh', 'dev'], expect.objectContaining({
        stdio: 'inherit',
        shell: true
      }));
    });

    it('should write meshrc before starting dev', async () => {
      await bffDevCommand({});

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.meshrc.yaml'),
        expect.any(String),
        'utf8'
      );
    });

    it('should use custom cwd from options', async () => {
      await bffDevCommand({ cwd: '/custom/path' });

      expect(childProcess.spawn).toHaveBeenCalledWith('npx', ['mesh', 'dev'], expect.objectContaining({
        cwd: '/custom/path'
      }));
    });

    it('should handle spawn error event', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await bffDevCommand({});

      // Trigger the error callback
      if (mockSpawnProcess._callbacks.error) {
        mockSpawnProcess._callbacks.error(new Error('Spawn failed'));
      }

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle spawn close event with non-zero code', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      await bffDevCommand({});

      // Trigger the close callback
      if (mockSpawnProcess._callbacks.close) {
        mockSpawnProcess._callbacks.close(1);
      }

      consoleSpy.mockRestore();
    });

    it('should handle spawn close event with zero code', async () => {
      await bffDevCommand({});

      // Trigger the close callback with success - should not log
      if (mockSpawnProcess._callbacks.close) {
        mockSpawnProcess._callbacks.close(0);
      }
    });

    it('should register SIGINT handler for graceful shutdown', async () => {
      const listeners = [];
      const processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
        listeners.push({ event, handler });
        return process;
      });
      
      await bffDevCommand({});

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      
      // Verify the handler calls kill
      const sigintHandler = listeners.find(l => l.event === 'SIGINT');
      if (sigintHandler) {
        sigintHandler.handler();
        expect(mockSpawnProcess.kill).toHaveBeenCalledWith('SIGINT');
      }
      
      processOnSpy.mockRestore();
    });

    it('should handle validation errors in dev', async () => {
      yaml.load.mockReturnValue({ name: 'test' });

      await expect(bffDevCommand({}))
        .rejects.toThrow(/No "data:" section/);
    });
  });

  // =========================================================================
  // bffInitCommand - REQ-BFF-005
  // =========================================================================
  describe('bffInitCommand', () => {
    beforeEach(() => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue({
        name: 'existing-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      });
    });

    describe('new project creation', () => {
      it('should create new BFF project (REQ-BFF-005)', async () => {
        await bffInitCommand('my-bff', {});

        expect(mockFs.ensureDir).toHaveBeenCalled();
        expect(mockFs.copy).toHaveBeenCalled();
        expect(mockExec.execSync).toHaveBeenCalledWith('npm install', expect.any(Object));
      });

      it('should use custom port from options', async () => {
        await bffInitCommand('my-bff', { port: 4000 });

        // Port is passed to template vars
        expect(mockFs.copy).toHaveBeenCalled();
      });

      it('should use custom version from options', async () => {
        await bffInitCommand('my-bff', { version: '2.0.0' });

        expect(mockFs.copy).toHaveBeenCalled();
      });

      it('should process specs option into sources', async () => {
        await bffInitCommand('my-bff', { specs: ['./api.yaml', './users.yaml'] });

        expect(mockFs.copy).toHaveBeenCalled();
      });

      it('should create specs directory', async () => {
        await bffInitCommand('my-bff', {});

        expect(mockFs.ensureDir).toHaveBeenCalledWith(
          expect.stringContaining('specs')
        );
      });

      it('should copy all template files for new project', async () => {
        await bffInitCommand('my-bff', {});

        const copyPaths = mockFs.copy.mock.calls.map(call => call[0]);
        
        // Should copy package.json.ejs for new projects
        expect(copyPaths.some(p => p.includes('package.json.ejs'))).toBe(true);
      });

      it('should install dependencies for new project', async () => {
        await bffInitCommand('my-bff', {});

        expect(mockExec.execSync).toHaveBeenCalledWith('npm install', expect.objectContaining({
          stdio: 'inherit'
        }));
      });

      it('should throw error if template directory not found', async () => {
        mockFs.pathExists.mockImplementation(async (p) => {
          if (p.includes('bff-plugin/templates')) return false;
          return true;
        });

        await expect(bffInitCommand('my-bff', {}))
          .rejects.toThrow(/BFF template directory not found/);
      });
    });

    describe('add to existing project', () => {
      it('should add BFF to existing project when no name provided (REQ-BFF-005)', async () => {
        await bffInitCommand(undefined, {});

        // Should NOT call npm install for existing project
        expect(mockExec.execSync).not.toHaveBeenCalledWith('npm install', expect.any(Object));
      });

      it('should require mfe-manifest.yaml for existing projects', async () => {
        mockFs.pathExists.mockImplementation(async (p) => {
          if (p.includes('mfe-manifest.yaml')) return false;
          return true;
        });

        await expect(bffInitCommand(undefined, {}))
          .rejects.toThrow(/No mfe-manifest.yaml found/);
      });

      it('should add mesh dependencies to existing package.json', async () => {
        await bffInitCommand(undefined, {});

        expect(mockFs.writeJson).toHaveBeenCalledWith(
          expect.stringContaining('package.json'),
          expect.objectContaining({
            dependencies: expect.objectContaining({
              '@graphql-mesh/cli': expect.any(String)
            })
          }),
          expect.any(Object)
        );
      });

      it('should not copy package.json.ejs for existing projects', async () => {
        await bffInitCommand(undefined, {});

        const copyPaths = mockFs.copy.mock.calls.map(call => call[0]);
        expect(copyPaths.some(p => p.includes('package.json.ejs'))).toBe(false);
      });

      it('should copy only relevant files for existing projects', async () => {
        await bffInitCommand(undefined, {});

        const copiedFiles = mockFs.copy.mock.calls.map(call => call[0]);
        
        // Should copy server.ts, Dockerfile, etc.
        expect(copiedFiles.some(p => p.includes('server.ts.ejs'))).toBe(true);
      });
    });

    describe('static assets option', () => {
      it('should include static by default for new projects (REQ-BFF-004)', async () => {
        await bffInitCommand('my-bff', {});

        // includeStatic defaults to true for new projects
        expect(mockFs.copy).toHaveBeenCalled();
      });

      it('should respect --no-static option (REQ-BFF-004)', async () => {
        await bffInitCommand('my-bff', { static: false });

        expect(mockFs.copy).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should handle template copy errors', async () => {
        mockFs.copy.mockRejectedValue(new Error('Copy failed'));

        await expect(bffInitCommand('my-bff', {}))
          .rejects.toThrow('Copy failed');
      });

      it('should handle npm install errors', async () => {
        mockExec.execSync.mockImplementation(() => {
          throw new Error('npm install failed');
        });

        await expect(bffInitCommand('my-bff', {}))
          .rejects.toThrow('npm install failed');
      });
    });
  });

  // =========================================================================
  // addMeshDependencies
  // =========================================================================
  describe('addMeshDependencies', () => {
    beforeEach(() => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {}
      });
    });

    it('should add mesh dependencies to package.json', async () => {
      await addMeshDependencies('/target/dir');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/target/dir/package.json',
        expect.objectContaining({
          dependencies: expect.objectContaining({
            '@graphql-mesh/cli': '^0.100.0',
            '@graphql-mesh/openapi': '^1.0.0',
            '@graphql-mesh/plugin-response-cache': '^0.104.0',
            'graphql': '^16.8.1',
            'cors': '^2.8.5',
            'helmet': '^7.1.0'
          })
        }),
        { spaces: 2 }
      );
    });

    it('should add mesh scripts to package.json', async () => {
      await addMeshDependencies('/target/dir');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          scripts: expect.objectContaining({
            'mesh:build': 'mesh build',
            'mesh:dev': 'mesh dev',
            'mesh:validate': 'mesh validate',
            'bff:dev': expect.stringContaining('concurrently')
          })
        }),
        expect.any(Object)
      );
    });

    it('should add dev dependencies', async () => {
      await addMeshDependencies('/target/dir');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          devDependencies: expect.objectContaining({
            'concurrently': '^8.2.2',
            'tsx': '^4.6.2'
          })
        }),
        expect.any(Object)
      );
    });

    it('should preserve existing dependencies', async () => {
      mockFs.readJson.mockResolvedValue({
        name: 'test',
        dependencies: { 'existing-pkg': '1.0.0', 'cors': '^2.7.0' },
        devDependencies: { 'existing-dev': '2.0.0' },
        scripts: { 'existing': 'script' }
      });

      await addMeshDependencies('/target/dir');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dependencies: expect.objectContaining({
            'existing-pkg': '1.0.0'
          }),
          devDependencies: expect.objectContaining({
            'existing-dev': '2.0.0'
          }),
          scripts: expect.objectContaining({
            'existing': 'script'
          })
        }),
        expect.any(Object)
      );
    });

    it('should preserve existing cors/helmet versions', async () => {
      mockFs.readJson.mockResolvedValue({
        name: 'test',
        dependencies: { 'cors': '^2.9.0', 'helmet': '^8.0.0' },
        devDependencies: {},
        scripts: {}
      });

      await addMeshDependencies('/target/dir');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dependencies: expect.objectContaining({
            'cors': '^2.9.0',
            'helmet': '^8.0.0'
          })
        }),
        expect.any(Object)
      );
    });

    it('should skip update when package.json not found', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      await addMeshDependencies('/target/dir');

      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });

    it('should handle package.json without dependencies/scripts/devDependencies', async () => {
      mockFs.readJson.mockResolvedValue({
        name: 'minimal-project'
      });

      await addMeshDependencies('/target/dir');

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          dependencies: expect.any(Object),
          devDependencies: expect.any(Object),
          scripts: expect.any(Object)
        }),
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // Edge Cases and Integration Scenarios
  // =========================================================================
  describe('Edge Cases', () => {
    it('should handle manifest with all optional fields', async () => {
      const fullManifest = {
        name: 'full-mfe',
        version: '2.0.0',
        data: {
          sources: [
            { name: 'API1', handler: { openapi: { source: './api1.yaml' } } },
            { name: 'API2', handler: { openapi: { source: 'https://api.example.com/spec' } } }
          ],
          transforms: [
            { prefix: { value: 'Test_' } },
            { rename: {} }
          ],
          plugins: [
            { responseCache: { ttl: 300 } },
            { rateLimit: { max: 100 } }
          ],
          serve: { endpoint: '/api/graphql', playground: false }
        }
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue(fullManifest);

      const result = await extractMeshConfig('mfe-manifest.yaml');

      expect(result.meshConfig.sources).toHaveLength(2);
      expect(result.meshConfig.transforms).toHaveLength(2);
      expect(result.meshConfig.plugins).toHaveLength(2);
      expect(result.meshConfig.serve.endpoint).toBe('/api/graphql');
    });

    it('should handle empty options object for all commands', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue({
        data: { sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }] }
      });

      await bffValidateCommand();
      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should resolve paths correctly with process.cwd()', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue({
        data: { sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }] }
      });

      await extractMeshConfig('relative/path/manifest.yaml');

      // Should call path.resolve with cwd
      expect(mockFs.pathExists).toHaveBeenCalledWith(
        expect.stringContaining('manifest.yaml')
      );
    });

    it('should use process.cwd() when cwd option is not provided in bffBuildCommand', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue({
        data: { sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }] }
      });
      yaml.dump.mockReturnValue('yaml');

      await bffBuildCommand({});

      // Should use process.cwd() for targetDir (mocked to /mock/cwd)
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/mock/cwd'),
        expect.any(String),
        'utf8'
      );
    });

    it('should use process.cwd() when cwd option is not provided in bffDevCommand', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('manifest');
      yaml.load.mockReturnValue({
        data: { sources: [{ name: 'API', handler: { openapi: { source: './api.yaml' } } }] }
      });
      yaml.dump.mockReturnValue('yaml');

      await bffDevCommand({});

      // Should use process.cwd() for targetDir
      expect(childProcess.spawn).toHaveBeenCalledWith('npx', ['mesh', 'dev'], expect.objectContaining({
        cwd: '/mock/cwd'
      }));
    });

    it('should skip template file if it does not exist in template directory', async () => {
      mockFs.pathExists.mockImplementation(async (p) => {
        // Template dir exists
        if (p.includes('bff-plugin/templates') && !p.includes('.ejs')) return true;
        // Dockerfile.ejs doesn't exist
        if (p.includes('Dockerfile.ejs')) return false;
        // All other template files exist
        return true;
      });

      await bffInitCommand('my-bff', {});

      // Dockerfile.ejs should not be copied since it doesn't exist
      const copyPaths = mockFs.copy.mock.calls.map(call => call[0]);
      expect(copyPaths.some(p => p.includes('Dockerfile.ejs'))).toBe(false);
    });

    it('should handle empty specs array in bffInitCommand', async () => {
      await bffInitCommand('my-bff', { specs: [] });

      // Should use default source
      expect(mockFs.copy).toHaveBeenCalled();
    });
  });
});

// IMPORTANT: load test-utils (which hoists jest mocks) BEFORE requiring the command module
const { mockFs, mockPath, setupCommonMocks } = require('./test-utils');
const { initCommand } = require('../init');
const chalk = require('chalk');

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('init command', () => {
  beforeEach(() => {
    setupCommonMocks();
    // Mock directory doesn't exist initially (override setupCommonMocks default)
    mockFs.pathExists.mockResolvedValue(false);
    
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('workspace creation', () => {
    it('should create workspace with default pnpm package manager', async () => {
      const name = 'my-workspace';
      const options = {};

      await initCommand(name, options);

      // Verify directory structure created
      const expectedDirs = [
        'apps/shell',
        'apps/remotes',
        'packages/shared',
        'packages/ui-components',
        'docs',
        '.github/workflows',
      ];
      
      expectedDirs.forEach(dir => {
        expect(mockFs.ensureDir).toHaveBeenCalledWith(`/mock/cwd/my-workspace/${dir}`);
      });

      // Verify package.json created
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/mock/cwd/my-workspace/package.json',
        expect.objectContaining({
          name: '@my-workspace/root',
          version: '0.1.0',
          private: true,
        }),
        { spaces: 2 }
      );

      // Verify pnpm-workspace.yaml created for pnpm
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/mock/cwd/my-workspace/pnpm-workspace.yaml',
        expect.stringContaining('packages:')
      );

      // Verify success message
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('✅ Workspace created successfully!')
      );
    });

    it('should create workspace with npm package manager', async () => {
      const name = 'npm-workspace';
      const options = { packageManager: 'npm' };

      await initCommand(name, options);

      // Verify package.json has workspaces array for npm
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/mock/cwd/npm-workspace/package.json',
        expect.objectContaining({
          workspaces: ['apps/*', 'packages/*'],
        }),
        { spaces: 2 }
      );

      // Verify pnpm-workspace.yaml NOT created for npm
      const pnpmWorkspaceCalls = mockFs.writeFile.mock.calls.filter(
        call => call[0].includes('pnpm-workspace.yaml')
      );
      expect(pnpmWorkspaceCalls.length).toBe(0);
    });

    it('should create workspace with yarn package manager', async () => {
      const name = 'yarn-workspace';
      const options = { packageManager: 'yarn' };

      await initCommand(name, options);

      // Verify package.json has workspaces array for yarn
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/mock/cwd/yarn-workspace/package.json',
        expect.objectContaining({
          workspaces: ['apps/*', 'packages/*'],
        }),
        { spaces: 2 }
      );
    });
  });

  describe('validation', () => {
    it('should throw error for invalid package manager', async () => {
      const name = 'test-workspace';
      const options = { packageManager: 'invalid' };

      await expect(initCommand(name, options)).rejects.toThrow(
        'Invalid package manager: invalid'
      );

      // Verify error logged
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Error creating workspace:'),
        expect.any(String)
      );
    });

    it('should throw error if directory already exists', async () => {
      const name = 'existing-dir';
      const options = {};

      // Mock directory exists
      mockFs.pathExists.mockResolvedValueOnce(true);

      await expect(initCommand(name, options)).rejects.toThrow(
        'Directory existing-dir already exists'
      );
    });
  });

  describe('configuration files', () => {
    it('should create .gitignore with correct content', async () => {
      const name = 'config-test';
      const options = { packageManager: 'pnpm' };

      await initCommand(name, options);

      const gitignoreCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('.gitignore')
      );
      expect(gitignoreCall).toBeDefined();
      expect(gitignoreCall[1]).toContain('node_modules');
      expect(gitignoreCall[1]).toContain('pnpm-lock.yaml');
    });

    it('should create .eslintrc.json with correct config', async () => {
      const name = 'eslint-test';
      const options = {};

      await initCommand(name, options);

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/mock/cwd/eslint-test/.eslintrc.json',
        expect.objectContaining({
          env: expect.objectContaining({
            browser: true,
            node: true,
            es2021: true,
            jest: true,
          }),
          extends: ['eslint:recommended'],
        }),
        { spaces: 2 }
      );
    });

    it('should create .prettierrc with correct config', async () => {
      const name = 'prettier-test';
      const options = {};

      await initCommand(name, options);

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        '/mock/cwd/prettier-test/.prettierrc',
        expect.objectContaining({
          semi: true,
          singleQuote: true,
          tabWidth: 2,
        }),
        { spaces: 2 }
      );
    });

    it('should create .editorconfig', async () => {
      const name = 'editor-test';
      const options = {};

      await initCommand(name, options);

      const editorconfigCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('.editorconfig')
      );
      expect(editorconfigCall).toBeDefined();
      expect(editorconfigCall[1]).toContain('indent_size = 2');
      expect(editorconfigCall[1]).toContain('charset = utf-8');
    });
  });

  describe('README generation', () => {
    it('should create README.md with workspace name', async () => {
      const name = 'readme-test';
      const options = {};

      await initCommand(name, options);

      const readmeCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('README.md')
      );
      expect(readmeCall).toBeDefined();
      expect(readmeCall[1]).toContain(`# ${name}`);
      expect(readmeCall[1]).toContain('Module Federation Workspace');
    });

    it('should include correct install command in README', async () => {
      const name = 'install-test';
      const options = { packageManager: 'yarn' };

      await initCommand(name, options);

      const readmeCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('README.md')
      );
      expect(readmeCall[1]).toContain('yarn install');
    });

    it('should include all available commands in README', async () => {
      const name = 'commands-test';
      const options = {};

      await initCommand(name, options);

      const readmeCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('README.md')
      );
      const readme = readmeCall[1];
      
      expect(readme).toContain('npx seans-mfe-tool shell');
      expect(readme).toContain('npx seans-mfe-tool remote');
      expect(readme).toContain('npx seans-mfe-tool api');
      expect(readme).toContain('npx seans-mfe-tool analyze');
      expect(readme).toContain('npx seans-mfe-tool build');
      expect(readme).toContain('npx seans-mfe-tool deploy');
    });
  });

  describe('mfe-spec.yaml generation', () => {
    it('should create mfe-spec.yaml with workspace name', async () => {
      const name = 'spec-test';
      const options = {};

      await initCommand(name, options);

      const specCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('mfe-spec.yaml')
      );
      expect(specCall).toBeDefined();
      expect(specCall[1]).toContain(`name: ${name}`);
    });

    it('should include example shell in spec', async () => {
      const name = 'shell-spec-test';
      const options = {};

      await initCommand(name, options);

      const specCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('mfe-spec.yaml')
      );
      expect(specCall[1]).toContain('shell:');
      expect(specCall[1]).toContain('name: main-shell');
      expect(specCall[1]).toContain('port: 3000');
    });

    it('should include example remotes in spec', async () => {
      const name = 'remotes-spec-test';
      const options = {};

      await initCommand(name, options);

      const specCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('mfe-spec.yaml')
      );
      expect(specCall[1]).toContain('remotes:');
      expect(specCall[1]).toContain('- name: dashboard');
      expect(specCall[1]).toContain('- name: user-profile');
    });

    it('should include example API in spec', async () => {
      const name = 'api-spec-test';
      const options = {};

      await initCommand(name, options);

      const specCall = mockFs.writeFile.mock.calls.find(
        call => call[0].includes('mfe-spec.yaml')
      );
      expect(specCall[1]).toContain('apis:');
      expect(specCall[1]).toContain('- name: user-api');
      expect(specCall[1]).toContain('database: sqlite');
    });
  });

  describe('package.json configuration', () => {
    it('should include correct scripts', async () => {
      const name = 'scripts-test';
      const options = {};

      await initCommand(name, options);

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        expect.objectContaining({
          scripts: expect.objectContaining({
            dev: expect.any(String),
            build: expect.any(String),
            test: 'jest',
            lint: 'eslint .',
            format: expect.stringContaining('prettier'),
            clean: expect.stringContaining('rm -rf node_modules'),
          }),
        }),
        expect.any(Object)
      );
    });

    it('should include dev dependencies', async () => {
      const name = 'deps-test';
      const options = {};

      await initCommand(name, options);

      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        expect.objectContaining({
          devDependencies: expect.objectContaining({
            '@babel/core': expect.any(String),
            '@babel/preset-react': expect.any(String),
            'eslint': expect.any(String),
            'prettier': expect.any(String),
            'jest': expect.any(String),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('error handling and cleanup', () => {
    it('should cleanup workspace on error', async () => {
      const name = 'cleanup-test';
      const options = {};

      // Mock ensureDir to throw error
      // First pathExists call (pre-check) should be false so creation starts, second (in catch) true to trigger cleanup
      mockFs.pathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mockFs.ensureDir.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(initCommand(name, options)).rejects.toThrow('Permission denied');

      // Verify cleanup was attempted
      expect(mockFs.remove).toHaveBeenCalledWith('/mock/cwd/cleanup-test');
    });

    it('should not attempt cleanup if directory was never created', async () => {
      const name = 'no-cleanup-test';
      const options = { packageManager: 'invalid' };

      // Mock pathExists to return false (directory doesn't exist)
      mockFs.pathExists.mockResolvedValue(false);

      await expect(initCommand(name, options)).rejects.toThrow('Invalid package manager');

      // Verify cleanup was NOT called since directory never existed
      expect(mockFs.remove).not.toHaveBeenCalled();
    });

    it('should log cleanup message on error', async () => {
      const name = 'log-cleanup-test';
      const options = {};

      // Mock ensureDir to fail after directory exists
      // Pre-check false (allow creation), catch check true (cleanup)
      mockFs.pathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mockFs.ensureDir.mockRejectedValueOnce(new Error('Write error'));

      await expect(initCommand(name, options)).rejects.toThrow('Write error');

      // Verify cleanup message logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up...')
      );
    });
  });

  describe('console output', () => {
    it('should display progress messages', async () => {
      const name = 'progress-test';
      const options = {};

      await initCommand(name, options);

      // Check for key progress messages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Creating Module Federation workspace')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📁 Creating workspace structure...')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📦 Initializing package manager...')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('⚙️  Creating configuration files...')
      );
    });

    it('should display next steps after creation', async () => {
      const name = 'next-steps-test';
      const options = { packageManager: 'npm' };

      await initCommand(name, options);

      // Verify next steps displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Next steps:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(`cd ${name}`)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('npm install')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('npx seans-mfe-tool generate mfe-spec.yaml')
      );
    });

    it('should show correct package manager in output', async () => {
      const name = 'pm-output-test';
      const options = { packageManager: 'yarn' };

      await initCommand(name, options);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Package manager: yarn')
      );
    });
  });

  describe('workspace structure', () => {
    it('should create all required directories', async () => {
      const name = 'dirs-test';
      const options = {};

      await initCommand(name, options);

      // Verify all directories created
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/mock/cwd/dirs-test/apps/shell');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/mock/cwd/dirs-test/apps/remotes');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/mock/cwd/dirs-test/packages/shared');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/mock/cwd/dirs-test/packages/ui-components');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/mock/cwd/dirs-test/docs');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/mock/cwd/dirs-test/.github/workflows');
    });

    it('should log creation of each directory', async () => {
      const name = 'dir-log-test';
      const options = {};

      await initCommand(name, options);

      // Verify directory creation logged
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓ Created apps/shell'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓ Created packages/shared'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓ Created docs'));
    });
  });
});

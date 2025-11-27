/**
 * remote:init Command Tests
 * Following TDD principles - testing REQ-REMOTE-002
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock dependencies before importing command
jest.mock('fs-extra');
jest.mock('child_process');

// Mock chalk to return the string as-is
jest.mock('chalk', () => ({
  blue: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  gray: (s: string) => s,
  cyan: (s: string) => s
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

// Mock path to return predictable values
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((...args: string[]) => args.filter(a => a).join('/')),
  join: jest.fn((...args: string[]) => args.filter(a => a).join('/'))
}));

// Console mock setup - will be configured in beforeEach
let mockConsole: { log: jest.SpyInstance; error: jest.SpyInstance };

// Import after mocks
import { remoteInitCommand } from '../remote-init';

describe('remote:init Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup console spies AFTER clearAllMocks
    mockConsole = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
    
    // Default mock implementations (cast through unknown to avoid TypeScript strictness)
    (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(false);
    (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
    (mockFs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
    mockExecSync.mockReturnValue(Buffer.from(''));
    
    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/test/workspace');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Project Creation', () => {
    it('should create directory structure', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      // Should create src, src/features, and public directories
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('my-feature/src')
      );
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('my-feature/src/features')
      );
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('my-feature/public')
      );
    });

    it('should create mfe-manifest.yaml', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mfe-manifest.yaml'),
        expect.stringContaining('name: my-feature'),
        expect.any(String)
      );
    });

    it('should create package.json with correct name', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      const packageJsonCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('package.json')
      );
      
      expect(packageJsonCall).toBeDefined();
      const content = JSON.parse(packageJsonCall![1] as string);
      expect(content.name).toBe('my-feature');
    });

    it('should create rspack.config.js with Module Federation', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      const rspackCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('rspack.config.js')
      );
      
      expect(rspackCall).toBeDefined();
      expect(rspackCall![1]).toContain('ModuleFederationPlugin');
    });

    it('should create tsconfig.json', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        expect.any(String)
      );
    });

    it('should create jest.config.js', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('jest.config.js'),
        expect.stringContaining('ts-jest')
      );
    });

    it('should create .gitignore', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.gitignore'),
        expect.stringContaining('node_modules')
      );
    });

    it('should create source files', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      // Check for key source files
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('index.html'),
        expect.any(String)
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('index.tsx'),
        expect.any(String)
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('App.tsx'),
        expect.any(String)
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('remote.tsx'),
        expect.any(String)
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('setupTests.ts'),
        expect.any(String)
      );
    });
  });

  describe('Port Configuration', () => {
    it('should use default port 3001', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      const rspackCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('rspack.config.js')
      );
      
      expect(rspackCall![1]).toContain('port: 3001');
    });

    it('should use custom port when specified', async () => {
      await remoteInitCommand('my-feature', { port: 3005, skipInstall: true });

      const rspackCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('rspack.config.js')
      );
      
      expect(rspackCall![1]).toContain('port: 3005');
    });

    it('should include port in manifest endpoints', async () => {
      await remoteInitCommand('my-feature', { port: 3005, skipInstall: true });

      const manifestCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('mfe-manifest.yaml')
      );
      
      expect(manifestCall![1]).toContain('3005');
    });
  });

  describe('Directory Exists Handling', () => {
    it('should throw error if directory exists without --force', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);

      await expect(remoteInitCommand('my-feature', { skipInstall: true }))
        .rejects.toThrow('Directory "my-feature" already exists');
    });

    it('should proceed if directory exists with --force', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(true);

      await expect(
        remoteInitCommand('my-feature', { force: true, skipInstall: true })
      ).resolves.not.toThrow();

      // Should still create files
      expect(mockFs.ensureDir).toHaveBeenCalled();
    });
  });

  describe('NPM Install', () => {
    it('should run npm install by default', async () => {
      await remoteInitCommand('my-feature');

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm install',
        expect.objectContaining({
          cwd: expect.stringContaining('my-feature'),
          stdio: 'inherit'
        })
      );
    });

    it('should skip npm install with --skip-install', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('Generated File Content', () => {
    it('should generate App.tsx with display name', async () => {
      await remoteInitCommand('user-profile', { skipInstall: true });

      const appCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('App.tsx')
      );
      
      // kebab-case should become Title Case
      expect(appCall![1]).toContain('User Profile');
    });

    it('should include MUI theme provider in index.tsx', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      const indexCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('index.tsx')
      );
      
      expect(indexCall![1]).toContain('ThemeProvider');
      expect(indexCall![1]).toContain('CssBaseline');
    });

    it('should include Module Federation mock in setupTests.ts', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      const setupCall = mockFs.writeFile.mock.calls.find(
        call => (call[0] as string).includes('setupTests.ts')
      );
      
      expect(setupCall![1]).toContain('@module-federation/runtime');
    });
  });

  describe('Error Handling', () => {
    it('should throw and log error on fs failure', async () => {
      (mockFs.ensureDir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(remoteInitCommand('my-feature', { skipInstall: true }))
        .rejects.toThrow('Permission denied');

      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should throw error on npm install failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('npm install failed');
      });

      await expect(remoteInitCommand('my-feature'))
        .rejects.toThrow('npm install failed');
    });
  });

  describe('Console Output', () => {
    it('should log creation messages', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating DSL-based remote MFE')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Remote MFE created successfully')
      );
    });

    it('should log next steps', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Next steps')
      );
    });
  });
});

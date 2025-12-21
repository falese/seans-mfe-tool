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
        expect.any(String),
        'utf8'
      );
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


  describe('Error Handling', () => {
    it('should throw and log error on fs failure', async () => {
      (mockFs.ensureDir as unknown as jest.Mock).mockRejectedValue(new Error('fs error'));
      await expect(remoteInitCommand('my-feature', { skipInstall: true })).rejects.toThrow('fs error');
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create remote MFE'));
    });
  });

  describe('Console Output', () => {
    it('should log creation messages', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Creating DSL-based remote MFE'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Remote MFE manifest created!'));
    });
    it('should log next steps', async () => {
      await remoteInitCommand('my-feature', { skipInstall: true });
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('cd my-feature'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Edit mfe-manifest.yaml'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('mfe remote:generate'));
    });
  });
});

/**
 * remote:generate Command Tests
 * Following TDD principles - testing REQ-REMOTE-003
 */

import * as fs from 'fs-extra';
import * as path from 'path';

// Mock dependencies before importing command
jest.mock('fs-extra');

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

// Mock path to return predictable values
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((...args: string[]) => args.filter(a => a).join('/')),
  join: jest.fn((...args: string[]) => args.filter(a => a).join('/')),
  relative: jest.fn((from: string, to: string) => to.replace(from + '/', ''))
}));

// Mock DSL modules
jest.mock('@seans-mfe-tool/dsl', () => ({
  parseAndValidateDirectory: jest.fn(),
  formatErrorsForCLI: jest.fn((errors) => errors.map((e: any) => e.message).join('\n'))
}));


jest.mock('@seans-mfe-tool/codegen', () => {
  const actual = jest.requireActual('@seans-mfe-tool/codegen');
  return {
    ...actual,
    generateAllFiles: jest.fn(),
    writeGeneratedFiles: jest.fn()
  };
});

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  success: jest.fn()
};

jest.mock('@seans-mfe-tool/logger', () => ({
  createLogger: jest.fn(() => mockLogger)
}));

// Console mock setup - will be configured in beforeEach
let mockConsole: { log: jest.SpyInstance; error: jest.SpyInstance };

// Import after mocks
import { remoteGenerateCommand } from '../remote-generate';
import { parseAndValidateDirectory, formatErrorsForCLI } from '@seans-mfe-tool/dsl';

import { generateAllFiles, writeGeneratedFiles } from '@seans-mfe-tool/codegen';

const mockParseAndValidate = parseAndValidateDirectory as jest.MockedFunction<typeof parseAndValidateDirectory>;
const mockGenerateAllFiles = generateAllFiles as jest.MockedFunction<typeof generateAllFiles>;
const mockWriteFiles = writeGeneratedFiles as jest.MockedFunction<typeof writeGeneratedFiles>;

describe('remote:generate Command', () => {
  const validManifest = {
    name: 'test-mfe',
    version: '1.0.0',
    type: 'remote' as const,
    language: 'typescript' as const,
    capabilities: [
      { UserProfile: { type: 'domain' as const } },
      { Dashboard: { type: 'domain' as const } }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear logger mocks
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.success.mockClear();

    // Setup console spies AFTER clearAllMocks
    mockConsole = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };

    // Default mock implementations
    mockParseAndValidate.mockResolvedValue({
      valid: true,
      manifest: validManifest as any,
      errors: []
    });

    mockGenerateAllFiles.mockResolvedValue([
      { path: '/test/src/features/UserProfile/UserProfile.tsx', content: 'code', overwrite: false },
      { path: '/test/src/remote.tsx', content: 'exports', overwrite: true }
    ]);

    mockWriteFiles.mockResolvedValue({
      files: [{ path: '/test/src/features/UserProfile/UserProfile.tsx', content: 'code', overwrite: false }],
      skipped: [],
      errors: []
    });
    
    // All capability/config generator mocks removed; unified generator used
    
    (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
    (mockFs.readFile as unknown as jest.Mock).mockResolvedValue('port: 3001');
    (mockFs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
    
    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/test');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Manifest Validation', () => {
    it('should read and validate mfe-manifest.yaml', async () => {
      await remoteGenerateCommand();

      expect(mockParseAndValidate).toHaveBeenCalledWith('/test');
    });

    it('should throw error on invalid manifest', async () => {
      mockParseAndValidate.mockResolvedValue({
        valid: false,
        errors: [{ path: 'version', message: 'Required' }]
      });

      await expect(remoteGenerateCommand()).rejects.toThrow('Manifest validation failed');
    });

    it('should log validation errors', async () => {
      mockParseAndValidate.mockResolvedValue({
        valid: false,
        errors: [{ path: 'version', message: 'Required' }]
      });

      try {
        await remoteGenerateCommand();
      } catch (e) {
        // Expected
      }

      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('File Generation', () => {
    it('should generate all files using unified generator', async () => {
      await remoteGenerateCommand();
      expect(mockGenerateAllFiles).toHaveBeenCalledWith(validManifest, '/test', expect.any(Object));
    });

    it('should write generated files', async () => {
      await remoteGenerateCommand();
      expect(mockWriteFiles).toHaveBeenCalled();
    });

    it('should pass force option to writeGeneratedFiles', async () => {
      await remoteGenerateCommand({ force: true });
      expect(mockWriteFiles).toHaveBeenCalledWith(
        expect.any(Array),
        { force: true }
      );
    });

    // rspack.config.js is now generated via EJS template in unified generator
  });

  describe('Dry Run Mode', () => {
    it('should not write files in dry run mode', async () => {
      await remoteGenerateCommand({ dryRun: true });

      expect(mockWriteFiles).not.toHaveBeenCalled();
    });

    it('should log what would be generated', async () => {
      await remoteGenerateCommand({ dryRun: true });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN]')
      );
    });
  });

  // New/Removed Capabilities logic is now handled in unified generator, console output removed

  describe('Generation Results', () => {
    it('should report generated files', async () => {
      mockWriteFiles.mockResolvedValue({
        files: [{ path: '/test/src/features/UserProfile.tsx', content: 'code', overwrite: false }],
        skipped: [],
        errors: []
      });

      await remoteGenerateCommand();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated files')
      );
    });

    it('should report skipped files', async () => {
      mockWriteFiles.mockResolvedValue({
        files: [],
        skipped: ['/test/src/features/UserProfile.tsx'],
        errors: []
      });

      await remoteGenerateCommand();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipped')
      );
    });

    it('should report errors', async () => {
      mockWriteFiles.mockResolvedValue({
        files: [],
        skipped: [],
        errors: ['Failed to write file']
      });

      await remoteGenerateCommand();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Errors')
      );
    });

    it('should show summary', async () => {
      await remoteGenerateCommand();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Summary')
      );
    });
  });

  // rspack.config.js missing logic is now handled by EJS template, no separate update

  describe('Error Handling', () => {
    it('should throw and log error on failure', async () => {
      mockParseAndValidate.mockRejectedValue(new Error('Parse failed'));

      await expect(remoteGenerateCommand()).rejects.toThrow('Parse failed');

      expect(mockConsole.error).toHaveBeenCalled();
    });
  });
});


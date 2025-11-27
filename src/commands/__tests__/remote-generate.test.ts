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
jest.mock('../../dsl', () => ({
  parseAndValidateDirectory: jest.fn(),
  formatErrorsForCLI: jest.fn((errors) => errors.map((e: any) => e.message).join('\n'))
}));

jest.mock('../../dsl/generator', () => ({
  generateAllCapabilityFiles: jest.fn(),
  writeGeneratedFiles: jest.fn(),
  getNewCapabilities: jest.fn(),
  getRemovedCapabilities: jest.fn(),
  generateRspackConfig: jest.fn(),
  generateCapabilityFiles: jest.fn()
}));

// Console mock setup - will be configured in beforeEach
let mockConsole: { log: jest.SpyInstance; error: jest.SpyInstance };

// Import after mocks
import { remoteGenerateCommand, remoteGenerateCapabilityCommand } from '../remote-generate';
import { parseAndValidateDirectory, formatErrorsForCLI } from '../../dsl';
import { 
  generateAllCapabilityFiles, 
  writeGeneratedFiles,
  getNewCapabilities,
  getRemovedCapabilities,
  generateRspackConfig,
  generateCapabilityFiles
} from '../../dsl/generator';

const mockParseAndValidate = parseAndValidateDirectory as jest.MockedFunction<typeof parseAndValidateDirectory>;
const mockGenerateAll = generateAllCapabilityFiles as jest.MockedFunction<typeof generateAllCapabilityFiles>;
const mockWriteFiles = writeGeneratedFiles as jest.MockedFunction<typeof writeGeneratedFiles>;
const mockGetNew = getNewCapabilities as jest.MockedFunction<typeof getNewCapabilities>;
const mockGetRemoved = getRemovedCapabilities as jest.MockedFunction<typeof getRemovedCapabilities>;
const mockGenerateRspack = generateRspackConfig as jest.MockedFunction<typeof generateRspackConfig>;
const mockGenerateCapability = generateCapabilityFiles as jest.MockedFunction<typeof generateCapabilityFiles>;

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
    
    mockGenerateAll.mockReturnValue([
      { path: '/test/src/features/UserProfile/UserProfile.tsx', content: 'code', overwrite: false },
      { path: '/test/src/remote.tsx', content: 'exports', overwrite: true }
    ]);
    
    mockWriteFiles.mockResolvedValue({
      files: [{ path: '/test/src/features/UserProfile/UserProfile.tsx', content: 'code', overwrite: false }],
      skipped: [],
      errors: []
    });
    
    mockGetNew.mockResolvedValue(['UserProfile']);
    mockGetRemoved.mockResolvedValue([]);
    mockGenerateRspack.mockReturnValue('rspack config');
    
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
    it('should generate capability files', async () => {
      await remoteGenerateCommand();

      expect(mockGenerateAll).toHaveBeenCalledWith(validManifest, '/test');
    });

    it('should write generated files', async () => {
      await remoteGenerateCommand();

      expect(mockWriteFiles).toHaveBeenCalledWith(
        expect.any(Array),
        { force: undefined }
      );
    });

    it('should pass force option to writeGeneratedFiles', async () => {
      await remoteGenerateCommand({ force: true });

      expect(mockWriteFiles).toHaveBeenCalledWith(
        expect.any(Array),
        { force: true }
      );
    });

    it('should update rspack.config.js', async () => {
      await remoteGenerateCommand();

      expect(mockGenerateRspack).toHaveBeenCalledWith(validManifest, 3001);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('rspack.config.js'),
        'rspack config',
        'utf8'
      );
    });

    it('should extract port from existing rspack config', async () => {
      (mockFs.readFile as unknown as jest.Mock).mockResolvedValue('port: 3005');

      await remoteGenerateCommand();

      expect(mockGenerateRspack).toHaveBeenCalledWith(validManifest, 3005);
    });
  });

  describe('Dry Run Mode', () => {
    it('should not write files in dry run mode', async () => {
      await remoteGenerateCommand({ dryRun: true });

      expect(mockWriteFiles).not.toHaveBeenCalled();
    });

    it('should log what would be generated', async () => {
      await remoteGenerateCommand({ dryRun: true });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN]')
      );
    });
  });

  describe('New/Removed Capabilities', () => {
    it('should detect new capabilities', async () => {
      mockGetNew.mockResolvedValue(['NewFeature']);

      await remoteGenerateCommand();

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('New capabilities to generate')
      );
    });

    it('should warn about removed capabilities', async () => {
      mockGetRemoved.mockResolvedValue(['OldFeature']);

      await remoteGenerateCommand();

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Capabilities removed from manifest')
      );
    });
  });

  describe('Generation Results', () => {
    it('should report generated files', async () => {
      mockWriteFiles.mockResolvedValue({
        files: [{ path: '/test/src/features/UserProfile.tsx', content: 'code', overwrite: false }],
        skipped: [],
        errors: []
      });

      await remoteGenerateCommand();

      expect(mockConsole.log).toHaveBeenCalledWith(
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

      expect(mockConsole.log).toHaveBeenCalledWith(
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

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Errors')
      );
    });

    it('should show summary', async () => {
      await remoteGenerateCommand();

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Summary')
      );
    });
  });

  describe('Missing rspack.config.js', () => {
    it('should skip rspack update if file not found', async () => {
      (mockFs.pathExists as jest.Mock).mockResolvedValue(false);

      await remoteGenerateCommand();

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('rspack.config.js not found')
      );
      expect(mockFs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('rspack.config.js'),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw and log error on failure', async () => {
      mockParseAndValidate.mockRejectedValue(new Error('Parse failed'));

      await expect(remoteGenerateCommand()).rejects.toThrow('Parse failed');

      expect(mockConsole.error).toHaveBeenCalled();
    });
  });
});

describe('remote:generate:capability Command', () => {
  const validManifest = {
    name: 'test-mfe',
    version: '1.0.0',
    type: 'remote' as const,
    language: 'typescript' as const,
    capabilities: [
      { UserProfile: { type: 'domain' as const, description: 'User profile' } }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup console spies AFTER clearAllMocks
    mockConsole = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };
    
    mockParseAndValidate.mockResolvedValue({
      valid: true,
      manifest: validManifest as any,
      errors: []
    });
    
    mockGenerateCapability.mockReturnValue([
      { path: '/test/src/features/UserProfile/UserProfile.tsx', content: 'code', overwrite: false }
    ]);
    
    mockWriteFiles.mockResolvedValue({
      files: [{ path: '/test/src/features/UserProfile/UserProfile.tsx', content: 'code', overwrite: false }],
      skipped: [],
      errors: []
    });
    
    mockGenerateRspack.mockReturnValue('rspack config');
    
    (mockFs.pathExists as unknown as jest.Mock).mockResolvedValue(true);
    (mockFs.readFile as unknown as jest.Mock).mockResolvedValue('port: 3001');
    (mockFs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
    
    jest.spyOn(process, 'cwd').mockReturnValue('/test');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Capability Lookup', () => {
    it('should find capability in manifest', async () => {
      await remoteGenerateCapabilityCommand('UserProfile');

      expect(mockGenerateCapability).toHaveBeenCalledWith(
        'UserProfile',
        { type: 'domain', description: 'User profile' },
        '/test'
      );
    });

    it('should throw error for missing capability', async () => {
      await expect(remoteGenerateCapabilityCommand('NonExistent'))
        .rejects.toThrow('Capability "NonExistent" not found');
    });

    it('should list available capabilities in error', async () => {
      try {
        await remoteGenerateCapabilityCommand('NonExistent');
      } catch (e) {
        expect((e as Error).message).toContain('UserProfile');
      }
    });
  });

  describe('File Generation', () => {
    it('should generate files for specific capability', async () => {
      await remoteGenerateCapabilityCommand('UserProfile');

      expect(mockWriteFiles).toHaveBeenCalled();
    });

    it('should support dry run mode', async () => {
      await remoteGenerateCapabilityCommand('UserProfile', { dryRun: true });

      expect(mockWriteFiles).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN]')
      );
    });

    it('should support force option', async () => {
      await remoteGenerateCapabilityCommand('UserProfile', { force: true });

      expect(mockWriteFiles).toHaveBeenCalledWith(
        expect.any(Array),
        { force: true }
      );
    });
  });

  describe('Console Output', () => {
    it('should log capability name', async () => {
      await remoteGenerateCapabilityCommand('UserProfile');

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Generating capability: UserProfile')
      );
    });

    it('should log success message', async () => {
      await remoteGenerateCapabilityCommand('UserProfile');

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Capability "UserProfile" generated')
      );
    });

    it('should log skipped files when they already exist', async () => {
      mockWriteFiles.mockResolvedValue({
        files: [],
        skipped: ['/test/src/features/UserProfile/UserProfile.tsx'],
        errors: []
      });

      await remoteGenerateCapabilityCommand('UserProfile');

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipped')
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid manifest', async () => {
      mockParseAndValidate.mockResolvedValue({
        valid: false,
        errors: [{ path: '', message: 'Invalid' }]
      });

      await expect(remoteGenerateCapabilityCommand('UserProfile'))
        .rejects.toThrow('Manifest validation failed');
    });
  });
});

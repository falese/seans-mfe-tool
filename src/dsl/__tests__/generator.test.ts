/**
 * DSL Generator Tests
 * Following TDD principles - testing capability file generation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import {
  generateCapabilityFiles,
  generateAllCapabilityFiles,
  writeGeneratedFiles,
  getNewCapabilities,
  getRemovedCapabilities,
  generateSharedConfig,
  generateRspackConfig
} from '../generator';
import type { DSLManifest, CapabilityConfig, GeneratedFile } from '../schema';

// Mock fs-extra
jest.mock('fs-extra');

// Helper to get mock function with proper typing
const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as jest.MockedFunction<T>;

describe('DSL Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCapabilityFiles', () => {
    it('should generate files for domain capability', () => {
      const config: CapabilityConfig = {
        type: 'domain',
        description: 'User profile management'
      };

      const files = generateCapabilityFiles('UserProfile', config, '/test/project');

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.path.includes('UserProfile.tsx'))).toBe(true);
      expect(files.some(f => f.path.includes('index.ts'))).toBe(true);
      expect(files.some(f => f.path.includes('UserProfile.test.tsx'))).toBe(true);
    });

    it('should not generate files for platform capability', () => {
      const config: CapabilityConfig = {
        type: 'platform'
      };

      const files = generateCapabilityFiles('load', config, '/test/project');

      expect(files).toHaveLength(0);
    });

    it('should set correct paths under src/features', () => {
      const config: CapabilityConfig = { type: 'domain' };
      const files = generateCapabilityFiles('Dashboard', config, '/test/project');

      for (const file of files) {
        expect(file.path).toContain('src/features/Dashboard');
      }
    });

    it('should mark component files as non-overwrite', () => {
      const config: CapabilityConfig = { type: 'domain' };
      const files = generateCapabilityFiles('Dashboard', config, '/test/project');

      const componentFile = files.find(f => f.path.includes('Dashboard.tsx'));
      expect(componentFile?.overwrite).toBe(false);
    });
  });

  describe('generateAllCapabilityFiles', () => {
    it('should generate files for all capabilities', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { Dashboard: { type: 'domain' } },
          { load: { type: 'platform' } }
        ]
      };

      const files = generateAllCapabilityFiles(manifest, '/test/project');

      // Should have files for UserProfile and Dashboard (not load)
      expect(files.some(f => f.path.includes('UserProfile'))).toBe(true);
      expect(files.some(f => f.path.includes('Dashboard'))).toBe(true);
      expect(files.some(f => f.path.includes('load'))).toBe(false);
    });

    it('should generate remote.tsx exports', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } }
        ]
      };

      const files = generateAllCapabilityFiles(manifest, '/test/project');

      const remoteFile = files.find(f => f.path.includes('remote.tsx'));
      expect(remoteFile).toBeDefined();
      expect(remoteFile?.overwrite).toBe(true);  // Always regenerate exports
    });

    it('should handle empty capabilities', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: []
      };

      const files = generateAllCapabilityFiles(manifest, '/test/project');

      // Should still generate remote.tsx (empty exports)
      expect(files.some(f => f.path.includes('remote.tsx'))).toBe(true);
    });
  });

  describe('writeGeneratedFiles', () => {
    it('should write all files that do not exist', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);
      asMock(fs.ensureDir).mockResolvedValue(undefined as never);
      asMock(fs.writeFile).mockResolvedValue(undefined as never);

      const files: GeneratedFile[] = [
        { path: '/test/src/App.tsx', content: 'code', overwrite: false }
      ];

      const result = await writeGeneratedFiles(files);

      expect(result.files).toHaveLength(1);
      expect(result.skipped).toHaveLength(0);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should skip existing files unless overwrite flag', async () => {
      asMock(fs.pathExists).mockResolvedValue(true as never);

      const files: GeneratedFile[] = [
        { path: '/test/src/App.tsx', content: 'code', overwrite: false }
      ];

      const result = await writeGeneratedFiles(files);

      expect(result.files).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should overwrite when file.overwrite is true', async () => {
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.ensureDir).mockResolvedValue(undefined as never);
      asMock(fs.writeFile).mockResolvedValue(undefined as never);

      const files: GeneratedFile[] = [
        { path: '/test/src/remote.tsx', content: 'code', overwrite: true }
      ];

      const result = await writeGeneratedFiles(files);

      expect(result.files).toHaveLength(1);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should overwrite when force option is true', async () => {
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.ensureDir).mockResolvedValue(undefined as never);
      asMock(fs.writeFile).mockResolvedValue(undefined as never);

      const files: GeneratedFile[] = [
        { path: '/test/src/App.tsx', content: 'code', overwrite: false }
      ];

      const result = await writeGeneratedFiles(files, { force: true });

      expect(result.files).toHaveLength(1);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should not write in dryRun mode', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      const files: GeneratedFile[] = [
        { path: '/test/src/App.tsx', content: 'code', overwrite: false }
      ];

      const result = await writeGeneratedFiles(files, { dryRun: true });

      expect(result.files).toHaveLength(1);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);
      asMock(fs.ensureDir).mockResolvedValue(undefined as never);
      asMock(fs.writeFile).mockRejectedValue(new Error('Permission denied') as never);

      const files: GeneratedFile[] = [
        { path: '/test/src/App.tsx', content: 'code', overwrite: false }
      ];

      const result = await writeGeneratedFiles(files);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Permission denied');
    });
  });

  describe('getNewCapabilities', () => {
    it('should detect new capabilities', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { Dashboard: { type: 'domain' } }
        ]
      };

      const newCaps = await getNewCapabilities(manifest, '/test/project');

      expect(newCaps).toContain('UserProfile');
      expect(newCaps).toContain('Dashboard');
    });

    it('should not include existing capabilities', async () => {
      asMock(fs.pathExists).mockImplementation(async (p) => {
        return (p as string).includes('UserProfile');
      });

      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { Dashboard: { type: 'domain' } }
        ]
      };

      const newCaps = await getNewCapabilities(manifest, '/test/project');

      expect(newCaps).not.toContain('UserProfile');
      expect(newCaps).toContain('Dashboard');
    });

    it('should ignore platform capabilities', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { load: { type: 'platform' } }
        ]
      };

      const newCaps = await getNewCapabilities(manifest, '/test/project');

      expect(newCaps).not.toContain('load');
    });
  });

  describe('getRemovedCapabilities', () => {
    it('should detect removed capabilities', async () => {
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.readdir).mockResolvedValue(['OldFeature', 'AnotherOld'] as never);
      asMock(fs.stat).mockResolvedValue({ isDirectory: () => true } as never);

      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: []  // No capabilities defined
      };

      const removed = await getRemovedCapabilities(manifest, '/test/project');

      expect(removed).toContain('OldFeature');
      expect(removed).toContain('AnotherOld');
    });

    it('should not include current capabilities', async () => {
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.readdir).mockResolvedValue(['UserProfile', 'OldFeature'] as never);
      asMock(fs.stat).mockResolvedValue({ isDirectory: () => true } as never);

      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } }
        ]
      };

      const removed = await getRemovedCapabilities(manifest, '/test/project');

      expect(removed).not.toContain('UserProfile');
      expect(removed).toContain('OldFeature');
    });

    it('should return empty if features dir does not exist', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: []
      };

      const removed = await getRemovedCapabilities(manifest, '/test/project');

      expect(removed).toHaveLength(0);
    });
  });

  describe('generateSharedConfig', () => {
    it('should generate shared config from dependencies', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [],
        dependencies: {
          runtime: {
            'react': '^18.0.0',
            'react-dom': '^18.0.0'
          },
          'design-system': {
            '@mui/material': '^5.14.0'
          }
        }
      };

      const shared = generateSharedConfig(manifest);

      expect(shared['react']).toBeDefined();
      expect(shared['react-dom']).toBeDefined();
      expect(shared['@mui/material']).toBeDefined();
    });

    it('should set singleton: true for all shared deps', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [],
        dependencies: {
          runtime: {
            'react': '^18.0.0'
          }
        }
      };

      const shared = generateSharedConfig(manifest);

      expect((shared['react'] as any).singleton).toBe(true);
    });

    it('should handle manifest without dependencies', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: []
      };

      const shared = generateSharedConfig(manifest);

      expect(shared).toEqual({});
    });
  });

  describe('generateRspackConfig', () => {
    it('should generate valid rspack config', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } }
        ]
      };

      const config = generateRspackConfig(manifest, 3001);

      expect(config).toContain('ModuleFederationPlugin');
      expect(config).toContain('port: 3001');
      expect(config).toContain("name: 'test_mfe'");  // Underscores for valid JS identifier
    });

    it('should include domain capabilities in exposes', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { Dashboard: { type: 'domain' } }
        ]
      };

      const config = generateRspackConfig(manifest, 3001);

      expect(config).toContain('./UserProfile');
      expect(config).toContain('./Dashboard');
    });

    it('should always include ./App expose', () => {
      const manifest: DSLManifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: []
      };

      const config = generateRspackConfig(manifest, 3001);

      expect(config).toContain("'./App'");
    });
  });
});

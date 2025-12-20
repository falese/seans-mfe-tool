/**
 * DSL Parser Tests
 * Following TDD principles - testing parser functionality
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import {
  parseYAML,
  parseManifestFile,
  findManifest,
  parseManifestFromDirectory,
  parseAndValidateFile,
  parseAndValidateDirectory,
  getCapabilityNames,
  getDomainCapabilities,
  hasDataLayer,
  serializeToYAML,
  writeManifest,
  createMinimalManifest,
  addCapability,
  generateEndpoints,
  MANIFEST_FILENAMES,
  WELL_KNOWN_PATH
} from '../parser';
import type { DSLManifest } from '../schema';

// Mock fs-extra
jest.mock('fs-extra');

// Helper to get mock function with proper typing
const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as jest.MockedFunction<T>;

describe('DSL Parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseYAML', () => {
    it('should parse valid YAML string', () => {
      const yaml = `
name: test-mfe
version: 1.0.0
type: remote
`;
      const result = parseYAML(yaml);
      expect(result.name).toBe('test-mfe');
      expect(result.version).toBe('1.0.0');
      expect(result.type).toBe('remote');
    });

    it('should throw on invalid YAML', () => {
      const invalidYaml = `
name: test
  version: 1.0.0
    bad: indentation
`;
      expect(() => parseYAML(invalidYaml)).toThrow();
    });

    it('should throw on empty YAML', () => {
      // Empty YAML returns null, which is not an object
      expect(() => parseYAML('')).toThrow('Invalid YAML: expected an object');
    });
  });

  describe('findManifest', () => {
    it('should find mfe-manifest.yaml', async () => {
      const validManifest = `
name: test-mfe
version: 1.0.0
type: remote
language: typescript
capabilities: []
`;
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.readFile).mockResolvedValue(validManifest as never);

      const result = await findManifest('/test/project');
      expect(result).toContain('mfe-manifest.yaml');
    });

    it('should return null if no manifest found', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      const result = await findManifest('/test/project');
      expect(result).toBeNull();
    });

    it('should check .well-known path', async () => {
      asMock(fs.pathExists).mockResolvedValue(true as never);
      const invalidYaml = 'not: valid: yaml:';
      asMock(fs.readFile).mockResolvedValue(invalidYaml as never);

      // Even if YAML is invalid, findManifest should return the path
      const result = await findManifest('/test/project');
      expect(result).toBeDefined();
    });

    it('should find manifest in well-known path when standard paths not found', async () => {
      // Return false for standard paths, true for .well-known
      asMock(fs.pathExists).mockImplementation(async (p: any) => {
        return (p as string).includes('.well-known');
      });

      const result = await findManifest('/test/project');
      expect(result).toContain('.well-known');
    });
  });

  describe('parseManifestFile', () => {
    it('should parse valid manifest file', async () => {
      const validManifest = `
name: test-mfe
version: 1.0.0
type: remote
language: typescript
capabilities: []
`;
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.readFile).mockResolvedValue(validManifest as never);

      const result = await parseManifestFile('/test/mfe-manifest.yaml');
      expect(result.name).toBe('test-mfe');
      expect(result.version).toBe('1.0.0');
    });

    it('should throw error when file not found', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      await expect(parseManifestFile('/test/not-found.yaml')).rejects.toThrow(
        'Manifest not found'
      );
    });
  });

  describe('parseManifestFromDirectory', () => {
    it('should parse manifest from directory', async () => {
      const validManifest = `
name: test-mfe
version: 1.0.0
type: remote
language: typescript
capabilities: []
`;
      asMock(fs.pathExists).mockImplementation(async (p: any) => {
        return (p as string).includes('mfe-manifest.yaml');
      });
      asMock(fs.readFile).mockResolvedValue(validManifest as never);

      const result = await parseManifestFromDirectory('/test');
      expect(result.manifest.name).toBe('test-mfe');
    });

    it('should throw error if no manifest found', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      await expect(parseManifestFromDirectory('/test')).rejects.toThrow(
        'No manifest found in /test'
      );
    });
  });

  describe('parseAndValidateFile', () => {
    it('should return valid result for valid manifest', async () => {
      const validManifest = `
name: test-mfe
version: 1.0.0
type: remote
language: typescript
capabilities:
  - UserProfile:
      type: domain
      description: User profile management
`;
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.readFile).mockResolvedValue(validManifest as never);

      const result = await parseAndValidateFile('/test/mfe-manifest.yaml');
      expect(result.valid).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid manifest', async () => {
      const invalidManifest = `
name: test-mfe
# missing version
type: invalid-type
`;
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.readFile).mockResolvedValue(invalidManifest as never);

      const result = await parseAndValidateFile('/test/mfe-manifest.yaml');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error when file not found', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      const result = await parseAndValidateFile('/test/missing.yaml');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Manifest not found');
    });

    it('should return error when file read fails', async () => {
      asMock(fs.pathExists).mockResolvedValue(true as never);
      asMock(fs.readFile).mockRejectedValue(new Error('Permission denied') as never);

      const result = await parseAndValidateFile('/test/mfe-manifest.yaml');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Permission denied');
    });
  });

  describe('parseAndValidateDirectory', () => {
    it('should find and validate manifest in directory', async () => {
      const validManifest = `
name: test-mfe
version: 1.0.0
type: remote
language: typescript
capabilities: []
`;
      asMock(fs.pathExists).mockImplementation(async (p: any) => {
        return (p as string).includes('mfe-manifest.yaml');
      });
      asMock(fs.readFile).mockResolvedValue(validManifest as never);

      const result = await parseAndValidateDirectory('/test');
      expect(result.valid).toBe(true);
      expect(result.manifestPath).toBeDefined();
    });

    it('should return error when no manifest found', async () => {
      asMock(fs.pathExists).mockResolvedValue(false as never);

      const result = await parseAndValidateDirectory('/test');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('No manifest found');
      expect(result.errors[0].message).toContain('mfe-manifest.yaml');
    });
  });

  describe('getCapabilityNames', () => {
    it('should extract all capability names', () => {
      const manifest: Partial<DSLManifest> = {
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { Dashboard: { type: 'domain' } },
          { load: { type: 'platform' } }
        ]
      };

      const names = getCapabilityNames(manifest as DSLManifest);
      expect(names).toEqual(['UserProfile', 'Dashboard', 'load']);
    });

    it('should return empty array for empty capabilities', () => {
      const manifest: Partial<DSLManifest> = {
        capabilities: []
      };

      const names = getCapabilityNames(manifest as DSLManifest);
      expect(names).toEqual([]);
    });

    it('should return empty array when capabilities is undefined', () => {
      const manifest: Partial<DSLManifest> = {};

      const names = getCapabilityNames(manifest as DSLManifest);
      expect(names).toEqual([]);
    });

    it('should return empty array when capabilities is not an array', () => {
      const manifest = {
        name: 'test',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: 'not-an-array' as any
      };

      const names = getCapabilityNames(manifest as DSLManifest);
      expect(names).toEqual([]);
    });
  });

  describe('getDomainCapabilities', () => {
    it('should filter only domain capabilities', () => {
      const manifest: Partial<DSLManifest> = {
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { load: { type: 'platform' } },
          { Dashboard: { type: 'domain' } }
        ]
      };

      const domain = getDomainCapabilities(manifest as DSLManifest);
      expect(domain).toHaveLength(2);
      expect(domain).toEqual(['UserProfile', 'Dashboard']);
    });

    it('should return empty array when no domain capabilities', () => {
      const manifest: Partial<DSLManifest> = {
        capabilities: [
          { load: { type: 'platform' } }
        ]
      };

      const domain = getDomainCapabilities(manifest as DSLManifest);
      expect(domain).toHaveLength(0);
    });

    it('should return empty array when capabilities is undefined', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test',
        version: '1.0.0'
      };

      const domain = getDomainCapabilities(manifest as DSLManifest);
      expect(domain).toHaveLength(0);
    });

    it('should return empty array when capabilities is not an array', () => {
      const manifest = {
        name: 'test',
        version: '1.0.0',
        capabilities: 'not-an-array'
      };

      const domain = getDomainCapabilities(manifest as unknown as DSLManifest);
      expect(domain).toHaveLength(0);
    });
  });

  describe('hasDataLayer', () => {
    it('should return true when data section has sources', () => {
      const manifest: Partial<DSLManifest> = {
        data: {
          sources: [{ name: 'api', handler: { openapi: { source: './api.yaml' } } }]
        }
      };

      expect(hasDataLayer(manifest as DSLManifest)).toBe(true);
    });

    it('should return false when no data section', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test',
        version: '1.0.0'
      };

      expect(hasDataLayer(manifest as DSLManifest)).toBe(false);
    });

    it('should return false when data section has empty sources', () => {
      const manifest: Partial<DSLManifest> = {
        data: {
          sources: []
        }
      };

      expect(hasDataLayer(manifest as DSLManifest)).toBe(false);
    });
  });

  describe('serializeToYAML', () => {
    it('should serialize manifest to YAML', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote'
      };

      const yaml = serializeToYAML(manifest as DSLManifest);
      expect(yaml).toContain('name: test-mfe');
      expect(yaml).toContain('version: 1.0.0');
      expect(yaml).toContain('type: remote');
    });
  });

  describe('writeManifest', () => {
    it('should write manifest to file as YAML', async () => {
      asMock(fs.writeFile).mockResolvedValue(undefined as never);
      
      const manifest = createMinimalManifest('test-mfe');
      await writeManifest(manifest, '/test/mfe-manifest.yaml');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/mfe-manifest.yaml',
        expect.stringContaining('name: test-mfe'),
        'utf8'
      );
    });
  });

  describe('createMinimalManifest', () => {
    it('should create minimal valid manifest', () => {
      const manifest = createMinimalManifest('my-remote');
      
      expect(manifest.name).toBe('my-remote');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.type).toBe('remote');
      expect(manifest.language).toBe('typescript');
      expect(manifest.capabilities).toEqual([]);
    });

    it('should accept options', () => {
      const manifest = createMinimalManifest('my-shell', {
        type: 'shell',
        language: 'javascript'
      });

      expect(manifest.type).toBe('shell');
      expect(manifest.language).toBe('javascript');
    });
  });

  describe('addCapability', () => {
    it('should add capability to manifest', () => {
      const manifest = createMinimalManifest('test');
      const updated = addCapability(manifest, 'UserProfile', {
        type: 'domain',
        description: 'User profile management'
      });

      expect(updated.capabilities).toHaveLength(1);
      expect(updated.capabilities[0]).toHaveProperty('UserProfile');
    });

    it('should not modify original manifest', () => {
      const manifest = createMinimalManifest('test');
      addCapability(manifest, 'UserProfile', { type: 'domain' });

      expect(manifest.capabilities).toHaveLength(0);
    });
  });

  describe('generateEndpoints', () => {
    it('should generate standard endpoints', () => {
      const endpoints = generateEndpoints('my-remote', 3001);

      expect(endpoints.remoteEntry).toBe('http://localhost:3001/remoteEntry.js');
      expect(endpoints.endpoint).toBe('http://localhost:3001');
      expect(endpoints.discovery).toBe('http://localhost:3001/.well-known/mfe-manifest.yaml');
    });
  });

  describe('Constants', () => {
    it('should export MANIFEST_FILENAMES', () => {
      expect(MANIFEST_FILENAMES).toContain('mfe-manifest.yaml');
      expect(MANIFEST_FILENAMES).toContain('mfe-manifest.yml');
    });

    it('should export WELL_KNOWN_PATH', () => {
      expect(WELL_KNOWN_PATH).toBe('.well-known/mfe-manifest.yaml');
    });
  });
});

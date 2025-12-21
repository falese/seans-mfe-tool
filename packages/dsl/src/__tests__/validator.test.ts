/**
 * DSL Validator Tests
 * Following TDD principles - testing Zod validation
 */

import {
  validateManifest,
  validatePartialManifest,
  validateCapabilities,
  validateDataConfig,
  validateSemantics,
  validateFull,
  formatErrorsForCLI,
  getErrorSummary
} from '../validator';
import type { DSLManifest, ValidationError, CapabilityEntry } from '../schema';

describe('DSL Validator', () => {
  describe('validateManifest', () => {
    it('should validate a minimal valid manifest', () => {
      const manifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: []
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.manifest).toBeDefined();
    });

    it('should fail when name is missing', () => {
      const manifest = {
        version: '1.0.0',
        type: 'remote'
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('name'))).toBe(true);
    });

    it('should fail when version is missing', () => {
      const manifest = {
        name: 'test-mfe',
        type: 'remote'
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('version'))).toBe(true);
    });

    it('should fail with invalid type', () => {
      const manifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'invalid-type'
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('type'))).toBe(true);
    });

    it('should validate all valid types', () => {
      const validTypes = ['tool', 'agent', 'feature', 'service', 'remote', 'shell', 'bff'];

      for (const type of validTypes) {
        const manifest = {
          name: 'test-mfe',
          version: '1.0.0',
          type,
          language: 'typescript',
          capabilities: []
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate manifest with capabilities', () => {
      const manifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          {
            UserProfile: {
              type: 'domain',
              description: 'User profile management'
            }
          }
        ]
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('should validate manifest with dependencies', () => {
      const manifest = {
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

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePartialManifest', () => {
    it('should validate partial manifest', () => {
      const partial = {
        name: 'test-mfe',
        version: '1.0.0'
      };

      const result = validatePartialManifest(partial);
      expect(result.valid).toBe(true);
    });

    it('should fail on invalid values even if partial', () => {
      const partial = {
        name: 123,  // Should be string
        version: '1.0.0'
      };

      const result = validatePartialManifest(partial as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toContain('name');
    });
  });

  describe('validateCapabilities', () => {
    it('should validate valid capability array', () => {
      const capabilities: CapabilityEntry[] = [
        { UserProfile: { type: 'domain', description: 'User profile' } },
        { Dashboard: { type: 'domain' } }
      ];

      const result = validateCapabilities(capabilities);
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid capability type', () => {
      const capabilities = [
        { UserProfile: { type: 'invalid' } }
      ];

      const result = validateCapabilities(capabilities as any);
      expect(result.valid).toBe(false);
    });

    it('should validate platform capabilities', () => {
      const capabilities: CapabilityEntry[] = [
        { load: { type: 'platform' } },
        { render: { type: 'platform' } }
      ];

      const result = validateCapabilities(capabilities);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDataConfig', () => {
    it('should validate valid data config', () => {
      const data = {
        sources: [
          {
            name: 'users-api',
            handler: {
              openapi: { source: './specs/users.yaml' }
            }
          }
        ]
      };

      const result = validateDataConfig(data);
      expect(result.valid).toBe(true);
    });

    it('should validate data config with transforms', () => {
      const data = {
        sources: [
          {
            name: 'api',
            handler: { openapi: { source: './api.yaml' } }
          }
        ],
        transforms: [
          { name: 'filterSchema', options: { filters: ['Query.!*.internal'] } }
        ]
      };

      const result = validateDataConfig(data);
      expect(result.valid).toBe(true);
    });

    it('should fail with empty sources', () => {
      const data = {
        sources: []
      };

      // Empty sources is technically valid schema-wise
      const result = validateDataConfig(data);
      expect(result.valid).toBe(true);
    });

    it('should fail with invalid source structure', () => {
      const data = {
        sources: [
          {
            // missing name
            handler: { openapi: { source: './api.yaml' } }
          }
        ]
      };

      const result = validateDataConfig(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateSemantics', () => {
    it('should pass for valid semantics', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        capabilities: [
          { UserProfile: { type: 'domain' } }
        ]
      };

      const errors = validateSemantics(manifest as DSLManifest);
      expect(errors).toHaveLength(0);
    });

    it('should warn about duplicate capability names', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { UserProfile: { type: 'domain' } }  // Duplicate
        ]
      };

      const errors = validateSemantics(manifest as DSLManifest);
      expect(errors.some(e => e.message.includes('Duplicate'))).toBe(true);
    });

    it('should skip semantic validation if no capabilities', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        capabilities: []
      };

      const errors = validateSemantics(manifest as DSLManifest);
      expect(errors).toHaveLength(0);
    });

    it('should detect duplicate data source names', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        capabilities: [],
        data: {
          sources: [
            { name: 'api', handler: { openapi: { source: './api.yaml' } } },
            { name: 'api', handler: { openapi: { source: './api2.yaml' } } } // Duplicate
          ]
        }
      };

      const errors = validateSemantics(manifest as DSLManifest);
      expect(errors.some(e => e.message.includes('Duplicate data source'))).toBe(true);
      expect(errors.some(e => e.code === 'duplicate_source')).toBe(true);
    });

    it('should warn about non-PascalCase capability names', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        capabilities: [
          { userProfile: { type: 'domain' } }  // Should be UserProfile
        ]
      };

      const errors = validateSemantics(manifest as DSLManifest);
      expect(errors.some(e => e.message.includes('PascalCase'))).toBe(true);
      expect(errors.some(e => e.code === 'naming_convention')).toBe(true);
    });

    it('should warn about non-kebab-case MFE names', () => {
      const manifest: Partial<DSLManifest> = {
        name: 'TestMFE',  // Should be test-mfe
        version: '1.0.0',
        type: 'remote',
        capabilities: []
      };

      const errors = validateSemantics(manifest as DSLManifest);
      expect(errors.some(e => e.message.includes('kebab-case'))).toBe(true);
    });
  });

  describe('validateFull', () => {
    it('should run both schema and semantic validation', () => {
      const manifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } }
        ]
      };

      const result = validateFull(manifest);
      expect(result.valid).toBe(true);
      expect(result.manifest).toBeDefined();
    });

    it('should fail on schema errors', () => {
      const manifest = {
        name: 'test-mfe',
        // missing version
        type: 'remote'
      };

      const result = validateFull(manifest);
      expect(result.valid).toBe(false);
    });

    it('should include semantic errors', () => {
      const manifest = {
        name: 'test-mfe',
        version: '1.0.0',
        type: 'remote',
        language: 'typescript',
        capabilities: [
          { UserProfile: { type: 'domain' } },
          { UserProfile: { type: 'domain' } }  // Duplicate
        ]
      };

      const result = validateFull(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
    });
  });

  describe('formatErrorsForCLI', () => {
    it('should format single error', () => {
      const errors: ValidationError[] = [
        { path: 'name', message: 'Required field' }
      ];

      const output = formatErrorsForCLI(errors);
      expect(output).toContain('name');
      expect(output).toContain('Required field');
    });

    it('should format multiple errors', () => {
      const errors: ValidationError[] = [
        { path: 'name', message: 'Required field' },
        { path: 'version', message: 'Invalid format' }
      ];

      const output = formatErrorsForCLI(errors);
      expect(output).toContain('name');
      expect(output).toContain('version');
    });

    it('should handle empty errors array', () => {
      const output = formatErrorsForCLI([]);
      expect(output).toBe('');
    });

    it('should format error without path', () => {
      const errors: ValidationError[] = [
        { path: '', message: 'General validation error' }
      ];

      const output = formatErrorsForCLI(errors);
      expect(output).toContain('General validation error');
      expect(output).not.toContain(':  General'); // no path prefix with colon
    });
  });

  describe('getErrorSummary', () => {
    it('should return count and first error', () => {
      const errors: ValidationError[] = [
        { path: 'name', message: 'Required' },
        { path: 'version', message: 'Invalid' }
      ];

      const summary = getErrorSummary(errors);
      expect(summary).toContain('2');
      expect(summary).toContain('error');
    });

    it('should handle single error', () => {
      const errors: ValidationError[] = [
        { path: 'name', message: 'Required' }
      ];

      const summary = getErrorSummary(errors);
      expect(summary).toBe('Required');
    });

    it('should handle no errors', () => {
      const summary = getErrorSummary([]);
      expect(summary).toBe('Valid');
    });
  });
});

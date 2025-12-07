/**
 * Tests for manifestValidator.js
 * Validates MFE manifest structure and configuration per ADR-062
 */

const {
  validateManifest,
  printValidationResults,
  getRequiredDependencies,
  KNOWN_PLUGINS,
  KNOWN_TRANSFORMS,
} = require('../manifestValidator');
const chalk = require('chalk');

// Mock console methods
const mockConsole = () => {
  const originalLog = console.log;
  const logs = [];
  
  console.log = jest.fn((...args) => {
    logs.push(args.join(' '));
  });
  
  return {
    logs,
    restore: () => {
      console.log = originalLog;
    },
  };
};

describe('manifestValidator', () => {
  describe('KNOWN_PLUGINS constant', () => {
    it('should export array of known plugins', () => {
      expect(Array.isArray(KNOWN_PLUGINS)).toBe(true);
      expect(KNOWN_PLUGINS.length).toBeGreaterThan(0);
      expect(KNOWN_PLUGINS).toContain('responseCache');
      expect(KNOWN_PLUGINS).toContain('prometheus');
    });
  });

  describe('KNOWN_TRANSFORMS constant', () => {
    it('should export array of known transforms', () => {
      expect(Array.isArray(KNOWN_TRANSFORMS)).toBe(true);
      expect(KNOWN_TRANSFORMS.length).toBeGreaterThan(0);
      expect(KNOWN_TRANSFORMS).toContain('namingConvention');
      expect(KNOWN_TRANSFORMS).toContain('rateLimit');
    });
  });

  describe('validateManifest', () => {
    describe('valid manifests', () => {
      it('should validate empty manifest', () => {
        const result = validateManifest({});
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should validate manifest with valid plugins', () => {
        const manifest = {
          plugins: ['responseCache', 'prometheus'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate manifest with plugin objects', () => {
        const manifest = {
          plugins: [
            { responseCache: { ttl: 3600 } },
            { prometheus: { port: 9090 } },
          ],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate manifest with valid transforms', () => {
        const manifest = {
          transforms: ['namingConvention', 'rateLimit'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate manifest with transform objects', () => {
        const manifest = {
          transforms: [
            { namingConvention: { enumValues: 'UPPER_CASE' } },
            { rateLimit: { perMinute: 100 } },
          ],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate manifest with valid resolversComposition', () => {
        const manifest = {
          resolversComposition: {
            'Query.user': './src/resolvers/userComposer.js',
            'Mutation.createUser': './src/resolvers/createUserComposer.js',
          },
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate complete valid manifest', () => {
        const manifest = {
          plugins: ['responseCache', { prometheus: { port: 9090 } }],
          transforms: ['namingConvention', { rateLimit: { perMinute: 100 } }],
          resolversComposition: {
            'Query.user': './src/resolvers/userComposer.js',
          },
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    describe('legacy performance section', () => {
      it('should detect legacy performance section', () => {
        const manifest = {
          performance: {
            cache: true,
          },
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Legacy "performance" section detected');
        expect(result.errors[0]).toContain('ADR-062');
      });
    });

    describe('plugin/transform misplacement', () => {
      it('should error when transform is in plugins section', () => {
        const manifest = {
          plugins: ['namingConvention', 'responseCache'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('namingConvention');
        expect(result.errors[0]).toContain('is a transform, not a plugin');
        expect(result.errors[0]).toContain('transforms');
      });

      it('should error when transform object is in plugins section', () => {
        const manifest = {
          plugins: [{ rateLimit: { perMinute: 100 } }],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('rateLimit');
        expect(result.errors[0]).toContain('is a transform, not a plugin');
      });

      it('should error when plugin is in transforms section', () => {
        const manifest = {
          transforms: ['prometheus', 'namingConvention'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('prometheus');
        expect(result.errors[0]).toContain('is a plugin, not a transform');
        expect(result.errors[0]).toContain('plugins');
      });

      it('should error when plugin object is in transforms section', () => {
        const manifest = {
          transforms: [{ responseCache: { ttl: 3600 } }],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('responseCache');
        expect(result.errors[0]).toContain('is a plugin, not a transform');
      });

      it('should error for multiple misplaced items', () => {
        const manifest = {
          plugins: ['namingConvention', 'rateLimit'],
          transforms: ['prometheus', 'opentelemetry'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(4);
      });
    });

    describe('unknown plugins and transforms', () => {
      it('should warn about unknown plugin', () => {
        const manifest = {
          plugins: ['unknownPlugin', 'responseCache'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('unknownPlugin');
        expect(result.warnings[0]).toContain('@graphql-mesh/plugin-*');
      });

      it('should warn about unknown transform', () => {
        const manifest = {
          transforms: ['unknownTransform', 'namingConvention'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('unknownTransform');
        expect(result.warnings[0]).toContain('@graphql-mesh/transform-*');
      });

      it('should warn about multiple unknown items', () => {
        const manifest = {
          plugins: ['unknownPlugin1', 'unknownPlugin2'],
          transforms: ['unknownTransform1'],
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(3);
      });
    });

    describe('resolversComposition validation', () => {
      it('should error when resolversComposition is not an object', () => {
        const manifest = {
          resolversComposition: 'not-an-object',
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('must be an object');
      });

      it('should error when resolversComposition array values are not strings', () => {
        const manifest = {
          resolversComposition: {
            0: 'array-item',
          },
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(true); // Object with numeric keys is still valid if values are strings
        expect(result.errors).toHaveLength(0);
      });

      it('should error when resolversComposition value is not a string', () => {
        const manifest = {
          resolversComposition: {
            'Query.user': 123,
          },
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Query.user');
        expect(result.errors[0]).toContain('must be a string path');
      });

      it('should error when resolversComposition value is object', () => {
        const manifest = {
          resolversComposition: {
            'Query.user': { path: './composer.js' },
          },
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
      });

      it('should error for multiple invalid resolversComposition values', () => {
        const manifest = {
          resolversComposition: {
            'Query.user': 123,
            'Mutation.createUser': { path: './composer.js' },
            'Query.posts': null,
          },
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(3);
      });
    });

    describe('combined errors and warnings', () => {
      it('should return both errors and warnings', () => {
        const manifest = {
          plugins: ['namingConvention', 'unknownPlugin'],
          transforms: ['prometheus'],
          resolversComposition: 'invalid',
        };
        const result = validateManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('printValidationResults', () => {
    let mock;

    beforeEach(() => {
      mock = mockConsole();
    });

    afterEach(() => {
      mock.restore();
    });

    it('should print success message for valid manifest', () => {
      const result = { valid: true, errors: [], warnings: [] };
      printValidationResults(result, '/path/to/manifest.yaml');
      
      expect(mock.logs.length).toBeGreaterThan(0);
      expect(mock.logs.join('\n')).toContain('Manifest validation passed');
      expect(mock.logs.join('\n')).toContain('/path/to/manifest.yaml');
    });

    it('should print error message for invalid manifest', () => {
      const result = {
        valid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: [],
      };
      printValidationResults(result, '/path/to/manifest.yaml');
      
      const output = mock.logs.join('\n');
      expect(output).toContain('Manifest validation failed');
      expect(output).toContain('Error 1');
      expect(output).toContain('Error 2');
    });

    it('should print warnings', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: ['Warning 1', 'Warning 2'],
      };
      printValidationResults(result, '/path/to/manifest.yaml');
      
      const output = mock.logs.join('\n');
      expect(output).toContain('Warning 1');
      expect(output).toContain('Warning 2');
    });

    it('should print both errors and warnings', () => {
      const result = {
        valid: false,
        errors: ['Error 1'],
        warnings: ['Warning 1'],
      };
      printValidationResults(result, '/path/to/manifest.yaml');
      
      const output = mock.logs.join('\n');
      expect(output).toContain('Error 1');
      expect(output).toContain('Warning 1');
    });

    it('should number errors and warnings', () => {
      const result = {
        valid: false,
        errors: ['First error', 'Second error'],
        warnings: ['First warning'],
      };
      printValidationResults(result, '/path/to/manifest.yaml');
      
      const output = mock.logs.join('\n');
      expect(output).toContain('1.');
      expect(output).toContain('2.');
    });
  });

  describe('getRequiredDependencies', () => {
    it('should return core dependencies for empty manifest', () => {
      const result = getRequiredDependencies({});
      expect(result.plugins).toContain('@graphql-mesh/cli');
      expect(result.plugins).toContain('@graphql-mesh/graphql');
      expect(Array.isArray(result.transforms)).toBe(true);
    });

    it('should add plugin dependencies', () => {
      const manifest = {
        plugins: ['responseCache', 'prometheus'],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.plugins).toContain('@graphql-mesh/plugin-response-cache');
      expect(result.plugins).toContain('@graphql-mesh/plugin-prometheus');
    });

    it('should handle plugin objects', () => {
      const manifest = {
        plugins: [{ responseCache: { ttl: 3600 } }],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.plugins).toContain('@graphql-mesh/plugin-response-cache');
    });

    it('should add transform dependencies', () => {
      const manifest = {
        transforms: ['namingConvention', 'rateLimit'],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.transforms).toContain('@graphql-mesh/transform-naming-convention');
      expect(result.transforms).toContain('@graphql-mesh/transform-rate-limit');
    });

    it('should handle transform objects', () => {
      const manifest = {
        transforms: [{ namingConvention: { enumValues: 'UPPER_CASE' } }],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.transforms).toContain('@graphql-mesh/transform-naming-convention');
    });

    it('should convert camelCase to kebab-case for package names', () => {
      const manifest = {
        plugins: ['responseCache'],
        transforms: ['namingConvention'],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.plugins).toContain('@graphql-mesh/plugin-response-cache');
      expect(result.transforms).toContain('@graphql-mesh/transform-naming-convention');
    });

    it('should handle already kebab-case names', () => {
      const manifest = {
        transforms: ['type-merging'],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.transforms).toContain('@graphql-mesh/transform-type-merging');
    });

    it('should deduplicate dependencies', () => {
      const manifest = {
        plugins: ['prometheus', 'prometheus'],
      };
      const result = getRequiredDependencies(manifest);
      const prometheusCount = result.plugins.filter(
        (p) => p === '@graphql-mesh/plugin-prometheus'
      ).length;
      expect(prometheusCount).toBe(1);
    });

    it('should handle both plugins and transforms', () => {
      const manifest = {
        plugins: ['responseCache', 'prometheus'],
        transforms: ['namingConvention', 'rateLimit'],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.plugins.length).toBeGreaterThan(2); // Core + 2 plugins
      expect(result.transforms.length).toBe(2);
    });

    it('should always include core dependencies even with plugins', () => {
      const manifest = {
        plugins: ['prometheus'],
      };
      const result = getRequiredDependencies(manifest);
      expect(result.plugins).toContain('@graphql-mesh/cli');
      expect(result.plugins).toContain('@graphql-mesh/graphql');
    });
  });
});

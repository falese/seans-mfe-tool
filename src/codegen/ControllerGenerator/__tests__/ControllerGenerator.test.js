const fs = require('fs-extra');
const path = require('path');
const { ControllerGenerator } = require('../ControllerGenerator');
const { MethodGenerator } = require('../generators/MethodGenerator');
const { ValidationGenerator } = require('../generators/ValidationGenerator');
const { ImplementationGenerator } = require('../generators/ImplementationGenerator');
const { DatabaseAdapter } = require('../adapters/DatabaseAdapter');
const { NameGenerator } = require('../../generators/NameGenerator');
const { simpleSpec, crudSpec, multiResourceSpec } = require('./fixtures/openapi-specs');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../generators/MethodGenerator');
jest.mock('../generators/ValidationGenerator');
jest.mock('../generators/ImplementationGenerator');
jest.mock('../adapters/DatabaseAdapter');
jest.mock('../../generators/NameGenerator');

describe('ControllerGenerator', () => {
  let mockDbAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock database adapter
    mockDbAdapter = {
      getImportStatement: jest.fn().mockReturnValue("const { Model } = require('../models');")
    };
    
    DatabaseAdapter.create = jest.fn().mockReturnValue(mockDbAdapter);
    
    // Setup NameGenerator mocks
    NameGenerator.toCamelCase = jest.fn(name => name);
    NameGenerator.toModelName = jest.fn(name => name.charAt(0).toUpperCase() + name.slice(1));
    NameGenerator.generateControllerMethodName = jest.fn((method, resource) => `${method}${resource}`);
    
    // Setup generator mocks
    ValidationGenerator.generateValidations = jest.fn().mockReturnValue([]);
    ImplementationGenerator.generate = jest.fn().mockReturnValue('// implementation');
    MethodGenerator.generateControllerMethod = jest.fn().mockReturnValue('async function test() {}');
    
    // Setup fs mocks
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  describe('generate', () => {
    it('should throw error for missing paths in spec', async () => {
      const invalidSpec = {};
      
      await expect(
        ControllerGenerator.generate('mongodb', '/controllers', invalidSpec)
      ).rejects.toThrow('Invalid OpenAPI specification: missing paths');
    });

    it('should throw error for null spec', async () => {
      await expect(
        ControllerGenerator.generate('mongodb', '/controllers', null)
      ).rejects.toThrow('Invalid OpenAPI specification: missing paths');
    });

    it('should create database adapter with correct type', async () => {
      await ControllerGenerator.generate('mongodb', '/controllers', simpleSpec);
      
      expect(DatabaseAdapter.create).toHaveBeenCalledWith('mongodb');
    });

    it('should call generateControllers with correct arguments', async () => {
      const spy = jest.spyOn(ControllerGenerator, 'generateControllers').mockResolvedValue(undefined);
      
      await ControllerGenerator.generate('sqlite', '/controllers', simpleSpec);
      
      expect(spy).toHaveBeenCalledWith('/controllers', simpleSpec, mockDbAdapter);
      
      spy.mockRestore();
    });
  });

  describe('groupPathsByResource', () => {
    it('should group single path by resource name', () => {
      const paths = {
        '/pets': { get: { responses: {} } }
      };
      
      const result = ControllerGenerator.groupPathsByResource(paths);
      
      expect(result).toEqual({
        pets: {
          paths: [
            {
              path: '/pets',
              operations: { get: { responses: {} } },
              pathParameters: undefined
            }
          ]
        }
      });
    });

    it('should group multiple paths for same resource', () => {
      const paths = {
        '/pets': { get: { responses: {} } },
        '/pets/{petId}': { get: { responses: {} } }
      };
      
      const result = ControllerGenerator.groupPathsByResource(paths);
      
      expect(result.pets.paths).toHaveLength(2);
      expect(result.pets.paths[0].path).toBe('/pets');
      expect(result.pets.paths[1].path).toBe('/pets/{petId}');
    });

    it('should separate different resources', () => {
      const paths = {
        '/users': { get: { responses: {} } },
        '/posts': { get: { responses: {} } }
      };
      
      const result = ControllerGenerator.groupPathsByResource(paths);
      
      expect(Object.keys(result)).toEqual(['users', 'posts']);
      expect(result.users.paths[0].path).toBe('/users');
      expect(result.posts.paths[0].path).toBe('/posts');
    });

    it('should extract path parameters from operations', () => {
      const paths = {
        '/pets/{petId}': {
          parameters: [{ name: 'petId', in: 'path' }],
          get: { responses: {} }
        }
      };
      
      const result = ControllerGenerator.groupPathsByResource(paths);
      
      expect(result.pets.paths[0].pathParameters).toEqual([{ name: 'petId', in: 'path' }]);
    });

    it('should filter out parameters from operations object', () => {
      const paths = {
        '/pets': {
          parameters: [{ name: 'test', in: 'path' }],
          get: { responses: {} },
          post: { responses: {} }
        }
      };
      
      const result = ControllerGenerator.groupPathsByResource(paths);
      
      expect(result.pets.paths[0].operations).toEqual({
        get: { responses: {} },
        post: { responses: {} }
      });
      expect(result.pets.paths[0].operations.parameters).toBeUndefined();
    });

    it('should handle complex resource names', () => {
      const paths = {
        '/user-profiles': { get: { responses: {} } },
        '/user-profiles/{id}': { get: { responses: {} } }
      };
      
      const result = ControllerGenerator.groupPathsByResource(paths);
      
      expect(result['user-profiles']).toBeDefined();
      expect(result['user-profiles'].paths).toHaveLength(2);
    });

    it('should handle nested paths', () => {
      const paths = {
        '/users/{userId}/posts': { get: { responses: {} } },
        '/users/{userId}/posts/{postId}': { get: { responses: {} } }
      };
      
      const result = ControllerGenerator.groupPathsByResource(paths);
      
      // Groups by first segment after /
      expect(result.users).toBeDefined();
      expect(result.users.paths).toHaveLength(2);
    });
  });

  describe('generateImports', () => {
    it('should generate API error import', () => {
      const result = ControllerGenerator.generateImports(mockDbAdapter);
      
      expect(result).toContain("const { ApiError } = require('../middleware/errorHandler');");
    });

    it('should generate logger import', () => {
      const result = ControllerGenerator.generateImports(mockDbAdapter);
      
      expect(result).toContain("const logger = require('../utils/logger');");
    });

    it('should include database adapter import', () => {
      const result = ControllerGenerator.generateImports(mockDbAdapter);
      
      expect(mockDbAdapter.getImportStatement).toHaveBeenCalled();
      expect(result).toContain("const { Model } = require('../models');");
    });

    it('should join imports with newlines', () => {
      const result = ControllerGenerator.generateImports(mockDbAdapter);
      
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
    });
  });

  describe('generateExports', () => {
    it('should generate module exports for single method', () => {
      const result = ControllerGenerator.generateExports(['getPets']);
      
      expect(result).toBe('module.exports = {\n  getPets\n};');
    });

    it('should generate module exports for multiple methods', () => {
      const result = ControllerGenerator.generateExports(['getPets', 'createPet', 'updatePet']);
      
      expect(result).toContain('getPets');
      expect(result).toContain('createPet');
      expect(result).toContain('updatePet');
      expect(result).toMatch(/module\.exports = \{[\s\S]*\}/);
    });

    it('should format methods with proper indentation', () => {
      const result = ControllerGenerator.generateExports(['method1', 'method2']);
      
      expect(result).toContain('  method1,\n  method2');
    });
  });

  describe('generateMethods', () => {
    it('should generate method for each operation', () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: { get: { responses: {} } },
            pathParameters: []
          }
        ]
      };
      
      const result = ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(result).toHaveLength(1);
      expect(NameGenerator.generateControllerMethodName).toHaveBeenCalledWith('get', 'pets', '/pets');
    });

    it('should skip parameters in operations', () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: {
              parameters: [{ name: 'test' }],
              get: { responses: {} }
            },
            pathParameters: []
          }
        ]
      };
      
      const result = ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(result).toHaveLength(1); // Only 'get', not 'parameters'
    });

    it('should merge path parameters with operation parameters', () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets/{petId}',
            operations: {
              get: {
                parameters: [{ name: 'limit', in: 'query' }],
                responses: {}
              }
            },
            pathParameters: [{ name: 'petId', in: 'path' }]
          }
        ]
      };
      
      ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(ValidationGenerator.generateValidations).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: [
            { name: 'petId', in: 'path' },
            { name: 'limit', in: 'query' }
          ]
        })
      );
    });

    it('should call ValidationGenerator with operation', () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: { post: { requestBody: {} } },
            pathParameters: []
          }
        ]
      };
      
      ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(ValidationGenerator.generateValidations).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: {} })
      );
    });

    it('should call ImplementationGenerator with correct arguments', () => {
      const operation = { responses: {} };
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: { put: operation },
            pathParameters: []
          }
        ]
      };
      
      ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(ImplementationGenerator.generate).toHaveBeenCalledWith(
        'put',
        '/pets',
        operation,
        'Pet',
        mockDbAdapter
      );
    });

    it('should call MethodGenerator with all components', () => {
      ValidationGenerator.generateValidations.mockReturnValue(['const { petId } = req.params;']);
      ImplementationGenerator.generate.mockReturnValue('const pet = await Pet.findById(petId);');
      NameGenerator.generateControllerMethodName.mockReturnValue('getPetById');
      
      const operation = { responses: {} };
      const pathGroup = {
        paths: [
          {
            path: '/pets/{petId}',
            operations: { get: operation },
            pathParameters: []
          }
        ]
      };
      
      ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(MethodGenerator.generateControllerMethod).toHaveBeenCalledWith(
        'getPetById',
        'get',
        '/pets/{petId}',
        operation,
        ['const { petId } = req.params;'],
        'const pet = await Pet.findById(petId);'
      );
    });

    it('should return method metadata with name and content', () => {
      NameGenerator.generateControllerMethodName.mockReturnValue('getPets');
      MethodGenerator.generateControllerMethod.mockReturnValue('async function getPets() {}');
      
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: { get: { responses: {} } },
            pathParameters: []
          }
        ]
      };
      
      const result = ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(result[0]).toEqual({
        name: 'getPets',
        content: 'async function getPets() {}'
      });
    });

    it('should process multiple operations for same path', () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: {
              get: { responses: {} },
              post: { responses: {} }
            },
            pathParameters: []
          }
        ]
      };
      
      const result = ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(result).toHaveLength(2);
      expect(NameGenerator.generateControllerMethodName).toHaveBeenCalledTimes(2);
    });

    it('should process multiple paths', () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: { get: { responses: {} } },
            pathParameters: []
          },
          {
            path: '/pets/{petId}',
            operations: { get: { responses: {} } },
            pathParameters: []
          }
        ]
      };
      
      const result = ControllerGenerator.generateMethods('pets', 'Pet', pathGroup, mockDbAdapter);
      
      expect(result).toHaveLength(2);
    });
  });

  describe('generateControllerContent', () => {
    it('should combine imports, methods, and exports', async () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: { get: { responses: {} } },
            pathParameters: []
          }
        ]
      };
      
      NameGenerator.generateControllerMethodName.mockReturnValue('getPets');
      MethodGenerator.generateControllerMethod.mockReturnValue('async function getPets() {}');
      
      const result = await ControllerGenerator.generateControllerContent(
        'pets',
        'Pet',
        pathGroup,
        mockDbAdapter
      );
      
      expect(result).toContain("const { ApiError } = require('../middleware/errorHandler');");
      expect(result).toContain('async function getPets() {}');
      expect(result).toContain('module.exports = {\n  getPets\n};');
    });

    it('should separate sections with double newlines', async () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: { get: { responses: {} } },
            pathParameters: []
          }
        ]
      };
      
      const result = await ControllerGenerator.generateControllerContent(
        'pets',
        'Pet',
        pathGroup,
        mockDbAdapter
      );
      
      expect(result).toMatch(/\n\n/); // Contains double newlines
    });

    it('should include all generated methods in content', async () => {
      const pathGroup = {
        paths: [
          {
            path: '/pets',
            operations: {
              get: { responses: {} },
              post: { responses: {} }
            },
            pathParameters: []
          }
        ]
      };
      
      NameGenerator.generateControllerMethodName
        .mockReturnValueOnce('getPets')
        .mockReturnValueOnce('createPet');
      
      MethodGenerator.generateControllerMethod
        .mockReturnValueOnce('async function getPets() {}')
        .mockReturnValueOnce('async function createPet() {}');
      
      const result = await ControllerGenerator.generateControllerContent(
        'pets',
        'Pet',
        pathGroup,
        mockDbAdapter
      );
      
      expect(result).toContain('async function getPets() {}');
      expect(result).toContain('async function createPet() {}');
      expect(result).toContain('module.exports = {\n  getPets,\n  createPet\n};');
    });
  });

  describe('generateControllers', () => {
    it('should process each resource in spec', async () => {
      await ControllerGenerator.generateControllers('/controllers', crudSpec, mockDbAdapter);
      
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should normalize resource names using NameGenerator', async () => {
      await ControllerGenerator.generateControllers('/controllers', simpleSpec, mockDbAdapter);
      
      expect(NameGenerator.toCamelCase).toHaveBeenCalledWith('users');
    });

    it('should generate model names using NameGenerator', async () => {
      await ControllerGenerator.generateControllers('/controllers', simpleSpec, mockDbAdapter);
      
      expect(NameGenerator.toModelName).toHaveBeenCalledWith('users');
    });

    it('should write controller file with correct path', async () => {
      NameGenerator.toCamelCase.mockReturnValue('pets');
      
      await ControllerGenerator.generateControllers('/controllers', simpleSpec, mockDbAdapter);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/controllers', 'pets.controller.js'),
        expect.any(String),
        'utf8'
      );
    });

    it('should write generated content to file', async () => {
      const mockContent = 'controller content';
      jest.spyOn(ControllerGenerator, 'generateControllerContent').mockResolvedValue(mockContent);
      
      await ControllerGenerator.generateControllers('/controllers', simpleSpec, mockDbAdapter);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        mockContent,
        'utf8'
      );
    });

    it('should process multiple resources', async () => {
      await ControllerGenerator.generateControllers('/controllers', multiResourceSpec, mockDbAdapter);
      
      expect(fs.writeFile).toHaveBeenCalledTimes(2); // users and posts
    });

    it('should propagate errors from file writing', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      await expect(
        ControllerGenerator.generateControllers('/controllers', simpleSpec, mockDbAdapter)
      ).rejects.toThrow('Write failed');
    });
  });
});

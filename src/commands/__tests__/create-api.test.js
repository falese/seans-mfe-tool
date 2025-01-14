// src/commands/__tests__/create-api.test.js
const fs = require('fs-extra');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { createApiCommand } = require('../create-api');
const { 
  mockProcessExit, 
  mockConsole, 
  setupCommonMocks,
  mockFs,
  mockExec,
  expectProcessExit,
  createTestData
} = require('./test-utils');

// Mock external modules
jest.mock('@apidevtools/swagger-parser', () => ({
  parse: jest.fn(),
  dereference: jest.fn()
}));

describe('Create API Command', () => {
  mockProcessExit();
  mockConsole();
  setupCommonMocks();

  beforeEach(() => {
    // Setup basic API spec
    const mockSpec = createTestData.apiSpec({
      '/test': {
        get: {
          operationId: 'getTest',
          responses: { '200': { description: 'Success' } }
        }
      }
    });

    // Mock SwaggerParser
    SwaggerParser.parse.mockResolvedValue(mockSpec);
    SwaggerParser.dereference.mockResolvedValue(mockSpec);

    // Mock template content
    mockFs.readFile.mockImplementation(async (filePath) => {
      if (filePath.includes('package.json')) {
        return JSON.stringify(createTestData.packageJson());
      }
      return 'template content';
    });
  });

  describe('Basic Functionality', () => {
    it('should create API with SQLite database', async () => {
      await expectProcessExit(async () => {
        await createApiCommand('test-api', {
          port: '3001',
          database: 'sqlite',
          spec: 'api.yaml'
        });

        // Verify directory structure
        expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('test-api'));
        expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('src/controllers'));
        expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('src/routes'));
        expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('src/models'));

        // Verify file creation
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('database.js'),
          expect.stringContaining('sqlite'),
          expect.any(String)
        );
      });
    });

    it('should create API with MongoDB database', async () => {
      await expectProcessExit(async () => {
        await createApiCommand('test-api', {
          port: '3001',
          database: 'mongodb',
          spec: 'api.yaml'
        });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('package.json'),
          expect.stringContaining('mongoose'),
          expect.any(String)
        );
      });
    });
  });

  describe('API Generation', () => {
    it('should generate controllers from OpenAPI spec', async () => {
      const mockSpec = createTestData.apiSpec({
        '/users': {
          get: {
            operationId: 'getUsers',
            responses: { '200': { description: 'Success' } }
          },
          post: {
            operationId: 'createUser',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      });

      SwaggerParser.parse.mockResolvedValue(mockSpec);
      SwaggerParser.dereference.mockResolvedValue(mockSpec);

      await expectProcessExit(async () => {
        await createApiCommand('test-api', {
          port: '3001',
          database: 'sqlite',
          spec: 'api.yaml'
        });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('users.controller.js'),
          expect.stringContaining('getUsers'),
          expect.any(String)
        );
      });
    });

    it('should generate database models from OpenAPI spec', async () => {
      const mockSpec = createTestData.apiSpec({
        '/users': {
          get: { operationId: 'getUsers' }
        }
      });
      mockSpec.components = {
        schemas: {
          User: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' }
            }
          }
        }
      };

      SwaggerParser.parse.mockResolvedValue(mockSpec);
      SwaggerParser.dereference.mockResolvedValue(mockSpec);

      await expectProcessExit(async () => {
        await createApiCommand('test-api', {
          port: '3001',
          database: 'mongodb',
          spec: 'api.yaml'
        });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('User.model.js'),
          expect.stringContaining('mongoose'),
          expect.any(String)
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should validate database type', async () => {
      await expect(createApiCommand('test-api', {
        port: '3001',
        database: 'invalid',
        spec: 'api.yaml'
      })).rejects.toThrow(/Unsupported database/);
    });

    it('should handle OpenAPI spec parsing errors', async () => {
      SwaggerParser.parse.mockRejectedValue(new Error('Invalid spec'));

      await expect(createApiCommand('test-api', {
        port: '3001',
        database: 'sqlite',
        spec: 'invalid.yaml'
      })).rejects.toThrow(/Failed to parse OpenAPI spec/);
    });

    it('should handle file system errors', async () => {
      mockFs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      await expect(createApiCommand('test-api', {
        port: '3001',
        database: 'sqlite',
        spec: 'api.yaml'
      })).rejects.toThrow(/Permission denied/);
    });

    it('should validate port number', async () => {
      await expect(createApiCommand('test-api', {
        port: 'invalid',
        database: 'sqlite',
        spec: 'api.yaml'
      })).rejects.toThrow(/Invalid port/);
    });
  });

  describe('Template Processing', () => {
    it('should process environment variables', async () => {
      await expectProcessExit(async () => {
        await createApiCommand('test-api', {
          port: '3001',
          database: 'sqlite',
          spec: 'api.yaml'
        });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('.env'),
          expect.stringContaining('PORT=3001'),
          expect.any(String)
        );
      });
    });

    it('should process package.json', async () => {
      await expectProcessExit(async () => {
        await createApiCommand('test-api', {
          port: '3001',
          database: 'mongodb',
          spec: 'api.yaml'
        });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('package.json'),
          expect.stringContaining('"name": "test-api"'),
          expect.any(String)
        );
      });
    });
  });
});
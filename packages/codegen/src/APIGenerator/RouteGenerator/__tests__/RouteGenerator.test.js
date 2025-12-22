const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { RouteGenerator } = require('../RouteGenerator');
const { PathGenerator } = require('../../utils/PathGenerator');
const { SchemaGenerator } = require('../../utils/SchemaGenerator');
const { NameGenerator } = require('../../utils/NameGenerator');
const { simpleSpec, petStoreSpec } = require('./fixtures/openapi-specs');

// Mock all dependencies
jest.mock('fs-extra');
jest.mock('chalk', () => ({
  blue: jest.fn(text => text),
  yellow: jest.fn(text => text),
  green: jest.fn(text => text),
  red: jest.fn(text => text)
}));
jest.mock('../../utils/PathGenerator');
jest.mock('../../utils/SchemaGenerator');

describe('RouteGenerator', () => {
  const testRoutesDir = '/test/routes';

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks
    fs.ensureDir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    
    PathGenerator.generatePathContent.mockReturnValue({
      operationMap: { getUsers: true, createUser: true },
      validationSchemas: ['const createUserBodySchema = Joi.object({});'],
      routes: ["router.get('/', getUsers);", "router.post('/', createUser);"]
    });
  });

  describe('generate', () => {
    it('should generate routes for valid OpenAPI spec', async () => {
      await RouteGenerator.generate(testRoutesDir, simpleSpec);

      expect(fs.ensureDir).toHaveBeenCalledWith(testRoutesDir);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle spec without paths', async () => {
      const emptySpec = { openapi: '3.0.0', info: {} };
      
      await RouteGenerator.generate(testRoutesDir, emptySpec);

      // Should return early without creating directories or files
      expect(fs.ensureDir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should generate route files for each resource', async () => {
      const spec = {
        paths: {
          '/users': { get: {}, post: {} },
          '/users/{id}': { get: {}, put: {} },
          '/posts': { get: {}, post: {} }
        }
      };

      await RouteGenerator.generate(testRoutesDir, spec);

      // Should generate 3 files: users.route.js, posts.route.js, index.js
      expect(fs.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should create index file with all routes', async () => {
      const spec = {
        paths: {
          '/users': { get: {} },
          '/posts': { get: {} }
        }
      };

      await RouteGenerator.generate(testRoutesDir, spec);

      /** @type {jest.Mock} */
      const writeFileMock = fs.writeFile;
      const indexCall = writeFileMock.mock.calls.find(
        call => call[0] === path.join(testRoutesDir, 'index.js')
      );
      expect(indexCall).toBeDefined();
      expect(indexCall[1]).toContain("require('./users.route')");
      expect(indexCall[1]).toContain("require('./posts.route')");
    });

    it('should throw error if file writing fails', async () => {
      fs.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      await expect(RouteGenerator.generate(testRoutesDir, simpleSpec))
        .rejects.toThrow('Write failed');
    });

    it('should handle resources with multiple paths', async () => {
      const spec = {
        paths: {
          '/users': { get: {}, post: {} },
          '/users/{id}': { get: {}, put: {}, delete: {} },
          '/users/{id}/profile': { get: {}, patch: {} }
        }
      };

      await RouteGenerator.generate(testRoutesDir, spec);

      // Should only generate 1 resource file + index
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateRouteFile', () => {
    it('should generate complete route file content', () => {
      const paths = [
        ['/users', { get: {}, post: {} }],
        ['/users/{id}', { get: {}, put: {} }]
      ];

      PathGenerator.generatePathContent.mockReturnValue({
        operationMap: { getUsers: true, createUser: true },
        validationSchemas: ['const createUserBodySchema = Joi.object({});'],
        routes: ["router.get('/', getUsers);", "router.post('/', createUser);"]
      });

      const result = RouteGenerator.generateRouteFile(paths, 'users', simpleSpec);

      expect(result).toContain("const express = require('express');");
      expect(result).toContain("const { getUsers, createUser } = require('../controllers/users.controller');");
      expect(result).toContain("const { validateSchema } = require('../middleware/validator');");
      expect(result).toContain("const { auth } = require('../middleware/auth');");
      expect(result).toContain("const Joi = require('joi');");
      expect(result).toContain("const router = express.Router();");
      expect(result).toContain("const createUserBodySchema = Joi.object({});");
      expect(result).toContain("router.get('/', getUsers);");
      expect(result).toContain("router.post('/', createUser);");
      expect(result).toContain("module.exports = router;");
    });

    it('should handle routes without validation schemas', () => {
      const paths = [['/users', { get: {} }]];

      PathGenerator.generatePathContent.mockReturnValue({
        operationMap: { getUsers: true },
        validationSchemas: [],
        routes: ["router.get('/', getUsers);"]
      });

      const result = RouteGenerator.generateRouteFile(paths, 'users', simpleSpec);

      expect(result).toContain("router.get('/', getUsers);");
      expect(result).toContain("module.exports = router;");
    });

    it('should call PathGenerator with correct arguments', () => {
      const paths = [['/users', { get: {} }]];
      
      RouteGenerator.generateRouteFile(paths, 'users', simpleSpec);

      expect(PathGenerator.generatePathContent).toHaveBeenCalledWith(
        paths,
        'users',
        simpleSpec
      );
    });

    it('should generate correct controller import path', () => {
      const paths = [['/user-profiles', { get: {} }]];

      PathGenerator.generatePathContent.mockReturnValue({
        operationMap: { getUserProfiles: true },
        validationSchemas: [],
        routes: ["router.get('/', getUserProfiles);"]
      });

      const result = RouteGenerator.generateRouteFile(paths, 'userProfiles', simpleSpec);

      expect(result).toContain("const { getUserProfiles } = require('../controllers/userProfiles.controller');");
    });

    it('should handle multiple operations in operationMap', () => {
      const paths = [['/users', { get: {}, post: {}, put: {}, delete: {} }]];

      PathGenerator.generatePathContent.mockReturnValue({
        operationMap: { getUsers: true, createUser: true, updateUser: true, deleteUser: true },
        validationSchemas: [],
        routes: [
          "router.get('/', getUsers);",
          "router.post('/', createUser);",
          "router.put('/:id', updateUser);",
          "router.delete('/:id', deleteUser);"
        ]
      });

      const result = RouteGenerator.generateRouteFile(paths, 'users', simpleSpec);

      expect(result).toContain("const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/users.controller');");
    });
  });

  describe('generateIndexFile', () => {
    it('should generate index file with routes', async () => {
      const routes = [
        { name: 'users', path: '/users', camelName: 'users' },
        { name: 'posts', path: '/posts', camelName: 'posts' }
      ];

      await RouteGenerator.generateIndexFile(testRoutesDir + '/index.js', routes);

      expect(fs.writeFile).toHaveBeenCalledWith(
        testRoutesDir + '/index.js',
        expect.stringContaining("require('./users.route')"),
        'utf8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        testRoutesDir + '/index.js',
        expect.stringContaining("require('./posts.route')"),
        'utf8'
      );
    });

    it('should include request logging middleware', async () => {
      const routes = [{ name: 'users', path: '/users', camelName: 'users' }];

      await RouteGenerator.generateIndexFile(testRoutesDir + '/index.js', routes);

      /** @type {jest.Mock} */
      const writeFileMock = fs.writeFile;
      const content = writeFileMock.mock.calls[0][1];
      expect(content).toContain("const { createLogger } = require('@seans-mfe-tool/logger');");
      expect(content).toContain('router.use((req, res, next)');
      expect(content).toContain('req.requestId');
      expect(content).toContain('logger.info');
    });

    it('should handle empty routes array', async () => {
      await RouteGenerator.generateIndexFile(testRoutesDir + '/index.js', []);

      expect(fs.writeFile).toHaveBeenCalledWith(
        testRoutesDir + '/index.js',
        expect.stringContaining("const express = require('express');"),
        'utf8'
      );
    });

    it('should mount routes with correct paths', async () => {
      const routes = [
        { name: 'users', path: '/users', camelName: 'users' },
        { name: 'userProfiles', path: '/user-profiles', camelName: 'userProfiles' }
      ];

      await RouteGenerator.generateIndexFile(testRoutesDir + '/index.js', routes);

      /** @type {jest.Mock} */
      const writeFileMock = fs.writeFile;
      const content = writeFileMock.mock.calls[0][1];
      expect(content).toContain("// Mount /users routes");
      expect(content).toContain("// Mount /user-profiles routes");
    });

    it('should export router module', async () => {
      const routes = [{ name: 'users', path: '/users', camelName: 'users' }];

      await RouteGenerator.generateIndexFile(testRoutesDir + '/index.js', routes);

      /** @type {jest.Mock} */
      const writeFileMock = fs.writeFile;
      const content = writeFileMock.mock.calls[0][1];
      expect(content).toContain('module.exports = router;');
    });
  });

  describe('groupPathsByResource', () => {
    it('should group paths by first segment', () => {
      const paths = {
        '/users': { get: {} },
        '/users/{id}': { put: {} },
        '/posts': { get: {} },
        '/posts/{id}': { delete: {} }
      };

      const result = RouteGenerator.groupPathsByResource(paths);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('posts');
      expect(result.users).toHaveLength(2);
      expect(result.posts).toHaveLength(2);
    });

    it('should handle single resource with multiple paths', () => {
      const paths = {
        '/users': { get: {}, post: {} },
        '/users/{id}': { get: {}, put: {}, delete: {} },
        '/users/{id}/profile': { get: {}, patch: {} }
      };

      const result = RouteGenerator.groupPathsByResource(paths);

      expect(Object.keys(result)).toEqual(['users']);
      expect(result.users).toHaveLength(3);
    });

    it('should skip paths without resource segment', () => {
      const paths = {
        '/': { get: {} },
        '/users': { get: {} }
      };

      const result = RouteGenerator.groupPathsByResource(paths);

      expect(result).not.toHaveProperty('');
      expect(result).toHaveProperty('users');
    });

    it('should preserve operations for each path', () => {
      const paths = {
        '/users': { get: { operationId: 'getUsers' }, post: { operationId: 'createUser' } },
        '/users/{id}': { get: { operationId: 'getUserById' } }
      };

      const result = RouteGenerator.groupPathsByResource(paths);

      expect(result.users[0]).toEqual(['/users', paths['/users']]);
      expect(result.users[1]).toEqual(['/users/{id}', paths['/users/{id}']]);
    });

    it('should handle empty paths object', () => {
      const result = RouteGenerator.groupPathsByResource({});

      expect(result).toEqual({});
    });

    it('should handle paths with query parameters in key', () => {
      const paths = {
        '/users?limit=10': { get: {} },
        '/users/{id}': { get: {} }
      };

      const result = RouteGenerator.groupPathsByResource(paths);

      // Query parameters in path key would cause empty resource (not standard OpenAPI)
      // Only /users/{id} should be grouped
      expect(result).toHaveProperty('users');
      expect(result.users).toHaveLength(1); // Only the valid path
    });

    it('should handle kebab-case resource names', () => {
      const paths = {
        '/user-profiles': { get: {} },
        '/user-profiles/{id}': { put: {} }
      };

      const result = RouteGenerator.groupPathsByResource(paths);

      expect(result).toHaveProperty('user-profiles');
      expect(result['user-profiles']).toHaveLength(2);
    });
  });
});

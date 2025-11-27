const { ResourceMapper } = require('../ResourceMapper');
const { NameGenerator } = require('../NameGenerator');

describe('ResourceMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new ResourceMapper();
  });

  describe('constructor', () => {
    it('should create instance without errors', () => {
      expect(mapper).toBeDefined();
      expect(mapper.mapResources).toBeDefined();
    });
  });

  describe('mapResources', () => {
    it('should map single resource with one operation', () => {
      const spec = {
        paths: {
          '/users': {
            get: {
              summary: 'Get all users',
              operationId: 'getUsers'
            }
          }
        }
      };

      const result = mapper.mapResources(spec);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('should map multiple paths for same resource', () => {
      const spec = {
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
            post: { operationId: 'createUser' }
          },
          '/users/{id}': {
            get: { operationId: 'getUserById' },
            put: { operationId: 'updateUser' }
          }
        }
      };

      const result = mapper.mapResources(spec);

      expect(result.size).toBe(1);
      const users = result.get('users');
      expect(users.paths).toHaveLength(2);
    });

    it('should map multiple different resources', () => {
      const spec = {
        paths: {
          '/users': { get: {} },
          '/posts': { get: {} },
          '/comments': { get: {} }
        }
      };

      const result = mapper.mapResources(spec);

      expect(result.size).toBe(3);
      expect(result.has('users')).toBe(true);
      expect(result.has('posts')).toBe(true);
      expect(result.has('comments')).toBe(true);
    });

    it('should clean operations by removing parameters', () => {
      const spec = {
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
            parameters: [{ name: 'limit', in: 'query' }]
          }
        }
      };

      const result = mapper.mapResources(spec);
      const users = result.get('users');
      const operations = users.paths[0].operations;

      expect(operations.get).toBeDefined();
      expect(operations.parameters).toBeUndefined();
    });

    it('should include routePath in mapped data', () => {
      const spec = {
        paths: {
          '/users': { get: {} }
        }
      };

      const result = mapper.mapResources(spec);
      const users = result.get('users');

      expect(users.paths[0].routePath).toBeDefined();
    });

    it('should include controllerName in mapped data', () => {
      const spec = {
        paths: {
          '/users': { get: {} }
        }
      };

      const result = mapper.mapResources(spec);
      const users = result.get('users');

      expect(users.paths[0].controllerName).toBe('usersController');
    });

    it('should include routerName in mapped data', () => {
      const spec = {
        paths: {
          '/users': { get: {} }
        }
      };

      const result = mapper.mapResources(spec);
      const users = result.get('users');

      expect(users.paths[0].routerName).toBe('users');
    });

    it('should handle kebab-case resource names', () => {
      const spec = {
        paths: {
          '/user-profiles': { get: {} }
        }
      };

      const result = mapper.mapResources(spec);

      expect(result.has('userProfiles')).toBe(true);
    });

    it('should handle empty paths object', () => {
      const spec = { paths: {} };

      const result = mapper.mapResources(spec);

      expect(result.size).toBe(0);
    });
  });

  describe('getResourceName', () => {
    it('should extract resource from simple path', () => {
      const result = mapper.getResourceName('/users');

      expect(result).toBe('users');
    });

    it('should extract resource from path with ID', () => {
      const result = mapper.getResourceName('/users/{id}');

      expect(result).toBe('users');
    });

    it('should extract resource from nested path', () => {
      const result = mapper.getResourceName('/users/{id}/posts');

      expect(result).toBe('users');
    });

    it('should convert kebab-case to camelCase', () => {
      const result = mapper.getResourceName('/user-profiles');

      expect(result).toBe('userProfiles');
    });

    it('should handle root path', () => {
      const result = mapper.getResourceName('/');

      expect(result).toBe('');
    });

    it('should handle path with query parameters notation', () => {
      const result = mapper.getResourceName('/users?limit=10');

      expect(result).toBe('users');
    });
  });

  describe('cleanOperations', () => {
    it('should preserve standard HTTP methods', () => {
      const operations = {
        get: { operationId: 'getUser' },
        post: { operationId: 'createUser' },
        put: { operationId: 'updateUser' },
        delete: { operationId: 'deleteUser' }
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(result.get).toBeDefined();
      expect(result.post).toBeDefined();
      expect(result.put).toBeDefined();
      expect(result.delete).toBeDefined();
    });

    it('should remove parameters field', () => {
      const operations = {
        get: { operationId: 'getUser' },
        parameters: [{ name: 'id', in: 'path' }]
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(result.get).toBeDefined();
      expect(result.parameters).toBeUndefined();
    });

    it('should add controllerMethod to each operation', () => {
      const operations = {
        get: { operationId: 'getUsers' }
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(result.get.controllerMethod).toBeDefined();
    });

    it('should add routeMethod to each operation', () => {
      const operations = {
        get: { operationId: 'getUsers' }
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(result.get.routeMethod).toBeDefined();
    });

    it('should preserve original operation properties', () => {
      const operations = {
        get: { 
          operationId: 'getUsers',
          summary: 'Get all users',
          description: 'Returns a list of users',
          responses: { 200: { description: 'Success' } }
        }
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(result.get.operationId).toBe('getUsers');
      expect(result.get.summary).toBe('Get all users');
      expect(result.get.description).toBe('Returns a list of users');
      expect(result.get.responses).toBeDefined();
    });

    it('should handle empty operations object', () => {
      const operations = {};

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle operations with only parameters', () => {
      const operations = {
        parameters: [{ name: 'id', in: 'path' }]
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle PATCH method', () => {
      const operations = {
        patch: { operationId: 'patchUser' }
      };

      const result = mapper.cleanOperations(operations, 'users', '/users/{id}');

      expect(result.patch).toBeDefined();
      expect(result.patch.controllerMethod).toBeDefined();
    });

    it('should handle OPTIONS method', () => {
      const operations = {
        options: { operationId: 'optionsUser' }
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(result.options).toBeDefined();
    });

    it('should handle HEAD method', () => {
      const operations = {
        head: { operationId: 'headUser' }
      };

      const result = mapper.cleanOperations(operations, 'users', '/users');

      expect(result.head).toBeDefined();
    });
  });
});

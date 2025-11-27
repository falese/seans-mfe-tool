const { PathGenerator } = require('../generators/PathGenerator');
const { SchemaGenerator } = require('../generators/SchemaGenerator');
const { NameGenerator } = require('../../generators/NameGenerator');
const { simpleSpec, petStoreSpec, operationExamples } = require('./fixtures/openapi-specs');

// Mock SchemaGenerator since we're testing PathGenerator in isolation
jest.mock('../generators/SchemaGenerator');

describe('PathGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock implementations
    SchemaGenerator.generateValidationSchema.mockReturnValue('');
    SchemaGenerator.getSchemaName.mockImplementation((op, type) => `${op.operationId || 'unknown'}${type.charAt(0).toUpperCase() + type.slice(1)}Schema`);
  });

  describe('generatePathContent', () => {
    it('should generate complete path content with operations, schemas, and routes', () => {
      const paths = [
        ['/users', {
          get: { operationId: 'getUsers', responses: {} },
          post: { operationId: 'createUser', requestBody: {}, responses: {} }
        }]
      ];

      SchemaGenerator.generateValidationSchema
        .mockReturnValueOnce('') // getUsers has no validation
        .mockReturnValueOnce('const createUserBodySchema = Joi.object({});'); // createUser has body validation

      const result = PathGenerator.generatePathContent(paths, 'users', 'UserController', simpleSpec);

      expect(result).toHaveProperty('operationMap');
      expect(result).toHaveProperty('validationSchemas');
      expect(result).toHaveProperty('routes');
      expect(result.operationMap).toEqual({ getUsers: true, createUser: true });
      expect(result.validationSchemas).toHaveLength(1);
      expect(result.routes).toHaveLength(2);
    });

    it('should handle multiple paths with multiple operations', () => {
      const paths = [
        ['/users', {
          get: { operationId: 'getUsers', responses: {} },
          post: { operationId: 'createUser', responses: {} }
        }],
        ['/users/{id}', {
          get: { operationId: 'getUserById', responses: {} },
          put: { operationId: 'updateUser', responses: {} }
        }]
      ];

      const result = PathGenerator.generatePathContent(paths, 'users', 'UserController', simpleSpec);

      expect(Object.keys(result.operationMap)).toHaveLength(4);
      expect(result.routes).toHaveLength(4);
    });

    it('should skip operations without validation schemas', () => {
      const paths = [
        ['/users', {
          get: { operationId: 'getUsers', responses: {} },
          post: { operationId: 'createUser', responses: {} }
        }]
      ];

      SchemaGenerator.generateValidationSchema.mockReturnValue(''); // No validation

      const result = PathGenerator.generatePathContent(paths, 'users', 'UserController', simpleSpec);

      expect(result.validationSchemas).toHaveLength(0);
    });

    it('should filter out parameters property from path operations', () => {
      const paths = [
        ['/users/{id}', {
          parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
          get: { operationId: 'getUserById', responses: {} }
        }]
      ];

      const result = PathGenerator.generatePathContent(paths, 'users', 'UserController', simpleSpec);

      expect(Object.keys(result.operationMap)).toEqual(['getUserById']);
      expect(result.routes).toHaveLength(1);
    });

    it('should handle paths with parameters key in pathOperations object', () => {
      // Edge case: parameters key appears twice (path-level and operation-level)
      const paths = [
        ['/users/{id}', {
          parameters: [{ name: 'id', in: 'path' }],
          get: { operationId: 'getUser', responses: {} },
          parameters: [{ name: 'id2', in: 'path' }] // Duplicate key (last one wins in JS objects)
        }]
      ];

      const result = PathGenerator.generatePathContent(paths, 'users', 'UserController', simpleSpec);

      expect(Object.keys(result.operationMap)).toEqual(['getUser']);
      expect(result.routes).toHaveLength(1);
    });

    it('should handle empty paths array', () => {
      const result = PathGenerator.generatePathContent([], 'users', 'UserController', simpleSpec);

      expect(result.operationMap).toEqual({});
      expect(result.validationSchemas).toEqual([]);
      expect(result.routes).toEqual([]);
    });
  });

  describe('generateMethodName', () => {
    describe('collection paths (no path parameters)', () => {
      it('should generate getAllResource for GET', () => {
        const result = PathGenerator.generateMethodName('get', 'users', '/users', {});
        expect(result).toBe('getAllUsers');
      });

      it('should generate createResource for POST', () => {
        const result = PathGenerator.generateMethodName('post', 'users', '/users', {});
        expect(result).toBe('createUsers');
      });

      it('should generate methodResource for other methods', () => {
        expect(PathGenerator.generateMethodName('delete', 'users', '/users', {})).toBe('deleteUsers');
        expect(PathGenerator.generateMethodName('patch', 'users', '/users', {})).toBe('patchUsers');
      });
    });

    describe('item paths (with path parameters)', () => {
      it('should generate getResourceById for GET', () => {
        const result = PathGenerator.generateMethodName('get', 'users', '/users/{id}', {});
        expect(result).toBe('getUsersById');
      });

      it('should generate updateResource for PUT', () => {
        const result = PathGenerator.generateMethodName('put', 'users', '/users/{id}', {});
        expect(result).toBe('updateUsers');
      });

      it('should generate patchResource for PATCH', () => {
        const result = PathGenerator.generateMethodName('patch', 'users', '/users/{id}', {});
        expect(result).toBe('patchUsers');
      });

      it('should generate deleteResource for DELETE', () => {
        const result = PathGenerator.generateMethodName('delete', 'users', '/users/{id}', {});
        expect(result).toBe('deleteUsers');
      });

      it('should generate methodResourceById for other methods', () => {
        const result = PathGenerator.generateMethodName('options', 'users', '/users/{id}', {});
        expect(result).toBe('optionsUsersById');
      });
    });

    describe('operationId override', () => {
      it('should use operationId when present', () => {
        const operation = { operationId: 'customFetchUser' };
        const result = PathGenerator.generateMethodName('get', 'users', '/users/{id}', operation);
        expect(result).toBe('customFetchUser');
      });

      it('should convert operationId to camelCase', () => {
        const operation = { operationId: 'CustomFetchUser' };
        const result = PathGenerator.generateMethodName('get', 'users', '/users/{id}', operation);
        expect(result).toBe('customFetchUser');
      });
    });

    describe('resource name formatting', () => {
      it('should handle kebab-case resource names', () => {
        const result = PathGenerator.generateMethodName('get', 'user-profiles', '/user-profiles/{id}', {});
        expect(result).toBe('getUserProfilesById');
      });

      it('should handle snake_case resource names', () => {
        const result = PathGenerator.generateMethodName('get', 'user_profiles', '/user_profiles/{id}', {});
        expect(result).toBe('getUserProfilesById');
      });
    });
  });

  describe('generateRoute', () => {
    it('should generate simple route without middleware', () => {
      const result = PathGenerator.generateRoute('get', '/users', 'getUsers', {}, 'users');
      expect(result).toBe("router.get('/', getUsers);");
    });

    it('should generate route with middleware', () => {
      const operation = { security: [{ bearerAuth: [] }] };
      const result = PathGenerator.generateRoute('get', '/users', 'getUsers', operation, 'users');
      expect(result).toBe("router.get('/', auth(), getUsers);");
    });

    it('should generate route with multiple middleware', () => {
      SchemaGenerator.getSchemaName.mockReturnValue('createUserBodySchema');
      const operation = {
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': {} } }
      };
      const result = PathGenerator.generateRoute('post', '/users', 'createUser', operation, 'users');
      expect(result).toBe("router.post('/', auth(), validateSchema('body', createUserBodySchema), createUser);");
    });

    it('should normalize path with parameters', () => {
      const result = PathGenerator.generateRoute('get', '/users/{id}', 'getUserById', {}, 'users');
      expect(result).toBe("router.get('/:id', getUserById);");
    });

    it('should handle nested paths', () => {
      const result = PathGenerator.generateRoute('get', '/users/{id}/posts/{postId}', 'getUserPost', {}, 'users');
      expect(result).toBe("router.get('/:id/posts/:postId', getUserPost);");
    });

    it('should handle different HTTP methods', () => {
      expect(PathGenerator.generateRoute('post', '/users', 'createUser', {}, 'users')).toContain("router.post");
      expect(PathGenerator.generateRoute('put', '/users/{id}', 'updateUser', {}, 'users')).toContain("router.put");
      expect(PathGenerator.generateRoute('delete', '/users/{id}', 'deleteUser', {}, 'users')).toContain("router.delete");
      expect(PathGenerator.generateRoute('patch', '/users/{id}', 'patchUser', {}, 'users')).toContain("router.patch");
    });
  });

  describe('normalizeRoutePath', () => {
    it('should strip resource prefix from path', () => {
      const result = PathGenerator.normalizeRoutePath('/users', 'users');
      expect(result).toBe('/');
    });

    it('should convert path parameters to Express format', () => {
      const result = PathGenerator.normalizeRoutePath('/users/{id}', 'users');
      expect(result).toBe('/:id');
    });

    it('should handle nested resource paths', () => {
      const result = PathGenerator.normalizeRoutePath('/users/{id}/posts', 'users');
      expect(result).toBe('/:id/posts');
    });

    it('should handle multiple path parameters', () => {
      const result = PathGenerator.normalizeRoutePath('/users/{userId}/posts/{postId}', 'users');
      expect(result).toBe('/:userId/posts/:postId');
    });

    it('should handle paths without resource prefix', () => {
      const result = PathGenerator.normalizeRoutePath('/{id}', 'users');
      expect(result).toBe('/:id'); // Still converts parameter format
    });

    it('should return / when path equals resource prefix', () => {
      const result = PathGenerator.normalizeRoutePath('/users', 'users');
      expect(result).toBe('/');
    });

    it('should handle complex parameter names', () => {
      const result = PathGenerator.normalizeRoutePath('/users/{user_id}/posts/{post-id}', 'users');
      expect(result).toBe('/:user_id/posts/:post-id');
    });
  });

  describe('generateMiddleware', () => {
    it('should return empty array for operation without security or validation', () => {
      const result = PathGenerator.generateMiddleware({});
      expect(result).toEqual([]);
    });

    it('should add auth middleware for operations with security', () => {
      const operation = { security: [{ bearerAuth: [] }] };
      const result = PathGenerator.generateMiddleware(operation);
      expect(result).toContain('auth()');
    });

    it('should add body validation middleware for requestBody', () => {
      SchemaGenerator.getSchemaName.mockReturnValue('createUserBodySchema');
      const operation = { requestBody: { content: { 'application/json': {} } } };
      const result = PathGenerator.generateMiddleware(operation);
      expect(result).toContain("validateSchema('body', createUserBodySchema)");
    });

    it('should add params validation middleware for path parameters', () => {
      SchemaGenerator.getSchemaName.mockReturnValue('getUserParamsSchema');
      const operation = {
        parameters: [
          { name: 'id', in: 'path', schema: { type: 'string' } }
        ]
      };
      const result = PathGenerator.generateMiddleware(operation);
      expect(result).toContain("validateSchema('params', getUserParamsSchema)");
    });

    it('should add query validation middleware for query parameters', () => {
      SchemaGenerator.getSchemaName.mockReturnValue('getUsersQuerySchema');
      const operation = {
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ]
      };
      const result = PathGenerator.generateMiddleware(operation);
      expect(result).toContain("validateSchema('query', getUsersQuerySchema)");
    });

    it('should combine multiple middleware in correct order', () => {
      SchemaGenerator.getSchemaName.mockReturnValueOnce('createUserBodySchema')
        .mockReturnValueOnce('createUserParamsSchema')
        .mockReturnValueOnce('createUserQuerySchema');

      const operation = {
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': {} } },
        parameters: [
          { name: 'id', in: 'path', schema: { type: 'string' } },
          { name: 'validate', in: 'query', schema: { type: 'boolean' } }
        ]
      };

      const result = PathGenerator.generateMiddleware(operation);
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('auth()');
      expect(result[1]).toBe("validateSchema('body', createUserBodySchema)");
      expect(result[2]).toBe("validateSchema('params', createUserParamsSchema)");
      expect(result[3]).toBe("validateSchema('query', createUserQuerySchema)");
    });

    it('should skip middleware for parameters that are not path or query', () => {
      const operation = {
        parameters: [
          { name: 'Authorization', in: 'header', schema: { type: 'string' } },
          { name: 'X-Custom', in: 'header', schema: { type: 'string' } }
        ]
      };
      const result = PathGenerator.generateMiddleware(operation);
      expect(result).toEqual([]);
    });

    it('should handle empty parameters array', () => {
      const operation = { parameters: [] };
      const result = PathGenerator.generateMiddleware(operation);
      expect(result).toEqual([]);
    });
  });
});

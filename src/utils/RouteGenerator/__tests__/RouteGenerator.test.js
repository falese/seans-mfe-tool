// src/utils/RouteGenerator/__tests__/PathGenerator.test.js
const { PathGenerator } = require('../generators/PathGenerator');

describe('PathGenerator', () => {
  it('should generate path content', () => {
    const paths = [{
      path: '/users',
      operations: {
        get: {
          operationId: 'getUsers'
        }
      }
    }];
    
    const resourceName = 'users';
    const spec = {
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers'
          }
        }
      }
    };
    
    const { operationMap, validationSchemas, routes } = PathGenerator.generatePathContent(paths, resourceName, spec);
    
    expect(routes).toContain('router.get');
    expect(operationMap).toHaveProperty('getUsers');
  });
});

// src/utils/RouteGenerator/__tests__/SchemaGenerator.test.js
const { SchemaGenerator } = require('../generators/SchemaGenerator');

describe('SchemaGenerator', () => {
  it('should generate validation schema', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' }
      }
    };
    
    const result = SchemaGenerator.generateValidationSchema(schema);
    
    // Verify Joi schema generation
    expect(result).toContain('Joi.object({');
    expect(result).toContain('name: Joi.string()');
    expect(result).toContain('required()');
  });

  it('should handle array type schemas', () => {
    const schema = {
      type: 'array',
      items: {
        type: 'string'
      }
    };
    
    const result = SchemaGenerator.generateValidationSchema(schema);
    expect(result).toContain('Joi.array()');
    expect(result).toContain('items(Joi.string())');
  });
});

// src/utils/RouteGenerator/__tests__/ValidationGenerator.test.js
const { ValidationGenerator } = require('../generators/ValidationGenerator');

describe('ValidationGenerator', () => {
  it('should generate request body validation', () => {
    const operation = {
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
    };
    
    const result = ValidationGenerator.generateValidations(operation);
    expect(result).toContain('validateSchema');
    expect(result).toContain('body');
  });

  it('should generate parameter validation', () => {
    const operation = {
      parameters: [{
        in: 'path',
        name: 'id',
        schema: {
          type: 'string'
        },
        required: true
      }]
    };
    
    const result = ValidationGenerator.generateValidations(operation);
    expect(result).toContain('validateSchema');
    expect(result).toContain('params');
  });
});

// src/utils/RouteGenerator/__tests__/RouteGenerator.test.js
const fs = require('fs-extra');
const { RouteGenerator } = require('../RouteGenerator');

jest.mock('fs-extra');

describe('RouteGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.ensureDir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
  });

  it('should generate routes for empty spec', async () => {
    const spec = { paths: {} };
    const routesDir = '/test/routes';
    
    await RouteGenerator.generate(routesDir, spec);
    
    expect(fs.ensureDir).toHaveBeenCalledWith(routesDir);
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('index.js'),
      expect.any(String)
    );
  });

  it('should generate routes for valid spec', async () => {
    const spec = {
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            responses: {
              '200': {
                description: 'Success'
              }
            }
          }
        }
      }
    };
    
    await RouteGenerator.generate('/test/routes', spec);
    
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('users.route.js'),
      expect.any(String)
    );
  });
});
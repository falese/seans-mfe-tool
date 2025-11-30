// Test fixtures for RouteGenerator tests
// Using simplified versions of real OpenAPI specs from examples/

const simpleSpec = {
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List all users',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
            required: false
          }
        ],
        responses: {
          '200': { description: 'Success' }
        }
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  email: { type: 'string', format: 'email' },
                  age: { type: 'integer', minimum: 0, maximum: 150 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Created' }
        }
      }
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': { description: 'Success' }
        }
      },
      put: {
        operationId: 'updateUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Success' }
        }
      },
      delete: {
        operationId: 'deleteUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: 'No content' }
        }
      }
    }
  }
};

const petStoreSpec = {
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10 }
          }
        ],
        responses: {
          '200': { description: 'A list of pets' }
        }
      },
      post: {
        operationId: 'createPet',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['available', 'pending', 'sold']
                  }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Pet created' }
        }
      }
    },
    '/pets/{petId}': {
      get: {
        operationId: 'getPet',
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': { description: 'Pet found' }
        }
      }
    }
  }
};

// Schema test cases covering all types
const schemaExamples = {
  // String types
  simpleString: { type: 'string' },
  stringWithLength: { type: 'string', minLength: 5, maxLength: 100 },
  stringWithPattern: { type: 'string', pattern: '^[a-z]+$' },
  stringWithEnum: { type: 'string', enum: ['active', 'inactive', 'pending'] },
  stringWithFormat: { type: 'string', format: 'date-time' },
  stringEmail: { type: 'string', format: 'email' },
  
  // Number types
  simpleNumber: { type: 'number' },
  numberWithRange: { type: 'number', minimum: 0, maximum: 100 },
  integer: { type: 'integer' },
  integerWithRange: { type: 'integer', minimum: 1, maximum: 10 },
  
  // Boolean
  simpleBoolean: { type: 'boolean' },
  
  // Arrays
  simpleArray: { type: 'array' },
  arrayWithItems: { type: 'array', items: { type: 'string' } },
  arrayWithRange: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'number' } },
  arrayOfObjects: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      }
    }
  },
  
  // Objects
  simpleObject: { type: 'object' },
  objectWithProperties: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string', minLength: 1 },
      age: { type: 'integer', minimum: 0 }
    }
  },
  nestedObject: {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' }
            }
          }
        }
      }
    }
  },
  
  // References
  refSchema: { $ref: '#/components/schemas/User' },
  
  // Edge cases
  nullSchema: null,
  undefinedSchema: undefined,
  emptyObject: {},
  unknownType: { type: 'unknown-type' }
};

// Operations for testing
const operationExamples = {
  withRequestBody: {
    operationId: 'createResource',
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1 }
            }
          }
        }
      }
    }
  },
  
  withPathParams: {
    operationId: 'getResource',
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' }
      },
      {
        name: 'version',
        in: 'path',
        required: true,
        schema: { type: 'integer' }
      }
    ]
  },
  
  withQueryParams: {
    operationId: 'listResources',
    parameters: [
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100 }
      },
      {
        name: 'offset',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 0 }
      }
    ]
  },
  
  withAllParams: {
    operationId: 'updateResource',
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' }
      },
      {
        name: 'version',
        in: 'query',
        required: false,
        schema: { type: 'integer' }
      }
    ],
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
    },
    security: [{ bearerAuth: [] }]
  },
  
  withNoParams: {
    operationId: 'listAll',
    responses: {
      '200': { description: 'Success' }
    }
  }
};

module.exports = {
  simpleSpec,
  petStoreSpec,
  schemaExamples,
  operationExamples
};

// Test fixtures for ControllerGenerator tests
// Derived from examples/petstore.yaml and examples/cost-benefit-api.yaml

const simpleSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Simple API',
    version: '1.0.0'
  },
  paths: {
    '/users': {
      get: {
        summary: 'List all users',
        operationId: 'listUsers',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'List of users',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/User' } }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    }
  }
};

const crudSpec = {
  openapi: '3.0.0',
  info: {
    title: 'CRUD API',
    version: '1.0.0'
  },
  paths: {
    '/pets': {
      get: {
        summary: 'List all pets',
        operationId: 'listPets',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          '200': {
            description: 'A list of pets',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create a pet',
        operationId: 'createPet',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NewPet' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Pet created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' }
              }
            }
          }
        }
      }
    },
    '/pets/{petId}': {
      get: {
        summary: 'Get pet by id',
        operationId: 'getPet',
        parameters: [
          { name: 'petId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Pet details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' }
              }
            }
          }
        }
      },
      put: {
        summary: 'Update a pet',
        operationId: 'updatePet',
        parameters: [
          { name: 'petId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Pet updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' }
              }
            }
          }
        }
      },
      patch: {
        summary: 'Partially update a pet',
        operationId: 'patchPet',
        parameters: [
          { name: 'petId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Pet patched',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' }
              }
            }
          }
        }
      },
      delete: {
        summary: 'Delete a pet',
        operationId: 'deletePet',
        parameters: [
          { name: 'petId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '204': {
            description: 'Pet deleted'
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          tag: { type: 'string' }
        }
      },
      NewPet: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          tag: { type: 'string' }
        }
      }
    }
  }
};

const multiResourceSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Multi-Resource API',
    version: '1.0.0'
  },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        responses: { '200': { description: 'List of users' } }
      },
      post: {
        operationId: 'createUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } } }
            }
          }
        },
        responses: { '201': { description: 'User created' } }
      }
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'User details' } }
      }
    },
    '/posts': {
      get: {
        operationId: 'listPosts',
        responses: { '200': { description: 'List of posts' } }
      }
    },
    '/posts/{postId}': {
      get: {
        operationId: 'getPost',
        parameters: [
          { name: 'postId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Post details' } }
      },
      delete: {
        operationId: 'deletePost',
        parameters: [
          { name: 'postId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '204': { description: 'Post deleted' } }
      }
    }
  }
};

const complexPathsSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Complex Paths API',
    version: '1.0.0'
  },
  paths: {
    '/organizations/{orgId}/projects/{projectId}': {
      get: {
        operationId: 'getProject',
        parameters: [
          { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'include', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Project details' } }
      },
      put: {
        operationId: 'updateProject',
        parameters: [
          { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Project updated' } }
      }
    }
  }
};

// Operation examples for specific test scenarios
const operationExamples = {
  withPathParams: {
    operationId: 'getUser',
    parameters: [
      { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
    ],
    responses: { '200': { description: 'User details' } }
  },
  withQueryParams: {
    operationId: 'listUsers',
    parameters: [
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
      { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
    ],
    responses: { '200': { description: 'List of users' } }
  },
  withRequestBody: {
    operationId: 'createUser',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'email'],
            properties: {
              name: { type: 'string', minLength: 1 },
              email: { type: 'string', format: 'email' },
              age: { type: 'integer', minimum: 0 }
            }
          }
        }
      }
    },
    responses: { '201': { description: 'User created' } }
  },
  withAllParams: {
    operationId: 'updateUser',
    parameters: [
      { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'notify', in: 'query', schema: { type: 'boolean' } }
    ],
    requestBody: {
      required: true,
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
    responses: { '200': { description: 'User updated' } }
  },
  withNoParams: {
    operationId: 'getHealth',
    responses: { '200': { description: 'Health check' } }
  }
};

module.exports = {
  simpleSpec,
  crudSpec,
  multiResourceSpec,
  complexPathsSpec,
  operationExamples
};

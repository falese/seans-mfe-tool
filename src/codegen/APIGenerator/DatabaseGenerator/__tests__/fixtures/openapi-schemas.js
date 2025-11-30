// Test fixtures for DatabaseGenerator tests
// Comprehensive OpenAPI schemas covering various use cases

const simpleSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Simple Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        required: ['email', 'name'],
        properties: {
          id: {
            type: 'integer',
            description: 'User ID'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com'
          },
          name: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            example: 'John Doe'
          },
          age: {
            type: 'integer',
            minimum: 0,
            maximum: 150
          },
          active: {
            type: 'boolean',
            default: true
          }
        }
      }
    }
  }
};

const complexSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Complex Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      Product: {
        type: 'object',
        required: ['name', 'price', 'category'],
        properties: {
          id: {
            type: 'integer'
          },
          name: {
            type: 'string',
            minLength: 3,
            maxLength: 200
          },
          description: {
            type: 'string',
            description: 'Product description'
          },
          price: {
            type: 'number',
            format: 'float',
            minimum: 0,
            example: 19.99
          },
          category: {
            type: 'string',
            enum: ['electronics', 'clothing', 'food', 'books'],
            example: 'electronics'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['new', 'featured']
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            example: { manufacturer: 'Acme Corp', warranty: '2 years' }
          },
          specifications: {
            type: 'object',
            properties: {
              weight: {
                type: 'number',
                format: 'float'
              },
              dimensions: {
                type: 'object',
                properties: {
                  length: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              }
            }
          },
          inStock: {
            type: 'boolean',
            default: true
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    }
  }
};

const relationshipSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Relationship Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      Author: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          id: {
            type: 'integer'
          },
          name: {
            type: 'string'
          },
          email: {
            type: 'string',
            format: 'email'
          },
          bio: {
            type: 'string'
          }
        }
      },
      Post: {
        type: 'object',
        required: ['title', 'content', 'authorId'],
        properties: {
          id: {
            type: 'integer'
          },
          title: {
            type: 'string',
            minLength: 5,
            maxLength: 200
          },
          content: {
            type: 'string'
          },
          authorId: {
            type: 'integer',
            'x-ref': 'Author',
            description: 'Reference to Author'
          },
          published: {
            type: 'boolean',
            default: false
          },
          publishedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Comment: {
        type: 'object',
        required: ['content', 'postId', 'authorId'],
        properties: {
          id: {
            type: 'integer'
          },
          content: {
            type: 'string'
          },
          postId: {
            type: 'integer',
            'x-ref': 'Post'
          },
          authorId: {
            type: 'integer',
            'x-ref': 'Author'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    }
  }
};

const validationSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Validation Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      Account: {
        type: 'object',
        required: ['email', 'username', 'age'],
        properties: {
          id: {
            type: 'integer'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 20,
            pattern: '^[a-zA-Z0-9_]+$',
            example: 'john_doe'
          },
          website: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com'
          },
          age: {
            type: 'integer',
            minimum: 18,
            maximum: 120
          },
          rating: {
            type: 'number',
            format: 'float',
            minimum: 0.0,
            maximum: 5.0
          },
          role: {
            type: 'string',
            enum: ['admin', 'user', 'moderator'],
            default: 'user'
          },
          preferences: {
            type: 'object',
            properties: {
              theme: {
                type: 'string',
                enum: ['light', 'dark']
              },
              notifications: {
                type: 'boolean',
                default: true
              }
            }
          }
        }
      }
    }
  }
};

const mongoSpecificSchema = {
  openapi: '3.0.0',
  info: {
    title: 'MongoDB Specific Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      Document: {
        type: 'object',
        required: ['title'],
        properties: {
          id: {
            type: 'string'
          },
          _id: {
            type: 'string',
            description: 'MongoDB ObjectId'
          },
          title: {
            type: 'string'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          relatedDocs: {
            type: 'array',
            items: {
              type: 'object',
              'x-ref': 'Document'
            }
          },
          metadata: {
            type: 'object',
            additionalProperties: true
          }
        }
      }
    }
  }
};

const sqliteSpecificSchema = {
  openapi: '3.0.0',
  info: {
    title: 'SQLite Specific Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      Record: {
        type: 'object',
        required: ['title', 'status'],
        properties: {
          id: {
            type: 'integer',
            description: 'Auto-increment primary key'
          },
          title: {
            type: 'string',
            maxLength: 255
          },
          description: {
            type: 'string'
          },
          status: {
            type: 'string',
            enum: ['pending', 'active', 'archived']
          },
          count: {
            type: 'integer',
            minimum: 0
          },
          percentage: {
            type: 'number',
            format: 'float'
          },
          data: {
            type: 'object',
            description: 'JSON column'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    }
  }
};

const emptyPropertiesSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Empty Properties Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      EmptyModel: {
        type: 'object',
        properties: {}
      },
      NoProperties: {
        type: 'object'
      },
      NullProperties: {
        type: 'object',
        properties: null
      }
    }
  }
};

const multiSchemaSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Multi Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      Category: {
        type: 'object',
        required: ['name'],
        properties: {
          id: {
            type: 'integer'
          },
          name: {
            type: 'string',
            example: 'Electronics'
          },
          description: {
            type: 'string'
          }
        }
      },
      Product: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          id: {
            type: 'integer'
          },
          name: {
            type: 'string',
            example: 'Laptop'
          },
          price: {
            type: 'number',
            format: 'float',
            example: 999.99
          },
          categoryId: {
            type: 'integer',
            'x-ref': 'Category'
          }
        }
      },
      Order: {
        type: 'object',
        required: ['total', 'status'],
        properties: {
          id: {
            type: 'integer'
          },
          total: {
            type: 'number',
            format: 'float'
          },
          status: {
            type: 'string',
            enum: ['pending', 'shipped', 'delivered']
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              'x-ref': 'Product'
            }
          }
        }
      }
    }
  }
};

// Spec with examples for seed generation
const examplesSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Examples Schema API',
    version: '1.0.0'
  },
  components: {
    schemas: {
      SampleModel: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1
          },
          name: {
            type: 'string',
            example: 'Sample Name'
          },
          count: {
            type: 'integer',
            example: 100
          },
          price: {
            type: 'number',
            example: 19.99
          },
          active: {
            type: 'boolean',
            example: true
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            examples: [
              ['tag1', 'tag2'],
              ['tag3', 'tag4']
            ]
          },
          type: {
            type: 'string',
            enum: ['type1', 'type2', 'type3']
          }
        }
      }
    }
  }
};

module.exports = {
  simpleSchema,
  complexSchema,
  relationshipSchema,
  validationSchema,
  mongoSpecificSchema,
  sqliteSpecificSchema,
  emptyPropertiesSchema,
  multiSchemaSpec,
  examplesSchema
};

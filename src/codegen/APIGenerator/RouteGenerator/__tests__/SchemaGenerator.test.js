const { SchemaGenerator } = require('../../utils/SchemaGenerator');
const { schemaExamples, operationExamples } = require('./fixtures/openapi-specs');

describe('SchemaGenerator', () => {
  describe('transformSchema', () => {
    describe('string types', () => {
      it('should generate simple string validator', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.simpleString);
        expect(result).toBe('Joi.string()');
      });

      it('should generate string with length constraints', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.stringWithLength);
        expect(result).toBe('Joi.string().min(5).max(100)');
      });

      it('should generate string with pattern', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.stringWithPattern);
        expect(result).toBe('Joi.string().pattern(/^[a-z]+$/)');
      });

      it('should generate string with enum', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.stringWithEnum);
        expect(result).toBe("Joi.string().valid('active', 'inactive', 'pending')");
      });

      it('should generate string with date-time format', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.stringWithFormat);
        expect(result).toBe('Joi.string().isoDate()');
      });

      it('should handle email format', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.stringEmail);
        expect(result).toBe('Joi.string()');
      });

      it('should combine multiple string validations', () => {
        const schema = {
          type: 'string',
          minLength: 2,
          maxLength: 50,
          pattern: '^[A-Za-z]+$'
        };
        const result = SchemaGenerator.transformSchema(schema);
        expect(result).toContain('Joi.string()');
        expect(result).toContain('.min(2)');
        expect(result).toContain('.max(50)');
        expect(result).toContain('.pattern(/^[A-Za-z]+$/)');
      });
    });

    describe('number types', () => {
      it('should generate simple number validator', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.simpleNumber);
        expect(result).toBe('Joi.number()');
      });

      it('should generate number with range', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.numberWithRange);
        expect(result).toBe('Joi.number().min(0).max(100)');
      });

      it('should generate integer validator', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.integer);
        expect(result).toBe('Joi.number().integer()');
      });

      it('should generate integer with range', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.integerWithRange);
        expect(result).toBe('Joi.number().integer().min(1).max(10)');
      });

      it('should handle minimum only', () => {
        const schema = { type: 'number', minimum: 10 };
        const result = SchemaGenerator.transformSchema(schema);
        expect(result).toBe('Joi.number().min(10)');
      });

      it('should handle maximum only', () => {
        const schema = { type: 'number', maximum: 100 };
        const result = SchemaGenerator.transformSchema(schema);
        expect(result).toBe('Joi.number().max(100)');
      });

      it('should handle zero as minimum', () => {
        const schema = { type: 'integer', minimum: 0 };
        const result = SchemaGenerator.transformSchema(schema);
        expect(result).toBe('Joi.number().integer().min(0)');
      });
    });

    describe('boolean types', () => {
      it('should generate boolean validator', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.simpleBoolean);
        expect(result).toBe('Joi.boolean()');
      });
    });

    describe('array types', () => {
      it('should generate simple array validator', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.simpleArray);
        expect(result).toBe('Joi.array()');
      });

      it('should generate array with item type', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.arrayWithItems);
        expect(result).toBe('Joi.array().items(Joi.string())');
      });

      it('should generate array with size constraints', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.arrayWithRange);
        expect(result).toBe('Joi.array().items(Joi.number()).min(1).max(10)');
      });

      it('should generate array of objects', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.arrayOfObjects);
        expect(result).toContain('Joi.array().items(');
        expect(result).toContain('Joi.object(');
      });

      it('should handle minItems only', () => {
        const schema = { type: 'array', minItems: 1 };
        const result = SchemaGenerator.transformSchema(schema);
        expect(result).toBe('Joi.array().min(1)');
      });

      it('should handle maxItems only', () => {
        const schema = { type: 'array', maxItems: 10 };
        const result = SchemaGenerator.transformSchema(schema);
        expect(result).toBe('Joi.array().max(10)');
      });
    });

    describe('object types', () => {
      it('should generate simple object validator', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.simpleObject);
        expect(result).toBe('Joi.object()');
      });

      it('should generate object with properties', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.objectWithProperties);
        expect(result).toContain('Joi.object(');
        expect(result).toContain('"id"');
        expect(result).toContain('"name"');
        expect(result).toContain('"age"');
      });

      it('should handle nested objects', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.nestedObject);
        expect(result).toContain('Joi.object(');
        expect(result).toContain('"user"');
        expect(result).toContain('"address"');
      });

      it('should handle empty properties object', () => {
        const schema = { type: 'object', properties: {} };
        const result = SchemaGenerator.transformSchema(schema);
        expect(result).toBe('Joi.object({})');
      });
    });

    describe('reference types', () => {
      it('should handle $ref schemas', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.refSchema);
        expect(result).toBe('Joi.object()');
      });
    });

    describe('edge cases', () => {
      it('should return null for null schema', () => {
        const result = SchemaGenerator.transformSchema(null);
        expect(result).toBeNull();
      });

      it('should return null for undefined schema', () => {
        const result = SchemaGenerator.transformSchema(undefined);
        expect(result).toBeNull();
      });

      it('should handle empty schema object', () => {
        const result = SchemaGenerator.transformSchema({});
        expect(result).toBe('Joi.any()');
      });

      it('should handle unknown type', () => {
        const result = SchemaGenerator.transformSchema(schemaExamples.unknownType);
        expect(result).toBe('Joi.any()');
      });
    });
  });

  describe('generateRequestBodySchema', () => {
    it('should extract schema from request body', () => {
      const result = SchemaGenerator.generateRequestBodySchema(operationExamples.withRequestBody);
      expect(result).toBe('Joi.object({"name":Joi.string().min(1)})');
    });

    it('should return null for operation without request body', () => {
      const result = SchemaGenerator.generateRequestBodySchema(operationExamples.withNoParams);
      expect(result).toBeNull();
    });

    it('should return null for request body without JSON content', () => {
      const operation = {
        requestBody: {
          content: {
            'text/plain': {
              schema: { type: 'string' }
            }
          }
        }
      };
      const result = SchemaGenerator.generateRequestBodySchema(operation);
      expect(result).toBeNull();
    });

    it('should return null for request body without schema', () => {
      const operation = {
        requestBody: {
          content: {
            'application/json': {}
          }
        }
      };
      const result = SchemaGenerator.generateRequestBodySchema(operation);
      expect(result).toBeNull();
    });
  });

  describe('generateParametersSchema', () => {
    it('should generate schema for path parameters', () => {
      const result = SchemaGenerator.generateParametersSchema(operationExamples.withPathParams);
      expect(result).toHaveProperty('type', 'object');
      expect(result).toHaveProperty('properties');
      expect(result.properties).toHaveProperty('id');
      expect(result.properties).toHaveProperty('version');
      expect(result.required).toEqual(['id', 'version']);
    });

    it('should return null for operation without path parameters', () => {
      const result = SchemaGenerator.generateParametersSchema(operationExamples.withQueryParams);
      expect(result).toBeNull();
    });

    it('should handle optional path parameters', () => {
      const operation = {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: false,
            schema: { type: 'string' }
          }
        ]
      };
      const result = SchemaGenerator.generateParametersSchema(operation);
      expect(result.required).toEqual([]);
    });

    it('should return null for operation without parameters', () => {
      const result = SchemaGenerator.generateParametersSchema(operationExamples.withNoParams);
      expect(result).toBeNull();
    });

    it('should filter out non-path parameters', () => {
      const result = SchemaGenerator.generateParametersSchema(operationExamples.withAllParams);
      expect(result.properties).toHaveProperty('id');
      expect(result.properties).not.toHaveProperty('version'); // version is query param
    });
  });

  describe('generateQuerySchema', () => {
    it('should generate schema for query parameters', () => {
      const result = SchemaGenerator.generateQuerySchema(operationExamples.withQueryParams);
      expect(result).toHaveProperty('type', 'object');
      expect(result).toHaveProperty('properties');
      expect(result.properties).toHaveProperty('limit');
      expect(result.properties).toHaveProperty('offset');
    });

    it('should return null for operation without query parameters', () => {
      const result = SchemaGenerator.generateQuerySchema(operationExamples.withPathParams);
      expect(result).toBeNull();
    });

    it('should handle optional query parameters', () => {
      const result = SchemaGenerator.generateQuerySchema(operationExamples.withQueryParams);
      expect(result.required).toEqual([]);
    });

    it('should handle required query parameters', () => {
      const operation = {
        parameters: [
          {
            name: 'apiKey',
            in: 'query',
            required: true,
            schema: { type: 'string' }
          }
        ]
      };
      const result = SchemaGenerator.generateQuerySchema(operation);
      expect(result.required).toEqual(['apiKey']);
    });

    it('should filter out non-query parameters', () => {
      const result = SchemaGenerator.generateQuerySchema(operationExamples.withAllParams);
      expect(result.properties).toHaveProperty('version');
      expect(result.properties).not.toHaveProperty('id'); // id is path param
    });
  });

  describe('generateValidationSchema', () => {
    it('should generate all validation schemas', () => {
      const result = SchemaGenerator.generateValidationSchema(operationExamples.withAllParams);
      expect(result).toContain('Body');
      expect(result).toContain('Params');
      expect(result).toContain('Query');
    });

    it('should only generate body schema when no parameters', () => {
      const result = SchemaGenerator.generateValidationSchema(operationExamples.withRequestBody);
      expect(result).toContain('Body');
      expect(result).not.toContain('Params');
      expect(result).not.toContain('Query');
    });

    it('should only generate params schema when only path params', () => {
      const result = SchemaGenerator.generateValidationSchema(operationExamples.withPathParams);
      expect(result).toContain('Params');
      expect(result).not.toContain('Body');
      expect(result).not.toContain('Query');
    });

    it('should return empty string for operation without validation', () => {
      const result = SchemaGenerator.generateValidationSchema(operationExamples.withNoParams);
      expect(result).toBe('');
    });
  });

  describe('generateSchemaDefinition', () => {
    it('should generate schema constant definition', () => {
      const operation = { operationId: 'createUser' };
      const schema = { type: 'string' };
      const result = SchemaGenerator.generateSchemaDefinition(operation, 'body', schema);
      expect(result).toBe('const createUserBodySchema = Joi.string();');
    });

    it('should handle operations without operationId', () => {
      const operation = { summary: 'Create User' };
      const schema = { type: 'string' };
      const result = SchemaGenerator.generateSchemaDefinition(operation, 'body', schema);
      expect(result).toContain('CreateUserBodySchema');
    });

    it('should use "unknown" for operations without id or summary', () => {
      const operation = {};
      const schema = { type: 'string' };
      const result = SchemaGenerator.generateSchemaDefinition(operation, 'params', schema);
      expect(result).toContain('unknownParamsSchema');
    });
  });

  describe('getSchemaName', () => {
    it('should generate schema name from operationId', () => {
      const operation = { operationId: 'createUser' };
      const result = SchemaGenerator.getSchemaName(operation, 'body');
      expect(result).toBe('createUserBodySchema');
    });

    it('should generate schema name from summary when no operationId', () => {
      const operation = { summary: 'Create User' };
      const result = SchemaGenerator.getSchemaName(operation, 'body');
      expect(result).toBe('CreateUserBodySchema');
    });

    it('should handle summary with multiple spaces', () => {
      const operation = { summary: 'Get  All  Users' };
      const result = SchemaGenerator.getSchemaName(operation, 'query');
      expect(result).toBe('GetAllUsersQuerySchema');
    });

    it('should capitalize schema type', () => {
      const operation = { operationId: 'getUser' };
      expect(SchemaGenerator.getSchemaName(operation, 'body')).toBe('getUserBodySchema');
      expect(SchemaGenerator.getSchemaName(operation, 'params')).toBe('getUserParamsSchema');
      expect(SchemaGenerator.getSchemaName(operation, 'query')).toBe('getUserQuerySchema');
    });

    it('should use "unknown" as fallback', () => {
      const operation = {};
      const result = SchemaGenerator.getSchemaName(operation, 'body');
      expect(result).toBe('unknownBodySchema');
    });
  });
});

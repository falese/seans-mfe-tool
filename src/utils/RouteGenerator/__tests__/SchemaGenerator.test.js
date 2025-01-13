const { SchemaGenerator } = require('../generators/SchemaGenerator');

describe('SchemaGenerator', () => {
  describe('generateValidationSchema', () => {
    it('should generate validation schema for request body', () => {
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'integer' }
                },
                required: ['name']
              }
            }
          }
        }
      };
      const components = {};

      const result = SchemaGenerator.generateValidationSchema(operation, components);

      expect(result).toContain('const unknownBodySchema = Joi.object({');
      expect(result).toContain('name: Joi.string().required()');
      expect(result).toContain('age: Joi.number().integer()');
    });

    it('should generate validation schema for path parameters', () => {
      const operation = {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ]
      };
      const components = {};

      const result = SchemaGenerator.generateValidationSchema(operation, components);

      expect(result).toContain('const unknownParamsSchema = Joi.object({');
      expect(result).toContain('id: Joi.string().required()');
    });

    it('should generate validation schema for query parameters', () => {
      const operation = {
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } }
        ]
      };
      const components = {};

      const result = SchemaGenerator.generateValidationSchema(operation, components);

      expect(result).toContain('const unknownQuerySchema = Joi.object({');
      expect(result).toContain('limit: Joi.number().integer()');
      expect(result).toContain('offset: Joi.number().integer()');
    });

    it('should handle operations without request body or parameters', () => {
      const operation = {};
      const components = {};

      const result = SchemaGenerator.generateValidationSchema(operation, components);

      expect(result).toBe('');
    });
  });
});

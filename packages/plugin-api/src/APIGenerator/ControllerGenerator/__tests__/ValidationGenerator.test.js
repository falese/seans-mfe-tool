const { ValidationGenerator } = require('../generators/ValidationGenerator');
const { operationExamples } = require('./fixtures/openapi-specs');

describe('ValidationGenerator', () => {
  describe('generateValidations', () => {
    it('should return empty array for operation without parameters or body', () => {
      const result = ValidationGenerator.generateValidations(operationExamples.withNoParams);
      
      expect(result).toEqual([]);
    });

    it('should generate validations for path parameters only', () => {
      const result = ValidationGenerator.generateValidations(operationExamples.withPathParams);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('req.params');
      expect(result[0]).toContain('userId');
    });

    it('should generate validations for query parameters only', () => {
      const result = ValidationGenerator.generateValidations(operationExamples.withQueryParams);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('req.query');
      expect(result[0]).toContain('limit');
      expect(result[1]).toContain('req.query');
      expect(result[1]).toContain('offset');
    });

    it('should generate validations for request body only', () => {
      const result = ValidationGenerator.generateValidations(operationExamples.withRequestBody);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('req.body');
    });

    it('should generate validations for all parameter types combined', () => {
      const result = ValidationGenerator.generateValidations(operationExamples.withAllParams);
      
      expect(result).toHaveLength(3); // 1 path + 1 query + 1 body
      expect(result.some(v => v.includes('req.params'))).toBe(true);
      expect(result.some(v => v.includes('req.query'))).toBe(true);
      expect(result.some(v => v.includes('req.body'))).toBe(true);
    });

    it('should handle operation with undefined parameters', () => {
      const operation = { operationId: 'test' }; // no parameters property
      const result = ValidationGenerator.generateValidations(operation);
      
      expect(result).toEqual([]);
    });

    it('should handle operation with empty parameters array', () => {
      const operation = { operationId: 'test', parameters: [] };
      const result = ValidationGenerator.generateValidations(operation);
      
      expect(result).toEqual([]);
    });

    it('should generate validations in order: path, query, body', () => {
      const result = ValidationGenerator.generateValidations(operationExamples.withAllParams);
      
      const pathIndex = result.findIndex(v => v.includes('req.params'));
      const queryIndex = result.findIndex(v => v.includes('req.query'));
      const bodyIndex = result.findIndex(v => v.includes('req.body'));
      
      expect(pathIndex).toBeLessThan(queryIndex);
      expect(queryIndex).toBeLessThan(bodyIndex);
    });
  });

  describe('addPathValidations', () => {
    it('should extract single path parameter', () => {
      const validations = [];
      const parameters = [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string' } }
      ];
      
      ValidationGenerator.addPathValidations(validations, parameters);
      
      expect(validations).toHaveLength(1);
      expect(validations[0]).toBe('const { userId } = req.params;');
    });

    it('should extract multiple path parameters', () => {
      const validations = [];
      const parameters = [
        { name: 'orgId', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
      ];
      
      ValidationGenerator.addPathValidations(validations, parameters);
      
      expect(validations).toHaveLength(2);
      expect(validations[0]).toBe('const { orgId } = req.params;');
      expect(validations[1]).toBe('const { projectId } = req.params;');
    });

    it('should not add validations for empty path parameters', () => {
      const validations = [];
      const parameters = [];
      
      ValidationGenerator.addPathValidations(validations, parameters);
      
      expect(validations).toHaveLength(0);
    });

    it('should filter out non-path parameters', () => {
      const validations = [];
      const parameters = [
        { name: 'userId', in: 'path', schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'Authorization', in: 'header', schema: { type: 'string' } }
      ];
      
      ValidationGenerator.addPathValidations(validations, parameters);
      
      expect(validations).toHaveLength(1);
      expect(validations[0]).toContain('userId');
      expect(validations[0]).not.toContain('limit');
      expect(validations[0]).not.toContain('Authorization');
    });

    it('should handle parameters with special characters in names', () => {
      const validations = [];
      const parameters = [
        { name: 'user-id', in: 'path', schema: { type: 'string' } }
      ];
      
      ValidationGenerator.addPathValidations(validations, parameters);
      
      expect(validations[0]).toContain('user-id');
    });
  });

  describe('addQueryValidations', () => {
    it('should extract single query parameter', () => {
      const validations = [];
      const parameters = [
        { name: 'limit', in: 'query', schema: { type: 'integer' } }
      ];
      
      ValidationGenerator.addQueryValidations(validations, parameters);
      
      expect(validations).toHaveLength(1);
      expect(validations[0]).toBe('const { limit } = req.query;');
    });

    it('should extract multiple query parameters', () => {
      const validations = [];
      const parameters = [
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'offset', in: 'query', schema: { type: 'integer' } },
        { name: 'sort', in: 'query', schema: { type: 'string' } }
      ];
      
      ValidationGenerator.addQueryValidations(validations, parameters);
      
      expect(validations).toHaveLength(3);
      expect(validations[0]).toBe('const { limit } = req.query;');
      expect(validations[1]).toBe('const { offset } = req.query;');
      expect(validations[2]).toBe('const { sort } = req.query;');
    });

    it('should not add validations for empty query parameters', () => {
      const validations = [];
      const parameters = [];
      
      ValidationGenerator.addQueryValidations(validations, parameters);
      
      expect(validations).toHaveLength(0);
    });

    it('should filter out non-query parameters', () => {
      const validations = [];
      const parameters = [
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'userId', in: 'path', schema: { type: 'string' } },
        { name: 'Authorization', in: 'header', schema: { type: 'string' } }
      ];
      
      ValidationGenerator.addQueryValidations(validations, parameters);
      
      expect(validations).toHaveLength(1);
      expect(validations[0]).toContain('limit');
      expect(validations[0]).not.toContain('userId');
      expect(validations[0]).not.toContain('Authorization');
    });

    it('should handle query parameters with special characters in names', () => {
      const validations = [];
      const parameters = [
        { name: 'filter-type', in: 'query', schema: { type: 'string' } }
      ];
      
      ValidationGenerator.addQueryValidations(validations, parameters);
      
      expect(validations[0]).toContain('filter-type');
    });
  });

  describe('addBodyValidations', () => {
    it('should add body validation when requestBody exists', () => {
      const validations = [];
      const operation = {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      };
      
      ValidationGenerator.addBodyValidations(validations, operation);
      
      expect(validations).toHaveLength(1);
      expect(validations[0]).toBe('const body = req.body;');
    });

    it('should not add body validation when requestBody is absent', () => {
      const validations = [];
      const operation = { operationId: 'test' };
      
      ValidationGenerator.addBodyValidations(validations, operation);
      
      expect(validations).toHaveLength(0);
    });

    it('should not add body validation when requestBody is undefined', () => {
      const validations = [];
      const operation = { operationId: 'test', requestBody: undefined };
      
      ValidationGenerator.addBodyValidations(validations, operation);
      
      expect(validations).toHaveLength(0);
    });

    it('should add body validation even if requestBody is not required', () => {
      const validations = [];
      const operation = {
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      };
      
      ValidationGenerator.addBodyValidations(validations, operation);
      
      expect(validations).toHaveLength(1);
      expect(validations[0]).toBe('const body = req.body;');
    });

    it('should add body validation for any truthy requestBody', () => {
      const validations = [];
      const operation = { requestBody: {} }; // Empty object but truthy
      
      ValidationGenerator.addBodyValidations(validations, operation);
      
      expect(validations).toHaveLength(1);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex operation with mixed parameters', () => {
      const operation = {
        operationId: 'complexOperation',
        parameters: [
          { name: 'orgId', in: 'path', schema: { type: 'string' } },
          { name: 'projectId', in: 'path', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
          { name: 'Authorization', in: 'header', schema: { type: 'string' } }
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } }
        }
      };
      
      const result = ValidationGenerator.generateValidations(operation);
      
      // Should have 2 path + 2 query + 1 body = 5 validations
      expect(result).toHaveLength(5);
      
      // Verify path params
      expect(result.filter(v => v.includes('req.params'))).toHaveLength(2);
      
      // Verify query params
      expect(result.filter(v => v.includes('req.query'))).toHaveLength(2);
      
      // Verify body
      expect(result.filter(v => v.includes('req.body'))).toHaveLength(1);
      
      // Verify headers are excluded
      expect(result.filter(v => v.includes('Authorization'))).toHaveLength(0);
    });

    it('should maintain consistency across multiple calls', () => {
      const operation = operationExamples.withAllParams;
      
      const result1 = ValidationGenerator.generateValidations(operation);
      const result2 = ValidationGenerator.generateValidations(operation);
      
      expect(result1).toEqual(result2);
    });

    it('should generate valid JavaScript destructuring syntax', () => {
      const operation = {
        parameters: [
          { name: 'userId', in: 'path' },
          { name: 'limit', in: 'query' }
        ],
        requestBody: {}
      };
      
      const result = ValidationGenerator.generateValidations(operation);
      
      // All validations should start with 'const'
      expect(result.every(v => v.startsWith('const'))).toBe(true);
      
      // All validations should end with ';'
      expect(result.every(v => v.endsWith(';'))).toBe(true);
      
      // Path and query validations should include destructuring
      const paramValidations = result.filter(v => v.includes('req.params') || v.includes('req.query'));
      expect(paramValidations.every(v => v.includes('{') && v.includes('}'))).toBe(true);
      
      // Body validation is a simple assignment (not destructured)
      const bodyValidation = result.find(v => v.includes('req.body'));
      expect(bodyValidation).toBe('const body = req.body;');
    });
  });
});

// src/utils/RouteGenerator/__tests__/SchemaGenerator.test.js
const { SchemaGenerator } = require('../generators/SchemaGenerator');

describe('SchemaGenerator', () => {
  it('should generate validation schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    };
    
    const result = SchemaGenerator.generateValidationSchema(schema);
    expect(result).toContain('Joi');
  });
});
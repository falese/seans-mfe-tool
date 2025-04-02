// src/utils/RouteGenerator/__tests__/ValidationGenerator.test.js
const { ValidationGenerator } = require('../generators/ValidationGenerator');

describe('ValidationGenerator', () => {
  it('should generate validations', () => {
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
    
    const validations = ValidationGenerator.generateValidations(operation);
    expect(validations).toContain('validateSchema');
  });
});
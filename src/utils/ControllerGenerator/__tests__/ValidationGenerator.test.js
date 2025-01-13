const { ValidationGenerator } = require('../generators/ValidationGenerator');

describe('ValidationGenerator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateValidations', () => {
    it('should generate validations for path parameters', () => {
      const operation = {
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } }
        ]
      };
      const validations = ValidationGenerator.generateValidations(operation);
      expect(validations).toEqual(['const { id } = req.params;']);
    });

    it('should generate validations for query parameters', () => {
      const operation = {
        parameters: [
          { in: 'query', name: 'name', required: true, schema: { type: 'string' } }
        ]
      };
      const validations = ValidationGenerator.generateValidations(operation);
      expect(validations).toEqual(['const { name } = req.query;']);
    });

    it('should generate validations for request body', () => {
      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } } }
            }
          }
        }
      };
      const validations = ValidationGenerator.generateValidations(operation);
      expect(validations).toEqual(['const body = req.body;']);
    });

    it('should generate validations for mixed parameters and request body', () => {
      const operation = {
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'name', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { age: { type: 'number' } } }
            }
          }
        }
      };
      const validations = ValidationGenerator.generateValidations(operation);
      expect(validations).toEqual([
        'const { id } = req.params;',
        'const { name } = req.query;',
        'const body = req.body;'
      ]);
    });

    it('should return an empty array if no parameters or request body', () => {
      const operation = {};
      const validations = ValidationGenerator.generateValidations(operation);
      expect(validations).toEqual([]);
    });
  });
});

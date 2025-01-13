const { ValidationGenerator } = require('../generators/ValidationGenerator');

describe('ValidationGenerator', () => {
  describe('generateValidation', () => {
    it('should generate string validation', () => {
      const schema = { type: 'string', minLength: 3, maxLength: 10, pattern: '^[a-zA-Z]+$' };
      const result = ValidationGenerator.generateValidation(schema);
      expect(result).toContain('Joi.string()');
      expect(result).toContain('.min(3)');
      expect(result).toContain('.max(10)');
      expect(result).toContain('.pattern(/^[a-zA-Z]+$/)');
    });

    it('should generate number validation', () => {
      const schema = { type: 'number', minimum: 1, maximum: 100 };
      const result = ValidationGenerator.generateValidation(schema);
      expect(result).toContain('Joi.number()');
      expect(result).toContain('.min(1)');
      expect(result).toContain('.max(100)');
    });

    it('should generate boolean validation', () => {
      const schema = { type: 'boolean' };
      const result = ValidationGenerator.generateValidation(schema);
      expect(result).toBe('Joi.boolean()');
    });

    it('should generate array validation', () => {
      const schema = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 };
      const result = ValidationGenerator.generateValidation(schema);
      expect(result).toContain('Joi.array()');
      expect(result).toContain('.items(Joi.string())');
      expect(result).toContain('.min(1)');
      expect(result).toContain('.max(5)');
    });

    it('should generate object validation', () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const result = ValidationGenerator.generateValidation(schema);
      expect(result).toContain('Joi.object()');
    });

    it('should generate any validation for unknown types', () => {
      const schema = { type: 'unknown' };
      const result = ValidationGenerator.generateValidation(schema);
      expect(result).toBe('Joi.any()');
    });
  });
});

class ValidationGenerator {
    static generateValidation(schema) {
      switch (schema.type) {
        case 'string':
          return this.generateStringValidation(schema);
        case 'number':
        case 'integer':
          return this.generateNumberValidation(schema);
        case 'boolean':
          return 'Joi.boolean()';
        case 'array':
          return this.generateArrayValidation(schema);
        case 'object':
          return schema.properties ? 
            SchemaGenerator.generateJoiSchema(schema) : 
            'Joi.object()';
        default:
          return 'Joi.any()';
      }
    }
  
    static generateStringValidation(schema) {
      let validation = 'Joi.string()';
      
      if (schema.enum) {
        validation += `.valid(${schema.enum.map(e => `'${e}'`).join(', ')})`;
      }
      if (schema.format === 'date-time') validation += '.iso()';
      if (schema.format === 'email') validation += '.email()';
      if (schema.minLength) validation += `.min(${schema.minLength})`;
      if (schema.maxLength) validation += `.max(${schema.maxLength})`;
      if (schema.pattern) validation += `.pattern(/${schema.pattern}/)`;
      
      return validation;
    }
  
    static generateNumberValidation(schema) {
      let validation = 'Joi.number()';
      
      if (schema.type === 'integer') validation += '.integer()';
      if (schema.minimum !== undefined) validation += `.min(${schema.minimum})`;
      if (schema.maximum !== undefined) validation += `.max(${schema.maximum})`;
      
      return validation;
    }
  
    static generateArrayValidation(schema) {
      let validation = 'Joi.array()';
      
      if (schema.items) {
        validation += `.items(${this.generateValidation(schema.items)})`;
      }
      if (schema.minItems) validation += `.min(${schema.minItems})`;
      if (schema.maxItems) validation += `.max(${schema.maxItems})`;
      
      return validation;
    }
  }
  
  module.exports = { ValidationGenerator };
const Joi = require('joi');
const logger = require('./logger');

/**
 * Creates schema validators for API routes
 * @param {Object} schema - Joi schema
 * @returns {Object} Validated and transformed data
 */
function createValidator(schema) {
  return (data) => {
    logger.debug('Validating data', { schema: schema.describe() });
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      logger.warn('Validation failed', { 
        errors: error.details.map(d => d.message) 
      });
      
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      const validationError = new Error('Validation failed');
      validationError.errors = errors;
      throw validationError;
    }
    
    logger.debug('Validation successful');
    return value;
  };
}

module.exports = {
  createValidator
};
const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Express middleware for validating request data
 * @param {string} location - Request location to validate ('body', 'query', 'params')
 * @param {Object|Joi.Schema} schema - Joi schema or object to validate against
 */
function validateSchema(location, schema) {
  // Create the validation schema once when middleware is created
  const validationSchema = Joi.isSchema(schema) ? schema : Joi.object(schema);

  return (req, res, next) => {
    try {
      const { error, value } = validationSchema.validate(req[location], {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Validation failed', { location, errors });
        
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.errors = errors;
        return next(err);
      }

      // Replace request data with validated data
      req[location] = value;
      logger.debug('Validation successful', { location });
      next();
    } catch (err) {
      logger.error('Validation error', { error: err.message });
      next(err);
    }
  };
}

module.exports = {
  validateSchema
};
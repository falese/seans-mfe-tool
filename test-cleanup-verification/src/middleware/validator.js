const createError = require('http-errors');
const { ValidationError } = require('../utils/errors');

function validateSchema(property, schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      next(new ValidationError('Validation Error', errors));
      return;
    }
    next();
  };
}

module.exports = { validateSchema };
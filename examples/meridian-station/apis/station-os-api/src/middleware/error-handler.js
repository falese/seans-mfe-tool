const logger = require('../utils/logger');
const { BaseError, ValidationError, UnauthorizedError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  // Log error details
  logger.error('Request failed:', {
    requestId: req.id,
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack
  });

  // Handle known errors
  if (err instanceof BaseError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details && { details: err.details })
      }
    });
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

module.exports = errorHandler;
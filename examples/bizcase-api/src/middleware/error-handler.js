const logger = require('../utils/logger');
const { BaseError, ValidationError, UnauthorizedError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  // Handle known errors
  if (err instanceof BaseError) {
    logger.error('Request failed with known error', {
      requestId: req.requestId,
      errorType: err.constructor.name,
      message: err.message,
      details: err.details
    });

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  }

  // Handle unknown errors
  logger.error('Request failed with unknown error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    error: {
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

module.exports = errorHandler;
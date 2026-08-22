const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const isProduction = process.env.NODE_ENV === 'production';
  const isServerError = err.statusCode >= 500;

  // In production, never leak internal 5xx details to the client; 4xx messages
  // are intentional and safe to return.
  const clientMessage = isProduction && isServerError ? 'Internal server error' : err.message;

  const errorResponse = {
    status: err.status,
    message: clientMessage,
    ...(err.errors && { errors: err.errors }),
    ...(isProduction ? {} : { stack: err.stack })
  };

  // Always log the full detail server-side, regardless of what the client sees.
  logger.error('Error occurred', {
    status: err.status,
    statusCode: err.statusCode,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.statusCode).json(errorResponse);
};

module.exports = {
  ApiError,
  errorHandler
};
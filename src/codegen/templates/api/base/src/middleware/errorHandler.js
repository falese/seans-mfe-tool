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

  const errorResponse = {
    status: err.status,
    message: err.message,
    ...(err.errors && { errors: err.errors }),
    ...(isProduction ? {} : { stack: err.stack })
  };

  // Log the error
  logger.error('Error occurred', {
    ...errorResponse,
    path: req.path,
    method: req.method
  });

  res.status(err.statusCode).json(errorResponse);
};

module.exports = {
  ApiError,
  errorHandler
};
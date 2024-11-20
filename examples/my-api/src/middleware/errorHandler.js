const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode,
    requestId: req.id
  });

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message,
    ...(config.env === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler, ApiError };
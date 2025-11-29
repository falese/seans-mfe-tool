/**
 * Standard response formatter
 */
function formatResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data
  };
}

/**
 * Error response formatter
 */
function formatError(error, message = 'An error occurred') {
  return {
    success: false,
    message,
    error: {
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  };
}

module.exports = {
  formatResponse,
  formatError
};
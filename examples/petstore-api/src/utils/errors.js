class BaseError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends BaseError {
  constructor(message, details) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends BaseError {
  constructor(message) {
    super(message, 401);
  }
}

class NotFoundError extends BaseError {
  constructor(message) {
    super(message, 404);
  }
}

class ConflictError extends BaseError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = {
  BaseError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError
};
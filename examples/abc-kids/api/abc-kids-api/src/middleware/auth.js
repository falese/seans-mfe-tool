const jwt = require('jsonwebtoken');
const { UnauthorizedError, BaseError } = require('../utils/errors');

function auth(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      // Misconfiguration, not a client error.
      throw new BaseError('Server auth is not configured', 500);
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Authorization token required');
    }

    // Pin the algorithm to prevent algorithm-confusion / "alg: none" attacks.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof BaseError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Invalid authorization token'));
  }
}

module.exports = { auth };
const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');

const auth = (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      // Misconfiguration, not a client error — surface as 500.
      throw new ApiError(500, 'Server auth is not configured');
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    // Pin the algorithm to prevent algorithm-confusion / "alg: none" attacks.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(new ApiError(401, 'Invalid authentication token'));
  }
};

module.exports = { auth };
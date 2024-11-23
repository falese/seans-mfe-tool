const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');

function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Authorization token required');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid authorization token'));
  }
}

module.exports = { auth };
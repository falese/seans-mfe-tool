const { nanoid } = require('nanoid');

function requestId(req, res, next) {
  req.id = nanoid();
  res.setHeader('X-Request-ID', req.id);
  next();
}

module.exports = requestId;
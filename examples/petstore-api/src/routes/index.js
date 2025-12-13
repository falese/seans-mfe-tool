const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Request logging middleware
router.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body
  });
  next();
});

// Mount /pets routes
router.use('', require('./pets.route'));

module.exports = router;
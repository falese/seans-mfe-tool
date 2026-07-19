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

// Mount /berths routes
router.use('/berths', require('./berths.route'));

// Mount /dockings routes
router.use('/dockings', require('./dockings.route'));

// Mount /manifest_lines routes
router.use('/manifest_lines', require('./manifestLines.route'));

// Mount /vessels routes
router.use('/vessels', require('./vessels.route'));

module.exports = router;
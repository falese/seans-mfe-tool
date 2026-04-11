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

// Mount /phase-metrics routes
router.use('', require('./phaseMetrics.route'));

// Mount /benefits-breakdown routes
router.use('', require('./benefitsBreakdown.route'));

// Mount /cumulative-roi routes
router.use('', require('./cumulativeRoi.route'));

// Mount /performance-gate routes
router.use('', require('./performanceGate.route'));

module.exports = router;
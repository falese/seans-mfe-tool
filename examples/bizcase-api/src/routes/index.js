const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Request logging middleware
router.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  logger.info('Incoming request we got this far', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body
  });
  next();
});

// Mount /phase-metrics routes
router.use('/phase-metrics', require('./phaseMetrics.route'));

// Mount /benefits-breakdown routes
router.use('/benefits-breakdown', require('./benefitsBreakdown.route'));

// Mount /cumulative-roi routes
router.use('/cumulative-roi', require('./cumulativeRoi.route'));

// Mount /performance-gates routes
router.use('/performance-gates', require('./performanceGates.route'));

module.exports = router;
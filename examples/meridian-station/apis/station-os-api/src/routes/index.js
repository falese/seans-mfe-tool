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

// Mount /modules routes
router.use('/modules', require('./modules.route'));

// Mount /telemetry routes
router.use('/telemetry', require('./telemetry.route'));

// Mount /crew routes
router.use('/crew', require('./crew.route'));

// Mount /certifications routes
router.use('/certifications', require('./certifications.route'));

// Mount /passengers routes
router.use('/passengers', require('./passengers.route'));

// Mount /vendors routes
router.use('/vendors', require('./vendors.route'));

// Mount /stalls routes
router.use('/stalls', require('./stalls.route'));

module.exports = router;
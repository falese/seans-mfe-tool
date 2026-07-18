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

// Mount /accounts routes
router.use('/accounts', require('./accounts.route'));

// Mount /charges routes
router.use('/charges', require('./charges.route'));

// Mount /valuations routes
router.use('/valuations', require('./valuations.route'));

// Mount /settlements routes
router.use('/settlements', require('./settlements.route'));

// Mount /payroll routes
router.use('/payroll', require('./payroll.route'));

module.exports = router;
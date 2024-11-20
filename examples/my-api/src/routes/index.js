const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Request tracking middleware
router.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  next();
});

// Debug middleware
router.use((req, res, next) => {
  logger.info('Available routes:', {
    routes: router.stack
      .filter(r => r.route)
      .map(r => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods)
      }))
  });
  next();
});

// Mount routes for each resource
router.use('/pets', require('./pets.route'));

// 404 handler for unmatched routes
router.use((req, res, next) => {
  logger.warn('Route not found:', {
    method: req.method,
    path: req.path
  });
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

module.exports = router;
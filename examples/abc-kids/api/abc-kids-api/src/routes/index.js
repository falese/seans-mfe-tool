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

// Mount /players routes
router.use('/players', require('./players.route'));

// Mount /scores routes
router.use('/scores', require('./scores.route'));

// Mount /leaderboard routes
router.use('/leaderboard', require('./leaderboard.route'));

// Mount /progression routes
router.use('/progression', require('./progression.route'));

module.exports = router;
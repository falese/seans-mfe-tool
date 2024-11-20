const express = require('express');
const router = express.Router();
const { getPets, postPets, getPetsById } = require('../controllers/pets.controller');
const logger = require('../utils/logger');

// Debug middleware for pets routes
router.use((req, res, next) => {
  logger.info('Pets route accessed:', {
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
  next();
});

// List all pets
router.get('/', (req, res, next) => {
  logger.info('Handling GET /pets request');
  return getPets(req, res, next);
});

// Get pet by ID
router.get('/:id', (req, res, next) => {
  logger.info('Handling GET /pets/:id request', { id: req.params.id });
  return getPetsById(req, res, next);
});

// Create new pet
router.post('/', (req, res, next) => {
  logger.info('Handling POST /pets request');
  return postPets(req, res, next);
});

// Log routes registered in this router
logger.info('Pets routes registered:', {
  routes: router.stack
    .filter(r => r.route)
    .map(r => ({
      path: r.route.path,
      methods: Object.keys(r.route.methods)
    }))
});

module.exports = router;
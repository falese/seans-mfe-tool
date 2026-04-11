const express = require('express');
const { getAllPerformanceGate, createPerformanceGate } = require('../controllers/performanceGate.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const CreatenewperformancegateentryBodySchema = Joi.any();

router.get('/performance-gate', getAllPerformanceGate);
router.post('/performance-gate', validateSchema('body', CreatenewperformancegateentryBodySchema), createPerformanceGate);

module.exports = router;
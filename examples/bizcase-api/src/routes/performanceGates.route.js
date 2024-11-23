const express = require('express');
const { getAllPerformanceGates, createPerformanceGates } = require('../controllers/performanceGates.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const CreatenewperformancegateentryBodySchema = Joi.any();

router.get('/performance-gates', getAllPerformanceGates);
router.post('/performance-gates', validateSchema('body', CreatenewperformancegateentryBodySchema), createPerformanceGates);

module.exports = router;
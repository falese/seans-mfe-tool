const express = require('express');
const { getAllPhaseMetrics, createPhaseMetrics, getPhaseMetricsById, updatePhaseMetrics } = require('../controllers/phaseMetrics.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const CreatenewphasemetricsBodySchema = Joi.any();

const UpdatephasemetricsBodySchema = Joi.any();

router.get('/', getAllPhaseMetrics); console.log('got to the route')
router.post('/', validateSchema('body', CreatenewphasemetricsBodySchema), createPhaseMetrics);
router.get('/{phaseId}', getPhaseMetricsById);
router.put('/{phaseId}', validateSchema('body', UpdatephasemetricsBodySchema), updatePhaseMetrics);

module.exports = router;
const express = require('express');
const { getAllPhaseMetrics, createPhaseMetrics, getPhaseMetricsById, updatePhaseMetrics } = require('../controllers/phaseMetrics.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const CreatenewphasemetricsBodySchema = Joi.any();

const UpdatephasemetricsBodySchema = Joi.any();

router.get('/phase-metrics', getAllPhaseMetrics);
router.post('/phase-metrics', validateSchema('body', CreatenewphasemetricsBodySchema), createPhaseMetrics);
router.get('/phase-metrics/{phaseId}', getPhaseMetricsById);
router.put('/phase-metrics/{phaseId}', validateSchema('body', UpdatephasemetricsBodySchema), updatePhaseMetrics);

module.exports = router;
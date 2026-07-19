const express = require('express');
const { getTelemetry } = require('../controllers/telemetry.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const GetTelemetryQuerySchema = Joi.object({"ModuleId":Joi.any(),"MetricKind":Joi.any(),"AlertLevel":Joi.any(),"Page":Joi.any(),"PageSize":Joi.any()});

router.get('/', validateSchema('query', GetTelemetryQuerySchema), getTelemetry);

module.exports = router;
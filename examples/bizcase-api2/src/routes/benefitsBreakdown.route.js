const express = require('express');
const { getAllBenefitsBreakdown, createBenefitsBreakdown } = require('../controllers/benefitsBreakdown.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const CreatenewbenefitsbreakdownentryBodySchema = Joi.any();

router.get('/benefits-breakdown', getAllBenefitsBreakdown);
router.post('/benefits-breakdown', validateSchema('body', CreatenewbenefitsbreakdownentryBodySchema), createBenefitsBreakdown);

module.exports = router;
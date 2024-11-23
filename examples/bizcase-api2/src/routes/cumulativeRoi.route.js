const express = require('express');
const { getAllCumulativeRoi, createCumulativeRoi } = require('../controllers/cumulativeRoi.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const CreatenewcumulativeROIentryBodySchema = Joi.any();

router.get('/cumulative-roi', getAllCumulativeRoi);
router.post('/cumulative-roi', validateSchema('body', CreatenewcumulativeROIentryBodySchema), createCumulativeRoi);

module.exports = router;
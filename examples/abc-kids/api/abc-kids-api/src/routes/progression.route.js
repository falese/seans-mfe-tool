const express = require('express');
const { getProgression } = require('../controllers/progression.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const getProgressionParamsSchema = Joi.object({"playerId":Joi.any()});

router.get('/:playerId', validateSchema('params', getProgressionParamsSchema), getProgression);

module.exports = router;
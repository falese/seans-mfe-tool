const express = require('express');
const { listScores, createScore } = require('../controllers/scores.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listScoresQuerySchema = Joi.object({"gameId":Joi.any(),"limit":Joi.any()});

const createScoreBodySchema = Joi.any();

router.get('/', validateSchema('query', listScoresQuerySchema), listScores);
router.post('/', validateSchema('body', createScoreBodySchema), createScore);

module.exports = router;
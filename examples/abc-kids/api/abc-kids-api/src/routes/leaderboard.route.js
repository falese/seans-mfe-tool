const express = require('express');
const { getLeaderboard } = require('../controllers/leaderboard.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const getLeaderboardQuerySchema = Joi.object({"limit":Joi.any()});

router.get('/', validateSchema('query', getLeaderboardQuerySchema), getLeaderboard);

module.exports = router;
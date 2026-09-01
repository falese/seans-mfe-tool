const express = require('express');
const { listPlayers, createPlayer, getPlayer } = require('../controllers/players.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listPlayersQuerySchema = Joi.object({"limit":Joi.any()});

const createPlayerBodySchema = Joi.any();

const getPlayerParamsSchema = Joi.object({"playerId":Joi.any()});

router.get('/', validateSchema('query', listPlayersQuerySchema), listPlayers);
router.post('/', validateSchema('body', createPlayerBodySchema), createPlayer);
router.get('/:playerId', validateSchema('params', getPlayerParamsSchema), getPlayer);

module.exports = router;
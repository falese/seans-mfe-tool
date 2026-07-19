const express = require('express');
const { listValuations } = require('../controllers/valuations.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listValuationsQuerySchema = Joi.object({"manifestLineRef":Joi.any(),"dockingRef":Joi.any(),"cursor":Joi.any(),"pageSize":Joi.any()});

router.get('/', validateSchema('query', listValuationsQuerySchema), listValuations);

module.exports = router;
const express = require('express');
const { listSettlements } = require('../controllers/settlements.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listSettlementsQuerySchema = Joi.object({"merchantId":Joi.any(),"status":Joi.any(),"cursor":Joi.any(),"pageSize":Joi.any()});

router.get('/', validateSchema('query', listSettlementsQuerySchema), listSettlements);

module.exports = router;
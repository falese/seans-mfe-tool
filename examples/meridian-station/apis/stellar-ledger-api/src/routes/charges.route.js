const express = require('express');
const { listCharges } = require('../controllers/charges.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listChargesQuerySchema = Joi.object({"dockingRef":Joi.any(),"accountId":Joi.any(),"status":Joi.any(),"cursor":Joi.any(),"pageSize":Joi.any()});

router.get('/', validateSchema('query', listChargesQuerySchema), listCharges);

module.exports = router;
const express = require('express');
const { listVessels, getVessel } = require('../controllers/vessels.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const list_vesselsQuerySchema = Joi.object({"operator_name":Joi.any(),"offset":Joi.any(),"limit":Joi.any()});

const get_vesselParamsSchema = Joi.object({"vessel_registry_no":Joi.any()});

router.get('/', validateSchema('query', list_vesselsQuerySchema), listVessels);
router.get('/:vessel_registry_no', validateSchema('params', get_vesselParamsSchema), getVessel);

module.exports = router;
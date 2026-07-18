const express = require('express');
const { getPassengers } = require('../controllers/passengers.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const GetPassengersQuerySchema = Joi.object({"DockingNo":Joi.any(),"ClearanceStatus":Joi.any(),"Page":Joi.any(),"PageSize":Joi.any()});

router.get('/', validateSchema('query', GetPassengersQuerySchema), getPassengers);

module.exports = router;
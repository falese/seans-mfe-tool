const express = require('express');
const { getStalls } = require('../controllers/stalls.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const GetStallsQuerySchema = Joi.object({"VendorId":Joi.any(),"ConcourseZone":Joi.any(),"Page":Joi.any(),"PageSize":Joi.any()});

router.get('/', validateSchema('query', GetStallsQuerySchema), getStalls);

module.exports = router;
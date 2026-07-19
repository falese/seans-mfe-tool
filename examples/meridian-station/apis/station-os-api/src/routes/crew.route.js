const express = require('express');
const { getCrew, getCrewById } = require('../controllers/crew.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const GetCrewQuerySchema = Joi.object({"Section":Joi.any(),"DutyStatus":Joi.any(),"Page":Joi.any(),"PageSize":Joi.any()});

const GetCrewByIdParamsSchema = Joi.object({"CrewId":Joi.any()});

router.get('/', validateSchema('query', GetCrewQuerySchema), getCrew);
router.get('/:CrewId', validateSchema('params', GetCrewByIdParamsSchema), getCrewById);

module.exports = router;
const express = require('express');
const { getModules, getModuleById } = require('../controllers/modules.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const GetModulesQuerySchema = Joi.object({"DeckZone":Joi.any(),"ModuleType":Joi.any(),"Page":Joi.any(),"PageSize":Joi.any()});

const GetModuleByIdParamsSchema = Joi.object({"ModuleId":Joi.any()});

router.get('/', validateSchema('query', GetModulesQuerySchema), getModules);
router.get('/:ModuleId', validateSchema('params', GetModuleByIdParamsSchema), getModuleById);

module.exports = router;
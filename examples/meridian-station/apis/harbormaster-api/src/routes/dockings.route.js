const express = require('express');
const { listDockings, getDocking } = require('../controllers/dockings.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const list_dockingsQuerySchema = Joi.object({"berth_id":Joi.any(),"status_code":Joi.any(),"offset":Joi.any(),"limit":Joi.any()});

const get_dockingParamsSchema = Joi.object({"docking_id":Joi.any()});

router.get('/', validateSchema('query', list_dockingsQuerySchema), listDockings);
router.get('/:docking_id', validateSchema('params', get_dockingParamsSchema), getDocking);

module.exports = router;
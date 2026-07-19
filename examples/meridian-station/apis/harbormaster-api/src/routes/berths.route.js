const express = require('express');
const { listBerths, getBerth } = require('../controllers/berths.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const list_berthsQuerySchema = Joi.object({"berth_class":Joi.any(),"occupied_flag":Joi.any(),"offset":Joi.any(),"limit":Joi.any()});

const get_berthParamsSchema = Joi.object({"berth_id":Joi.any()});

router.get('/', validateSchema('query', list_berthsQuerySchema), listBerths);
router.get('/:berth_id', validateSchema('params', get_berthParamsSchema), getBerth);

module.exports = router;
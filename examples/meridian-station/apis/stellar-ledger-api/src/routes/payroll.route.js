const express = require('express');
const { listPayroll } = require('../controllers/payroll.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listPayrollQuerySchema = Joi.object({"crewRef":Joi.any(),"status":Joi.any(),"cursor":Joi.any(),"pageSize":Joi.any()});

router.get('/', validateSchema('query', listPayrollQuerySchema), listPayroll);

module.exports = router;
const express = require('express');
const { listAccounts, getAccount } = require('../controllers/accounts.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listAccountsQuerySchema = Joi.object({"accountType":Joi.any(),"standing":Joi.any(),"cursor":Joi.any(),"pageSize":Joi.any()});

const getAccountParamsSchema = Joi.object({"accountId":Joi.any()});

router.get('/', validateSchema('query', listAccountsQuerySchema), listAccounts);
router.get('/:accountId', validateSchema('params', getAccountParamsSchema), getAccount);

module.exports = router;
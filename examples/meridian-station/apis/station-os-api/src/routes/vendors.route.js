const express = require('express');
const { getVendors, getVendorById } = require('../controllers/vendors.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const GetVendorsQuerySchema = Joi.object({"ConcourseZone":Joi.any(),"LicenseStatus":Joi.any(),"Page":Joi.any(),"PageSize":Joi.any()});

const GetVendorByIdParamsSchema = Joi.object({"VendorId":Joi.any()});

router.get('/', validateSchema('query', GetVendorsQuerySchema), getVendors);
router.get('/:VendorId', validateSchema('params', GetVendorByIdParamsSchema), getVendorById);

module.exports = router;
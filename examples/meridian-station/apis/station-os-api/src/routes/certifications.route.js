const express = require('express');
const { getCertifications } = require('../controllers/certifications.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const GetCertificationsQuerySchema = Joi.object({"CrewId":Joi.any(),"Status":Joi.any(),"Page":Joi.any(),"PageSize":Joi.any()});

router.get('/', validateSchema('query', GetCertificationsQuerySchema), getCertifications);

module.exports = router;
const express = require('express');
const { listManifestLines } = require('../controllers/manifestLines.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const list_manifest_linesQuerySchema = Joi.object({"docking_id":Joi.any(),"hazard_class":Joi.any(),"offset":Joi.any(),"limit":Joi.any()});

router.get('/', validateSchema('query', list_manifest_linesQuerySchema), listManifestLines);

module.exports = router;
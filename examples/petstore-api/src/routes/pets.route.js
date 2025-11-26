const express = require('express');
const { listPets, createPet, getPet } = require('../controllers/pets.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listPetsQuerySchema = Joi.object({"limit":Joi.any()});

const createPetBodySchema = Joi.any();

const getPetParamsSchema = Joi.object({"petId":Joi.any()});

router.get('/', validateSchema('query', listPetsQuerySchema), listPets);
router.post('/', validateSchema('body', createPetBodySchema), createPet);
router.get('/:petId', validateSchema('params', getPetParamsSchema), getPet);

module.exports = router;
const express = require('express');
const { listPets, createPet, getPet } = require('../controllers/pets.controller');
const { validateSchema } = require('../middleware/validator');
const { auth } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

const listPetsQuerySchema = Joi.object({
  limit: Joi.number().integer(),
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0).default(0)
});

const createPetBodySchema = Joi.object({

});

const getPetParamsSchema = Joi.object({
  petId: Joi.string().required()
});

router.get('/', validateSchema('query', listPetsQuerySchema), listPets);
router.post('/', validateSchema('body', createPetBodySchema), createPet);
router.get('/:petId', validateSchema('params', getPetParamsSchema), getPet);

module.exports = router;
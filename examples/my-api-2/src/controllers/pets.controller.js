const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


async function listPets(req, res, next) {
  const { requestId } = req;
  
  try {
    logger.info('Processing request', { 
      requestId,
      controller: 'listPets',
      operation: '/pets',
      method: 'get',
      params: req.params,
      query: req.query,
      body: req.body 
    });

    const { limit } = req.query;
    
    const items = await Model.Pet
      .find(req.query)
      .limit(parseInt(req.query.limit) || 10)
      .skip(parseInt(req.query.offset) || 0);
    res.status(200).json(items);

    logger.info('Request successful', { requestId });
  } catch (error) {
    logger.error('Request failed', { 
      requestId, 
      error: error.message 
    });
    next(error);
  }
}


async function createPet(req, res, next) {
  const { requestId } = req;
  
  try {
    logger.info('Processing request', { 
      requestId,
      controller: 'createPet',
      operation: '/pets',
      method: 'post',
      params: req.params,
      query: req.query,
      body: req.body 
    });

    const body = req.body;
    
    const newItem = await Model.Pet.create(req.body);
    res.status(201).json(newItem);

    logger.info('Request successful', { requestId });
  } catch (error) {
    logger.error('Request failed', { 
      requestId, 
      error: error.message 
    });
    next(error);
  }
}


async function getPet(req, res, next) {
  const { requestId } = req;
  
  try {
    logger.info('Processing request', { 
      requestId,
      controller: 'getPet',
      operation: '/pets/{petId}',
      method: 'get',
      params: req.params,
      query: req.query,
      body: req.body 
    });

    const { petId } = req.params;
    
    const item = await Model.Pet.findById(req.params.petId);
    if (!item) {
      throw new ApiError(404, 'Not found');
    }
    res.status(200).json(item);

    logger.info('Request successful', { requestId });
  } catch (error) {
    logger.error('Request failed', { 
      requestId, 
      error: error.message 
    });
    next(error);
  }
}

module.exports = {
  listPets,
  createPet,
  getPet
};
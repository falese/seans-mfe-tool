const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


async function getPets(req, res, next) {
  const { requestId } = req;
  
  try {
    logger.info('Processing request', { 
      requestId,
      controller: 'pets',
      action: 'get',
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


async function postPets(req, res, next) {
  const { requestId } = req;
  
  try {
    logger.info('Processing request', { 
      requestId,
      controller: 'pets',
      action: 'post',
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

module.exports = {
  getPets,
  postPets
};
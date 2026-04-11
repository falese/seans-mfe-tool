const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


  async function getAllPets(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getAllPets',
        operation: '/pets',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { limit } = req.query;
      
      const item = await Model.Pets
      .find(req.query)
      .limit(parseInt(req.query.limit) || 10)
      .skip(parseInt(req.query.offset) || 0);
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


  async function createPets(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'createPets',
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


  async function getPetsById(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getPetsById',
        operation: '/pets/{petId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { petId } = req.params;
      
      const item = await Model.Pets.findById(req.params.petId);
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
  getAllPets,
  createPets,
  getPetsById
};
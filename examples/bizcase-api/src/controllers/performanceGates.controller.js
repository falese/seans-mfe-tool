const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


  async function getAllPerformanceGates(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getAllPerformanceGates',
        operation: '/performance-gates',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      
      
      const item = await Model.PerformanceGates
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


  async function createPerformanceGates(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'createPerformanceGates',
        operation: '/performance-gates',
        method: 'post',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const body = req.body;
      
      const newItem = await Model.PerformanceGate.create(req.body);
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
  getAllPerformanceGates,
  createPerformanceGates
};
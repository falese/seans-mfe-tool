const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


  async function getAllBenefitsBreakdown(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getAllBenefitsBreakdown',
        operation: '/benefits-breakdown',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      
      
      const item = await Model.BenefitsBreakdown
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


  async function createBenefitsBreakdown(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'createBenefitsBreakdown',
        operation: '/benefits-breakdown',
        method: 'post',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const body = req.body;
      
      const newItem = await Model.BenefitsBreakdown.create(req.body);
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
  getAllBenefitsBreakdown,
  createBenefitsBreakdown
};
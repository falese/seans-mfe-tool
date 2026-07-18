const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function getModules(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getModules',
        operation: '/modules',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { DeckZone } = req.query;
    const { ModuleType } = req.query;
    const { Page } = req.query;
    const { PageSize } = req.query;
      
      const item = await db.Module.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Module.rawAttributes)),
      limit: parseInt(req.query.limit) || 10,
      offset: parseInt(req.query.offset) || 0
    });
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


  async function getModuleById(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getModuleById',
        operation: '/modules/{ModuleId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { ModuleId } = req.params;
      
      const item = await db.Module.findOne({ where: { ModuleId: req.params.ModuleId } });
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
  getModules,
  getModuleById
};
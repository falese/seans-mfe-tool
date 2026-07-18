const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function listDockings(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'listDockings',
        operation: '/dockings',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { berth_id } = req.query;
    const { status_code } = req.query;
    const { offset } = req.query;
    const { limit } = req.query;
      
      const item = await db.Docking.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Docking.rawAttributes)),
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


  async function getDocking(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getDocking',
        operation: '/dockings/{docking_id}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { docking_id } = req.params;
      
      const item = await db.Docking.findOne({ where: { docking_id: req.params.docking_id } });
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
  listDockings,
  getDocking
};
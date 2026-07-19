const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function listBerths(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'listBerths',
        operation: '/berths',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { berth_class } = req.query;
    const { occupied_flag } = req.query;
    const { offset } = req.query;
    const { limit } = req.query;
      
      const item = await db.Berth.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Berth.rawAttributes)),
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


  async function getBerth(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getBerth',
        operation: '/berths/{berth_id}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { berth_id } = req.params;
      
      const item = await db.Berth.findOne({ where: { berth_id: req.params.berth_id } });
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
  listBerths,
  getBerth
};
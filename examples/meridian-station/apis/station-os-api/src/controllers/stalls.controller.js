const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function getStalls(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getStalls',
        operation: '/stalls',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { VendorId } = req.query;
    const { ConcourseZone } = req.query;
    const { Page } = req.query;
    const { PageSize } = req.query;
      
      const item = await db.Stall.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Stall.rawAttributes)),
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

module.exports = {
  getStalls
};
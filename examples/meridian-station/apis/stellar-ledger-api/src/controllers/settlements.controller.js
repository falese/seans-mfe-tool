const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


  async function listSettlements(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'listSettlements',
        operation: '/settlements',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { merchantId } = req.query;
    const { status } = req.query;
    const { cursor } = req.query;
    const { pageSize } = req.query;
      
      const item = await Model.Settlement
      .find(Object.fromEntries(Object.entries(req.query).filter(([key]) => key in Model.Settlement.schema.paths)))
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

module.exports = {
  listSettlements
};
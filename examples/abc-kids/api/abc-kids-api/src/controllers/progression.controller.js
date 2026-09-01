const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function getProgression(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getProgression',
        operation: '/progression/{playerId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { playerId } = req.params;
      
      const item = await db.Progression.findOne({ where: { playerId: req.params.playerId } });
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
  getProgression
};
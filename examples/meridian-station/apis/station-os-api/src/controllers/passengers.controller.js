const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function getPassengers(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getPassengers',
        operation: '/passengers',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { DockingNo } = req.query;
    const { ClearanceStatus } = req.query;
    const { Page } = req.query;
    const { PageSize } = req.query;
      
      const item = await db.Passenger.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Passenger.rawAttributes)),
      limit: parseInt(req.query.PageSize, 10) || 20,
      offset: ((parseInt(req.query.Page, 10) || 1) - 1) * (parseInt(req.query.PageSize, 10) || 20)
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
  getPassengers
};
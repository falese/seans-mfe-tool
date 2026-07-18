const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function getCrew(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getCrew',
        operation: '/crew',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { Section } = req.query;
    const { DutyStatus } = req.query;
    const { Page } = req.query;
    const { PageSize } = req.query;
      
      const item = await db.Crew.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Crew.rawAttributes)),
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


  async function getCrewById(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getCrewById',
        operation: '/crew/{CrewId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { CrewId } = req.params;
      
      const item = await db.Crew.findOne({ where: { CrewId: req.params.CrewId } });
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
  getCrew,
  getCrewById
};
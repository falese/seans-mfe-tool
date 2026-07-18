const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function listVessels(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'listVessels',
        operation: '/vessels',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { operator_name } = req.query;
    const { offset } = req.query;
    const { limit } = req.query;
      
      const item = await db.Vessel.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Vessel.rawAttributes)),
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


  async function getVessel(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getVessel',
        operation: '/vessels/{vessel_registry_no}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { vessel_registry_no } = req.params;
      
      const item = await db.Vessel.findOne({ where: { vessel_registry_no: req.params.vessel_registry_no } });
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
  listVessels,
  getVessel
};
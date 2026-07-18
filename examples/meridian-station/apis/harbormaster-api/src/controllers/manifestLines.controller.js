const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function listManifestLines(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'listManifestLines',
        operation: '/manifest_lines',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { docking_id } = req.query;
    const { hazard_class } = req.query;
    const { offset } = req.query;
    const { limit } = req.query;
      
      const item = await db.ManifestLine.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.ManifestLine.rawAttributes)),
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
  listManifestLines
};
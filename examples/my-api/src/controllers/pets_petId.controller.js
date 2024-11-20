const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


async function getpets_petId(req, res, next) {
  const { requestId } = req;
  
  try {
    logger.info('Processing request', { 
      requestId,
      controller: 'pets_petId',
      action: 'get',
      params: req.params,
      query: req.query,
      body: req.body 
    });

    const { petId } = req.params;
    
    
    const item = await Model.Pet.findById(req.params.id);
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
  getpets_petId
};
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


  async function listAccounts(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'listAccounts',
        operation: '/accounts',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { accountType } = req.query;
    const { standing } = req.query;
    const { cursor } = req.query;
    const { pageSize } = req.query;
      
      const item = await Model.Account
      .find(Object.fromEntries(Object.entries(req.query).filter(([key]) => key in Model.Account.schema.paths)))
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


  async function getAccount(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getAccount',
        operation: '/accounts/{accountId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { accountId } = req.params;
      
      const item = await Model.Account.findOne({ accountId: req.params.accountId });
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
  listAccounts,
  getAccount
};
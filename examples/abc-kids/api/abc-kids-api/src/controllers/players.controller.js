const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function listPlayers(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'listPlayers',
        operation: '/players',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { limit } = req.query;
      
      const item = await db.Player.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Player.rawAttributes)),
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


  async function createPlayer(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'createPlayer',
        operation: '/players',
        method: 'post',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const body = req.body;
      
      const newItem = await db.Player.create(req.body);
      res.status(201).json(newItem);
  
      logger.info('Request successful', { requestId });
    } catch (error) {
      logger.error('Request failed', { 
        requestId, 
        error: error.message 
      });
      next(error);
    }
  }


  async function getPlayer(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getPlayer',
        operation: '/players/{playerId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { playerId } = req.params;
      
      const item = await db.Player.findOne({ where: { playerId: req.params.playerId } });
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
  listPlayers,
  createPlayer,
  getPlayer
};
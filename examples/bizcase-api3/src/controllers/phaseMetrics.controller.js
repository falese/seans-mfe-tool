const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const Model = require('../models');


  async function getAllPhaseMetrics(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getAllPhaseMetrics',
        operation: '/phase-metrics',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      
      
      const item = await Model.PhaseMetric
      .find(req.query)
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


  async function createPhaseMetrics(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'createPhaseMetrics',
        operation: '/phase-metrics',
        method: 'post',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const body = req.body;
      
      const newItem = await Model.PhaseMetric.create(req.body);
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


  async function getPhaseMetricsById(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getPhaseMetricsById',
        operation: '/phase-metrics/{phaseId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { phaseId } = req.params;
      
      const item = await Model.PhaseMetric.findById(req.params.phaseId);
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


  async function updatePhaseMetrics(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'updatePhaseMetrics',
        operation: '/phase-metrics/{phaseId}',
        method: 'put',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { phaseId } = req.params;
    const body = req.body;
      
      const updatedItem = await Model.PhaseMetric.findByIdAndUpdate(req.params.phaseId, req.body, { new: true });
      if (!updatedItem) {
        throw new ApiError(404, 'Not found');
      }
      res.status(200).json(updatedItem);
  
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
  getAllPhaseMetrics,
  createPhaseMetrics,
  getPhaseMetricsById,
  updatePhaseMetrics
};
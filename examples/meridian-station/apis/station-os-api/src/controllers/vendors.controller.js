const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const db = require('../models');


  async function getVendors(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getVendors',
        operation: '/vendors',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { ConcourseZone } = req.query;
    const { LicenseStatus } = req.query;
    const { Page } = req.query;
    const { PageSize } = req.query;
      
      const item = await db.Vendor.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.Vendor.rawAttributes)),
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


  async function getVendorById(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: 'getVendorById',
        operation: '/vendors/{VendorId}',
        method: 'get',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      const { VendorId } = req.params;
      
      const item = await db.Vendor.findOne({ where: { VendorId: req.params.VendorId } });
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
  getVendors,
  getVendorById
};
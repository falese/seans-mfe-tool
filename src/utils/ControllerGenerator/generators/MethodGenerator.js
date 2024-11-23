class MethodGenerator {
    static generateControllerMethod(functionName, method, operationPath, operation, validations, implementation) {
      return `
  async function ${functionName}(req, res, next) {
    const { requestId } = req;
    
    try {
      logger.info('Processing request', { 
        requestId,
        controller: '${functionName}',
        operation: '${operationPath}',
        method: '${method}',
        params: req.params,
        query: req.query,
        body: req.body 
      });
  
      ${validations.join('\n    ')}
      ${implementation}
  
      logger.info('Request successful', { requestId });
    } catch (error) {
      logger.error('Request failed', { 
        requestId, 
        error: error.message 
      });
      next(error);
    }
  }`;
    }
  }
  
  module.exports = { MethodGenerator };
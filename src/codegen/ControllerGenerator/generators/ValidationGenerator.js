class ValidationGenerator {
    static generateValidations(operation) {
      const validations = [];
      const parameters = operation.parameters || [];
      
      this.addPathValidations(validations, parameters);
      this.addQueryValidations(validations, parameters);
      this.addBodyValidations(validations, operation);
  
      return validations;
    }
  
    static addPathValidations(validations, parameters) {
      const pathParams = parameters.filter(p => p.in === 'path');
      if (pathParams.length > 0) {
        pathParams.forEach(param => {
          validations.push(`const { ${param.name} } = req.params;`);
        });
      }
    }
  
    static addQueryValidations(validations, parameters) {
      const queryParams = parameters.filter(p => p.in === 'query');
      if (queryParams.length > 0) {
        queryParams.forEach(param => {
          validations.push(`const { ${param.name} } = req.query;`);
        });
      }
    }
  
    static addBodyValidations(validations, operation) {
      if (operation.requestBody) {
        validations.push(`const body = req.body;`);
      }
    }
  }
  
  module.exports = { ValidationGenerator };
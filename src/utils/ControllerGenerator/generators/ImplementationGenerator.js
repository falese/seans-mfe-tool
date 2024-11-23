class ImplementationGenerator {
    static generate(method, operationPath, operation, modelName, dbAdapter) {
      switch (method.toLowerCase()) {
        case 'get':
          return this.generateGetImplementation(operationPath, dbAdapter);
        case 'post':
          return this.generatePostImplementation(modelName, dbAdapter);
        case 'put':
          return this.generatePutImplementation(operationPath, modelName, dbAdapter);
        case 'patch':
          return this.generatePatchImplementation(operationPath, modelName, dbAdapter);
        case 'delete':
          return this.generateDeleteImplementation(operationPath, modelName, dbAdapter);
        default:
          return this.generateDefaultImplementation();
      }
    }
  
    static generateGetImplementation(operationPath, dbAdapter) {
      const query = dbAdapter.generateFindQuery('get', operationPath);
      return `
      const item = await ${query};
      if (!item) {
        throw new ApiError(404, 'Not found');
      }
      res.status(200).json(item);`;
    }
  
    static generatePostImplementation(modelName, dbAdapter) {
      return `
      const newItem = await ${dbAdapter.generateCreateQuery(modelName)};
      res.status(201).json(newItem);`;
    }
  
    static generatePutImplementation(operationPath, modelName, dbAdapter) {
      return `
      const updatedItem = await ${dbAdapter.generateUpdateQuery('put', operationPath, modelName)};
      if (!updatedItem) {
        throw new ApiError(404, 'Not found');
      }
      res.status(200).json(updatedItem);`;
    }
  
    static generatePatchImplementation(operationPath, modelName, dbAdapter) {
      return `
      const patchedItem = await ${dbAdapter.generateUpdateQuery('patch', operationPath, modelName)};
      if (!patchedItem) {
        throw new ApiError(404, 'Not found');
      }
      res.status(200).json(patchedItem);`;
    }
  
    static generateDeleteImplementation(operationPath, modelName, dbAdapter) {
      return `
      const deletedItem = await ${dbAdapter.generateDeleteQuery(operationPath, modelName)};
      if (!deletedItem) {
        throw new ApiError(404, 'Not found');
      }
      res.status(204).send();`;
    }
  
    static generateDefaultImplementation() {
      return `
      throw new ApiError(501, 'Not implemented');`;
    }
  }
  
  module.exports = { ImplementationGenerator };
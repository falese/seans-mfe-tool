const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class ControllerGenerator {
  static async generate(dbType, controllersDir, spec) {
    console.log(chalk.blue('\nGenerating controllers...'));
    const generator = this.getGenerator(dbType);
    return generator.generateControllers(controllersDir, spec);
  }

  static getGenerator(dbType) {
    switch (dbType.toLowerCase()) {
      case 'mongodb':
      case 'mongo':
        return new MongoControllerGenerator();
      case 'sqlite':
      case 'sql':
        return new SQLiteControllerGenerator();
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }
}

class BaseControllerGenerator {
  async generateControllers(controllersDir, spec) {
    // Create a map to collect all operations for each resource
    const resourceMap = new Map();

    // Group paths by resource
    Object.entries(spec.paths).forEach(([path, operations]) => {
      const resourceName = this.getResourceName(path);
      if (!resourceMap.has(resourceName)) {
        resourceMap.set(resourceName, { paths: [] });
      }
      resourceMap.get(resourceName).paths.push({ path, operations });
    });

    // Generate controller for each resource
    for (const [resourceName, resourceData] of resourceMap) {
      const controllerPath = path.join(controllersDir, `${resourceName}.controller.js`);
      const controllerContent = this.generateControllerFile(resourceData, resourceName, spec);
      
      await fs.writeFile(controllerPath, controllerContent);
      console.log(chalk.green(`✓ Generated controller: ${resourceName}`));
    }
  }

  getResourceName(pathKey) {
    return pathKey.split('/')[1];
  }

  getModelName(resourceName) {
    // Convert to singular and capitalize
    return resourceName.charAt(0).toUpperCase() + 
           resourceName.slice(1, -1); // Remove trailing 's'
  }

  generateValidations(operation) {
    const validations = [];
    const parameters = operation.parameters || [];
    
    const pathParams = parameters.filter(p => p.in === 'path');
    if (pathParams.length > 0) {
      pathParams.forEach(param => {
        validations.push(`const { ${param.name} } = req.params;`);
      });
    }
    
    const queryParams = parameters.filter(p => p.in === 'query');
    if (queryParams.length > 0) {
      queryParams.forEach(param => {
        validations.push(`const { ${param.name} } = req.query;`);
      });
    }
    
    if (operation.requestBody) {
      validations.push(`const body = req.body;`);
    }

    return validations;
  }

  generateControllerMethod(functionName, method, operationPath, operation, validations, implementation) {
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

class MongoControllerGenerator extends BaseControllerGenerator {
  generateControllerFile(resourceData, resourceName, spec) {
    const imports = [
      `const { ApiError } = require('../middleware/errorHandler');`,
      `const logger = require('../utils/logger');`,
      `const Model = require('../models');`
    ].join('\n');

    const controllers = [];
    const exportedFunctions = new Set();

    resourceData.paths.forEach(({ path, operations }) => {
      Object.entries(operations).forEach(([method, operation]) => {
        const functionName = operation.operationId
          ? operation.operationId.charAt(0).toLowerCase() + operation.operationId.slice(1)
          : `${method.toLowerCase()}${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)}`;

        exportedFunctions.add(functionName);
        const validations = this.generateValidations(operation);
        const implementation = this.generateImplementation(method, path, operation, resourceName);
        controllers.push(this.generateControllerMethod(
          functionName, 
          method, 
          path, 
          operation,
          validations, 
          implementation
        ));
      });
    });

    const exports = `module.exports = {\n  ${Array.from(exportedFunctions).join(',\n  ')}\n};`;

    return `${imports}\n\n${controllers.join('\n\n')}\n\n${exports}`;
  }

  generateImplementation(method, operationPath, operation, resourceName) {
    const modelName = this.getModelName(resourceName);
    const hasPathParam = operationPath.includes('{');
    
    switch (method.toLowerCase()) {
      case 'get':
        if (hasPathParam) {
          const paramName = operationPath.match(/{([^}]+)}/)[1];
          return `
    const item = await Model.${modelName}.findById(req.params.${paramName});
    if (!item) {
      throw new ApiError(404, 'Not found');
    }
    res.status(200).json(item);`;
        }
        return `
    const items = await Model.${modelName}
      .find(req.query)
      .limit(parseInt(req.query.limit) || 10)
      .skip(parseInt(req.query.offset) || 0);
    res.status(200).json(items);`;

      case 'post':
        return `
    const newItem = await Model.${modelName}.create(req.body);
    res.status(201).json(newItem);`;

      case 'put':
        return `
    const updatedItem = await Model.${modelName}
      .findByIdAndUpdate(req.params.${operationPath.match(/{([^}]+)}/)[1]}, req.body, { new: true });
    if (!updatedItem) {
      throw new ApiError(404, 'Not found');
    }
    res.status(200).json(updatedItem);`;

      case 'patch':
        return `
    const patchedItem = await Model.${modelName}
      .findByIdAndUpdate(req.params.${operationPath.match(/{([^}]+)}/)[1]}, req.body, { new: true });
    if (!patchedItem) {
      throw new ApiError(404, 'Not found');
    }
    res.status(200).json(patchedItem);`;

      case 'delete':
        return `
    const deletedItem = await Model.${modelName}.findByIdAndDelete(req.params.${operationPath.match(/{([^}]+)}/)[1]});
    if (!deletedItem) {
      throw new ApiError(404, 'Not found');
    }
    res.status(204).send();`;

      default:
        return `
    throw new ApiError(501, 'Not implemented');`;
    }
  }
}

class SQLiteControllerGenerator extends BaseControllerGenerator {
  generateControllerFile(pathKey, pathObj, controllerName, spec) {
    const methods = Object.keys(pathObj);
    const imports = [
      `const { ApiError } = require('../middleware/errorHandler');`,
      `const logger = require('../utils/logger');`,
      `const db = require('../models');`
    ].join('\n');

    const controllers = methods.map(method => {
      const operation = pathObj[method];
      const validations = this.generateValidations(operation);
      const implementation = this.generateImplementation(method, pathKey, operation);

      return this.generateControllerMethod(method, operation, validations, implementation);
    }).join('\n\n');

    // Export using operationIds
    const exports = `module.exports = {\n  ${methods.map(method => {
      const operation = pathObj[method];
      return operation.operationId 
        ? operation.operationId.charAt(0).toLowerCase() + operation.operationId.slice(1)
        : `${method.toLowerCase()}${controllerName.charAt(0).toUpperCase() + controllerName.slice(1)}`;
    }).join(',\n  ')}\n};`;

    return `${imports}\n\n${controllers}\n\n${exports}`;
  }

  generateImplementation(method, pathKey, operation) {
    const resource = pathKey.split('/')[1];
    const modelName = resource.charAt(0).toUpperCase() + resource.slice(1, -1);

    switch (method) {
      case 'get':
        if (pathKey.includes('{')) {
          return `
    const item = await db.${modelName}.findByPk(req.params.id);
    if (!item) {
      throw new ApiError(404, 'Not found');
    }
    res.status(200).json(item);`;
        }
        return `
    const items = await db.${modelName}.findAll({
      where: req.query,
      limit: parseInt(req.query.limit) || 10,
      offset: parseInt(req.query.offset) || 0
    });
    res.status(200).json(items);`;

      case 'post':
        return `
    const newItem = await db.${modelName}.create(req.body);
    res.status(201).json(newItem);`;

      case 'put':
        return `
    const [updated] = await db.${modelName}.update(req.body, {
      where: { id: req.params.id }
    });
    if (!updated) {
      throw new ApiError(404, 'Not found');
    }
    const updatedItem = await db.${modelName}.findByPk(req.params.id);
    res.status(200).json(updatedItem);`;

      case 'patch':
        return `
    const [updated] = await db.${modelName}.update(req.body, {
      where: { id: req.params.id }
    });
    if (!updated) {
      throw new ApiError(404, 'Not found');
    }
    const patchedItem = await db.${modelName}.findByPk(req.params.id);
    res.status(200).json(patchedItem);`;

      case 'delete':
        return `
    const deleted = await db.${modelName}.destroy({
      where: { id: req.params.id }
    });
    if (!deleted) {
      throw new ApiError(404, 'Not found');
    }
    res.status(204).send();`;

      default:
        return `
    throw new ApiError(501, 'Not implemented');`;
    }
  }
}

module.exports = {
  ControllerGenerator
};
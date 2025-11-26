const { NameGenerator } = require('../../generators/NameGenerator');
const { SchemaGenerator } = require('./SchemaGenerator');

class PathGenerator {
  static generatePathContent(paths, resourceName, controllerName, spec) {
    console.log(`Generating path content for ${resourceName}`);
    
    const operationMap = {};
    const validationSchemas = [];
    const routes = [];

    paths.forEach(([path, operations]) => {
      const { parameters: pathParams, ...pathOperations } = operations;
      
      Object.entries(pathOperations).forEach(([method, operation]) => {
        if (method === 'parameters') return;

        const functionName = this.generateMethodName(method, resourceName, path, operation);
        operationMap[functionName] = true;

        const validationSchema = SchemaGenerator.generateValidationSchema(operation, spec);
        if (validationSchema) {
          validationSchemas.push(validationSchema);
        }

        const route = this.generateRoute(method, path, functionName, operation, resourceName);
        routes.push(route);
        console.log("is it the path", path)
      });
    });
    console.log("routes are here", routes)
    return {
      operationMap,
      validationSchemas,
      routes
    };
  }

  static generateMethodName(method, resourceName, path, operation) {
    const isCollection = !path.includes('{');
    const base = NameGenerator.toPascalCase(resourceName);
    
    if (operation.operationId) {
      return NameGenerator.toCamelCase(operation.operationId);
    }

    if (isCollection) {
      switch (method.toLowerCase()) {
        case 'get': return `getAll${base}`;
        case 'post': return `create${base}`;
        default: return `${method.toLowerCase()}${base}`;
      }
    } else {
      switch (method.toLowerCase()) {
        case 'get': return `get${base}ById`;
        case 'put': return `update${base}`;
        case 'patch': return `patch${base}`;
        case 'delete': return `delete${base}`;
        default: return `${method.toLowerCase()}${base}ById`;
      }
    }
  }

  static generateRoute(method, path, functionName, operation, resourceName) {
    const routePath = this.normalizeRoutePath(path, resourceName);
    const middlewares = this.generateMiddleware(operation);
    
    let routeStr = `router.${method.toLowerCase()}('${routePath}'`;

    if (middlewares.length > 0) {
      routeStr += `, ${middlewares.join(', ')}`;
    }

    routeStr += `, ${functionName}`;

    return `${routeStr});`;
  }

  static normalizeRoutePath(path, resourceName) {
    const prefix = `/${resourceName}`;
    const normalized = path.startsWith(prefix)
      ? path.slice(prefix.length) || '/'
      : path;

    return normalized.replace(/{([^}]+)}/g, ':$1');
  }

  static generateMiddleware(operation) {
    const middleware = [];

    if (operation.security) {
      middleware.push('auth()');
    }

    if (operation.requestBody) {
      const schemaName = SchemaGenerator.getSchemaName(operation, 'body');
      middleware.push(`validateSchema('body', ${schemaName})`);
    }

    if (operation.parameters?.some(p => p.in === 'path')) {
      const schemaName = SchemaGenerator.getSchemaName(operation, 'params');
      middleware.push(`validateSchema('params', ${schemaName})`);
    }

    if (operation.parameters?.some(p => p.in === 'query')) {
      const schemaName = SchemaGenerator.getSchemaName(operation, 'query');
      middleware.push(`validateSchema('query', ${schemaName})`);
    }

    return middleware;
  }
}

module.exports = { PathGenerator };

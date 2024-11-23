const { NameGenerator } = require('./NameGenerator');

class ResourceMapper {
  constructor() {
    this.nameGenerator = new NameGenerator();
  }

  mapResources(spec) {
    const resourceMap = new Map();

    // Group paths by resource
    Object.entries(spec.paths).forEach(([path, operations]) => {
      const resourceName = this.getResourceName(path);
      if (!resourceMap.has(resourceName)) {
        resourceMap.set(resourceName, { paths: [] });
      }
      
      // Clean up operations - remove parameters operation
      const cleanedOperations = this.cleanOperations(operations);
      
      resourceMap.get(resourceName).paths.push({ 
        path, 
        operations: cleanedOperations,
        routePath: this.nameGenerator.toRouteName(path),
        controllerName: this.nameGenerator.getControllerName(resourceName),
        routerName: this.nameGenerator.getRouteName(resourceName)
      });
    });

    return resourceMap;
  }

  getResourceName(pathKey) {
    const segments = pathKey.split('/');
    const rawName = segments[1]; // Get first path segment after leading slash
    return this.nameGenerator.toCamelCase(rawName);
  }

  cleanOperations(operations) {
    const cleanedOps = {};
    Object.entries(operations).forEach(([method, operation]) => {
      if (method !== 'parameters') {
        cleanedOps[method] = {
          ...operation,
          controllerMethod: this.nameGenerator.generateControllerMethodName(method, operation),
          routeMethod: this.nameGenerator.generateRouteMethodName(method, operation)
        };
      }
    });
    return cleanedOps;
  }
}

module.exports = { ResourceMapper };
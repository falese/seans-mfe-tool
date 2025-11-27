const { NameGenerator } = require('./NameGenerator');

class ResourceMapper {
  mapResources(spec) {
    const resourceMap = new Map();

    // Group paths by resource
    Object.entries(spec.paths).forEach(([path, operations]) => {
      const resourceName = this.getResourceName(path);
      if (!resourceMap.has(resourceName)) {
        resourceMap.set(resourceName, { paths: [] });
      }
      
      // Clean up operations - remove parameters operation
      const cleanedOperations = this.cleanOperations(operations, resourceName, path);
      
      resourceMap.get(resourceName).paths.push({ 
        path, 
        operations: cleanedOperations,
        routePath: NameGenerator.getRouteName(path),
        controllerName: NameGenerator.getControllerName(resourceName),
        routerName: NameGenerator.getRouteName(path)
      });
    });

    return resourceMap;
  }

  getResourceName(pathKey) {
    // Strip query parameters if present
    const cleanPath = pathKey.split('?')[0];
    const segments = cleanPath.split('/');
    const rawName = segments[1]; // Get first path segment after leading slash
    return NameGenerator.toCamelCase(rawName);
  }

  cleanOperations(operations, resourceName, path) {
    const cleanedOps = {};
    Object.entries(operations).forEach(([method, operation]) => {
      if (method !== 'parameters') {
        cleanedOps[method] = {
          ...operation,
          controllerMethod: NameGenerator.generateControllerMethodName(method, resourceName, path),
          routeMethod: NameGenerator.generateRouteMethodName(method, resourceName)
        };
      }
    });
    return cleanedOps;
  }
}

module.exports = { ResourceMapper };

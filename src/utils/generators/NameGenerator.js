class NameGenerator {
  static toCamelCase(str) {
    if (!str) return '';
    
    return String(str)
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, c => c.toLowerCase());
  }

  static toPascalCase(str) {
    if (!str) return '';
    
    return String(str)
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[a-z]/, c => c.toUpperCase());
  }

  static toKebabCase(str) {
    if (!str) return '';
    
    return String(str)
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase();
  }

  static toSingular(str) {
    if (!str) return '';
    str = String(str);
    
    if (str.endsWith('ies')) {
      return str.slice(0, -3) + 'y';
    }
    if (str.endsWith('s') && !str.endsWith('ss')) {
      return str.slice(0, -1);
    }
    return str;
  }

  static toModelName(resourceName) {
    const singular = this.toSingular(resourceName);
    return this.toPascalCase(singular);
  }

  static getRouteName(path) {
    const resource = path.split('/')[1];
    return `${this.toKebabCase(resource)}`;
  }

  static getControllerName(resourceName) {
    return `${this.toCamelCase(resourceName)}Controller`;
  }

  static normalizePathParams(path) {
    return path.replace(/{([^}]+)}/g, ':$1');
  }

  static generateControllerMethodName(method, resourceName, path) {
    const isCollection = !path.includes('{');
    const base = this.toPascalCase(resourceName);
    
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

  static generateRouteMethodName(method, resourceName) {
    const base = this.toPascalCase(resourceName);
    const methodPrefix = method.toLowerCase();
    return `${methodPrefix}${base}`;
  }
}

module.exports = { NameGenerator };
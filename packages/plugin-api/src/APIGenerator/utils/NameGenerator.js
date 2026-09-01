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

  static toPlural(str) {
    if (!str) return '';
    str = String(str);
    
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies';
    }
    if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x')) {
      return str + 'es';
    }
    return str + 's';
  }

  // Returns singular PascalCase for model class and variable names
  static toModelName(resourceName) {
    const singular = this.toSingular(resourceName);
    return this.toPascalCase(singular);
  }

  /**
   * The model a controller for `resourcePath` should actually query.
   *
   * `toModelName` derives a name from the PATH; models are generated from
   * `components.schemas`. When those disagree the controller references a model
   * that was never registered and every request 500s with "Cannot read
   * properties of undefined". `/leaderboard` returning `LeaderboardEntry` is
   * the case that exposed it; `/pets` returning `Pet` is why it stayed hidden.
   *
   * Exact match wins. Otherwise the first schema that EXTENDS the derived name
   * (`Leaderboard` -> `LeaderboardEntry`) is used, since that is the generator's
   * own convention for a resource's response type. `New*` request-body schemas
   * are never candidates — they describe input, not the persisted row.
   */
  static resolveModelName(resourcePath, schemas) {
    const derived = this.toModelName(resourcePath);
    const names = Object.keys(schemas || {});
    if (names.length === 0) return derived;

    if (names.includes(derived)) return derived;

    const extension = names
      .filter((name) => !name.startsWith('New'))
      .filter((name) => name !== derived && name.startsWith(derived))
      .sort((a, b) => a.length - b.length)[0];

    return extension || derived;
  }

  // Returns plural PascalCase for mongoose model registration
  static toMongooseName(resourceName) {
    const singular = this.toSingular(resourceName);
    const plural = this.toPlural(singular);
    return this.toPascalCase(plural);
  }

  // Returns singular PascalCase for file naming
  static toFileName(resourceName) {
    const modelName = this.toModelName(resourceName);
    return `${modelName}.model.js`;
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

  static generateControllerMethodName(method, resourceName, path, operation) {
    // operationId is the spec author's chosen name; route files already use
    // it, so controllers must derive the identical identifier or the route
    // imports resolve to undefined and Express crashes at mount.
    if (operation?.operationId) {
      return this.toCamelCase(operation.operationId);
    }

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

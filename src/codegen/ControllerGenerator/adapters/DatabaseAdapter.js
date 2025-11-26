const { NameGenerator } = require('../../generators/NameGenerator');

class DatabaseAdapter {
  static create(dbType) {
    switch (dbType?.toLowerCase()) {
      case 'mongodb':
      case 'mongo':
        return new MongoDBAdapter();
      case 'sqlite':
      case 'sql':
        return new SQLiteAdapter();
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  getModelName(resourcePath) {
    if (!resourcePath) {
      throw new Error('Resource path is required to generate model name');
    }
    // Extract resource name from path
    const resource = String(resourcePath).split('/')[1] || resourcePath;
    return NameGenerator.toPascalCase(resource);
  }

  getImportStatement() {
    throw new Error('Method not implemented');
  }
}

class MongoDBAdapter extends DatabaseAdapter {
  getImportStatement() {
    return `const Model = require('../models');`;
  }

  generateFindQuery(method, path) {
    const modelName = this.getModelName(path);
    if (path.includes('{')) {
      const paramName = path.match(/{([^}]+)}/)[1];
      return `Model.${modelName}.findById(req.params.${paramName})`;
    }
    return `Model.${modelName}
      .find(req.query)
      .limit(parseInt(req.query.limit) || 10)
      .skip(parseInt(req.query.offset) || 0)`;
  }

  generateCreateQuery(resourceName) {
    const modelName = this.getModelName(resourceName);
    return `Model.${modelName}.create(req.body)`;
  }

  generateUpdateQuery(method, path) {
    const modelName = this.getModelName(path);
    const paramName = path.match(/{([^}]+)}/)[1];
    return `Model.${modelName}.findByIdAndUpdate(req.params.${paramName}, req.body, { new: true })`;
  }

  generateDeleteQuery(path) {
    const modelName = this.getModelName(path);
    const paramName = path.match(/{([^}]+)}/)[1];
    return `Model.${modelName}.findByIdAndDelete(req.params.${paramName})`;
  }
}

class SQLiteAdapter extends DatabaseAdapter {
  getImportStatement() {
    return `const db = require('../models');`;
  }

  generateFindQuery(method, path) {
    const modelName = this.getModelName(path);
    if (path.includes('{')) {
      return `db.${modelName}.findByPk(req.params.id)`;
    }
    return `db.${modelName}.findAll({
      where: req.query,
      limit: parseInt(req.query.limit) || 10,
      offset: parseInt(req.query.offset) || 0
    })`;
  }

  generateCreateQuery(resourceName) {
    const modelName = this.getModelName(resourceName);
    return `db.${modelName}.create(req.body)`;
  }

  generateUpdateQuery(method, path) {
    const modelName = this.getModelName(path);
    return `db.${modelName}.update(req.body, {
      where: { id: req.params.id }
    })`;
  }

  generateDeleteQuery(path) {
    const modelName = this.getModelName(path);
    return `db.${modelName}.destroy({
      where: { id: req.params.id }
    })`;
  }
}

module.exports = { DatabaseAdapter };
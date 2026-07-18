const { NameGenerator } = require('../../utils/NameGenerator');

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
    const singular = NameGenerator.toSingular(resource);
    return NameGenerator.toPascalCase(singular);
  }

  getImportStatement() {
    throw new Error('Method not implemented');
  }

  getPathParamName(path) {
    const match = String(path).match(/{([^}]+)}/);
    return match ? match[1] : null;
  }
}

class MongoDBAdapter extends DatabaseAdapter {
  getImportStatement() {
    return `const Model = require('../models');`;
  }

  generateFindQuery(method, path) {
    const modelName = this.getModelName(path);
    if (path.includes('{')) {
      const paramName = this.getPathParamName(path);
      // Only a parameter literally named id/_id addresses the Mongo _id;
      // anything else is a business key looked up as a document field.
      if (paramName === 'id' || paramName === '_id') {
        return `Model.${modelName}.findById(req.params.${paramName})`;
      }
      return `Model.${modelName}.findOne({ ${paramName}: req.params.${paramName} })`;
    }
    // Restrict the filter to declared schema paths so pagination params in
    // req.query never leak into the Mongo query.
    return `Model.${modelName}
      .find(Object.fromEntries(Object.entries(req.query).filter(([key]) => key in Model.${modelName}.schema.paths)))
      .limit(parseInt(req.query.limit) || 10)
      .skip(parseInt(req.query.offset) || 0)`;
  }

  generateCreateQuery(resourceName) {
    const modelName = this.getModelName(resourceName);
    return `Model.${modelName}.create(req.body)`;
  }

  generateUpdateQuery(method, path) {
    const modelName = this.getModelName(path);
    const paramName = this.getPathParamName(path);
    if (paramName === 'id' || paramName === '_id') {
      return `Model.${modelName}.findByIdAndUpdate(req.params.${paramName}, req.body, { new: true })`;
    }
    return `Model.${modelName}.findOneAndUpdate({ ${paramName}: req.params.${paramName} }, req.body, { new: true })`;
  }

  generateDeleteQuery(path) {
    const modelName = this.getModelName(path);
    const paramName = this.getPathParamName(path);
    if (paramName === 'id' || paramName === '_id') {
      return `Model.${modelName}.findByIdAndDelete(req.params.${paramName})`;
    }
    return `Model.${modelName}.findOneAndDelete({ ${paramName}: req.params.${paramName} })`;
  }
}

class SQLiteAdapter extends DatabaseAdapter {
  getImportStatement() {
    return `const db = require('../models');`;
  }

  generateFindQuery(method, path) {
    const modelName = this.getModelName(path);
    if (path.includes('{')) {
      const paramName = this.getPathParamName(path);
      // findByPk only when the spec's parameter is literally the primary
      // key; any other name is a business key looked up by column.
      if (paramName === 'id') {
        return `db.${modelName}.findByPk(req.params.id)`;
      }
      return `db.${modelName}.findOne({ where: { ${paramName}: req.params.${paramName} } })`;
    }
    // Restrict the where clause to real model attributes so pagination
    // params never reach SQL (\`no such column: ${modelName}.limit\`).
    return `db.${modelName}.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.${modelName}.rawAttributes)),
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
    const paramName = this.getPathParamName(path) || 'id';
    return `db.${modelName}.update(req.body, {
      where: { ${paramName}: req.params.${paramName} }
    })`;
  }

  generateDeleteQuery(path) {
    const modelName = this.getModelName(path);
    const paramName = this.getPathParamName(path) || 'id';
    return `db.${modelName}.destroy({
      where: { ${paramName}: req.params.${paramName} }
    })`;
  }
}

module.exports = { DatabaseAdapter };
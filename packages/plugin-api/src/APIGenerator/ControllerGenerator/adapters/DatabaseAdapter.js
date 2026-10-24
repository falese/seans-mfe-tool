const { NameGenerator } = require('../../utils/NameGenerator');

class DatabaseAdapter {
  /**
   * @param {string} dbType
   * @param {object} [schemas] `components.schemas` from the spec. Supplying it
   *   lets model names resolve against the models that are actually generated
   *   rather than against the URL path — see getModelName.
   */
  static create(dbType, schemas) {
    switch (dbType?.toLowerCase()) {
      case 'mongodb':
      case 'mongo':
        return new MongoDBAdapter(schemas);
      case 'sqlite':
      case 'sql':
        return new SQLiteAdapter(schemas);
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  constructor(schemas) {
    this.schemas = schemas;
  }

  /**
   * The model this resource's generated queries should reference.
   *
   * Every emitted query body (`db.X.findAll`, `Model.X.create`, …) goes through
   * here, which is why resolution has to happen at this level: ControllerGenerator
   * computing a name and passing it down does nothing, because each helper
   * re-derives its own.
   *
   * With schemas available the name resolves against the models that are
   * actually generated; without them it falls back to the original path
   * derivation, so callers that never pass schemas behave exactly as before.
   */
  getModelName(resourcePath) {
    if (!resourcePath) {
      throw new Error('Resource path is required to generate model name');
    }
    const resource = String(resourcePath).split('/')[1] || resourcePath;
    return NameGenerator.resolveModelName(`/${resource}`, this.schemas);
  }

  getImportStatement() {
    throw new Error('Method not implemented');
  }

  getPathParamName(path) {
    const match = String(path).match(/{([^}]+)}/);
    return match ? match[1] : null;
  }

  /**
   * The list pagination an operation declares, as code expressions for the
   * page size and the row offset — or null when it declares none (#428).
   *
   * Specs name these differently: `limit` + `offset`, `pageSize`, or a
   * 1-based `Page` + `PageSize`. Each declared default is honored. Where the
   * spec is silent the old behavior stands: a page size with no default
   * falls back to 10, and an undeclared offset is still read from `offset`.
   */
  getPagination(operation) {
    const params = (operation?.parameters ?? []).filter((p) => p && p.in === 'query');
    const find = (names) => params.find((p) => names.includes(String(p.name).toLowerCase()));
    const size = find(['limit', 'pagesize', 'page_size', 'per_page', 'perpage']);
    if (!size) return null;

    const intOr = (param, fallback) =>
      `parseInt(req.query.${param.name}, 10) || ${param.schema?.default ?? fallback}`;
    const sizeExpr = intOr(size, 10);

    const offset = find(['offset', 'skip']);
    if (offset) return { size: sizeExpr, offset: intOr(offset, 0) };

    const page = find(['page', 'page_number', 'pagenumber']);
    if (page) return { size: sizeExpr, offset: `((${intOr(page, 1)}) - 1) * (${sizeExpr})` };

    // The spec declares no offset or page: keep the generator's old offset
    // handling rather than silently dropping an `offset` callers may send.
    return { size: sizeExpr, offset: 'parseInt(req.query.offset) || 0' };
  }
}

class MongoDBAdapter extends DatabaseAdapter {
  getImportStatement() {
    return `const Model = require('../models');`;
  }

  generateFindQuery(method, path, operation) {
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
    // Honor the spec's declared pagination when it has one (#428).
    const page = this.getPagination(operation);
    return `Model.${modelName}
      .find(Object.fromEntries(Object.entries(req.query).filter(([key]) => key in Model.${modelName}.schema.paths)))
      .limit(${page ? page.size : 'parseInt(req.query.limit) || 10'})
      .skip(${page ? page.offset : 'parseInt(req.query.offset) || 0'})`;
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

  generateFindQuery(method, path, operation) {
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
    // Honor the spec's declared pagination when it has one (#428).
    const page = this.getPagination(operation);
    return `db.${modelName}.findAll({
      where: Object.fromEntries(Object.entries(req.query).filter(([key]) => key in db.${modelName}.rawAttributes)),
      limit: ${page ? page.size : 'parseInt(req.query.limit) || 10'},
      offset: ${page ? page.offset : 'parseInt(req.query.offset) || 0'}
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
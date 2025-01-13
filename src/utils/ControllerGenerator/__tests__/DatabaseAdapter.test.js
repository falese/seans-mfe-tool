const { DatabaseAdapter } = require('../adapters/DatabaseAdapter');
const { NameGenerator } = require('../../generators/NameGenerator');

jest.mock('../../generators/NameGenerator');

describe('DatabaseAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a MongoDBAdapter for mongodb', () => {
      const adapter = DatabaseAdapter.create('mongodb');
      expect(adapter).toBeInstanceOf(DatabaseAdapter.MongoDBAdapter);
    });

    it('should create a SQLiteAdapter for sqlite', () => {
      const adapter = DatabaseAdapter.create('sqlite');
      expect(adapter).toBeInstanceOf(DatabaseAdapter.SQLiteAdapter);
    });

    it('should throw an error for unsupported database types', () => {
      expect(() => DatabaseAdapter.create('unsupported')).toThrow('Unsupported database type: unsupported');
    });
  });

  describe('getModelName', () => {
    it('should return the model name for a valid resource path', () => {
      NameGenerator.toPascalCase.mockReturnValue('Resource');
      const adapter = new DatabaseAdapter();
      const modelName = adapter.getModelName('/resource');
      expect(modelName).toBe('Resource');
    });

    it('should throw an error if resource path is not provided', () => {
      const adapter = new DatabaseAdapter();
      expect(() => adapter.getModelName()).toThrow('Resource path is required to generate model name');
    });
  });

  describe('MongoDBAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new DatabaseAdapter.MongoDBAdapter();
    });

    describe('getImportStatement', () => {
      it('should return the correct import statement', () => {
        const importStatement = adapter.getImportStatement();
        expect(importStatement).toBe("const Model = require('../models');");
      });
    });

    describe('generateFindQuery', () => {
      it('should generate a find query for a path without parameters', () => {
        const query = adapter.generateFindQuery('get', '/resource');
        expect(query).toBe("Model.Resource.find(req.query).limit(parseInt(req.query.limit) || 10).skip(parseInt(req.query.offset) || 0)");
      });

      it('should generate a find query for a path with parameters', () => {
        const query = adapter.generateFindQuery('get', '/resource/{id}');
        expect(query).toBe("Model.Resource.findById(req.params.id)");
      });
    });

    describe('generateCreateQuery', () => {
      it('should generate a create query', () => {
        const query = adapter.generateCreateQuery('/resource');
        expect(query).toBe("Model.Resource.create(req.body)");
      });
    });

    describe('generateUpdateQuery', () => {
      it('should generate an update query', () => {
        const query = adapter.generateUpdateQuery('put', '/resource/{id}');
        expect(query).toBe("Model.Resource.findByIdAndUpdate(req.params.id, req.body, { new: true })");
      });
    });

    describe('generateDeleteQuery', () => {
      it('should generate a delete query', () => {
        const query = adapter.generateDeleteQuery('/resource/{id}');
        expect(query).toBe("Model.Resource.findByIdAndDelete(req.params.id)");
      });
    });
  });

  describe('SQLiteAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new DatabaseAdapter.SQLiteAdapter();
    });

    describe('getImportStatement', () => {
      it('should return the correct import statement', () => {
        const importStatement = adapter.getImportStatement();
        expect(importStatement).toBe("const db = require('../models');");
      });
    });

    describe('generateFindQuery', () => {
      it('should generate a find query for a path without parameters', () => {
        const query = adapter.generateFindQuery('get', '/resource');
        expect(query).toBe("db.Resource.findAll({ where: req.query, limit: parseInt(req.query.limit) || 10, offset: parseInt(req.query.offset) || 0 })");
      });

      it('should generate a find query for a path with parameters', () => {
        const query = adapter.generateFindQuery('get', '/resource/{id}');
        expect(query).toBe("db.Resource.findByPk(req.params.id)");
      });
    });

    describe('generateCreateQuery', () => {
      it('should generate a create query', () => {
        const query = adapter.generateCreateQuery('/resource');
        expect(query).toBe("db.Resource.create(req.body)");
      });
    });

    describe('generateUpdateQuery', () => {
      it('should generate an update query', () => {
        const query = adapter.generateUpdateQuery('put', '/resource/{id}');
        expect(query).toBe("db.Resource.update(req.body, { where: { id: req.params.id } })");
      });
    });

    describe('generateDeleteQuery', () => {
      it('should generate a delete query', () => {
        const query = adapter.generateDeleteQuery('/resource/{id}');
        expect(query).toBe("db.Resource.destroy({ where: { id: req.params.id } })");
      });
    });
  });
});

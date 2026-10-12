const { DatabaseAdapter } = require('../adapters/DatabaseAdapter');

describe('DatabaseAdapter', () => {
  describe('DatabaseAdapter.create', () => {
    it('should create MongoDBAdapter for "mongodb"', () => {
      const adapter = DatabaseAdapter.create('mongodb');
      expect(adapter.constructor.name).toBe('MongoDBAdapter');
      expect(adapter.getImportStatement()).toContain('Model');
    });

    it('should create MongoDBAdapter for "mongo" alias', () => {
      const adapter = DatabaseAdapter.create('mongo');
      expect(adapter.constructor.name).toBe('MongoDBAdapter');
    });

    it('should create SQLiteAdapter for "sqlite"', () => {
      const adapter = DatabaseAdapter.create('sqlite');
      expect(adapter.constructor.name).toBe('SQLiteAdapter');
      expect(adapter.getImportStatement()).toContain('db');
    });

    it('should create SQLiteAdapter for "sql" alias', () => {
      const adapter = DatabaseAdapter.create('sql');
      expect(adapter.constructor.name).toBe('SQLiteAdapter');
    });

    it('should be case-insensitive', () => {
      const mongoUpper = DatabaseAdapter.create('MONGODB');
      const mongoMixed = DatabaseAdapter.create('MongoDb');
      const sqliteUpper = DatabaseAdapter.create('SQLITE');
      
      expect(mongoUpper.constructor.name).toBe('MongoDBAdapter');
      expect(mongoMixed.constructor.name).toBe('MongoDBAdapter');
      expect(sqliteUpper.constructor.name).toBe('SQLiteAdapter');
    });

    it('should throw error for unsupported database type', () => {
      expect(() => DatabaseAdapter.create('postgresql')).toThrow('Unsupported database type');
      expect(() => DatabaseAdapter.create('postgresql')).toThrow('postgresql');
    });

    it('should throw error for null database type', () => {
      expect(() => DatabaseAdapter.create(null)).toThrow('Unsupported database type');
    });

    it('should throw error for undefined database type', () => {
      expect(() => DatabaseAdapter.create(undefined)).toThrow('Unsupported database type');
    });

    it('should throw error for empty string', () => {
      expect(() => DatabaseAdapter.create('')).toThrow('Unsupported database type');
    });

    it('should throw error if base class getImportStatement called directly', () => {
      const baseAdapter = new DatabaseAdapter();
      expect(() => baseAdapter.getImportStatement()).toThrow('Method not implemented');
    });
  });

  describe('DatabaseAdapter.getModelName', () => {
    let adapter;

    beforeEach(() => {
      adapter = DatabaseAdapter.create('mongodb');
    });

    it('should extract and singularize resource name from path', () => {
      expect(adapter.getModelName('/users')).toBe('User');
      expect(adapter.getModelName('/pets')).toBe('Pet');
      expect(adapter.getModelName('/posts')).toBe('Post');
    });

    it('should handle paths with parameters', () => {
      expect(adapter.getModelName('/users/{id}')).toBe('User');
      expect(adapter.getModelName('/pets/{petId}')).toBe('Pet');
    });

    it('should handle paths with leading slash', () => {
      expect(adapter.getModelName('/users')).toBe('User');
    });

    it('should handle paths without leading slash', () => {
      expect(adapter.getModelName('users')).toBe('User');
    });

    it('should convert to PascalCase', () => {
      expect(adapter.getModelName('/user-profiles')).toBe('UserProfile');
      expect(adapter.getModelName('/user_profiles')).toBe('UserProfile');
    });

    it('should singularize plural nouns', () => {
      expect(adapter.getModelName('/categories')).toBe('Category');
      expect(adapter.getModelName('/companies')).toBe('Company');
    });

    it('should throw error for undefined resource path', () => {
      expect(() => adapter.getModelName(undefined)).toThrow('Resource path is required');
    });

    it('should throw error for null resource path', () => {
      expect(() => adapter.getModelName(null)).toThrow('Resource path is required');
    });

    it('should throw error for empty string', () => {
      expect(() => adapter.getModelName('')).toThrow('Resource path is required');
    });

    it('should handle nested resource paths', () => {
      expect(adapter.getModelName('/organizations/{orgId}/projects')).toBe('Organization');
    });
  });

  describe('MongoDBAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = DatabaseAdapter.create('mongodb');
    });

    describe('getImportStatement', () => {
      it('should return correct MongoDB import', () => {
        const result = adapter.getImportStatement();
        expect(result).toBe(`const Model = require('../models');`);
      });
    });

    describe('generateFindQuery', () => {
      it('should generate findOne on the declared parameter for business keys', () => {
        const result = adapter.generateFindQuery('get', '/users/{userId}');

        expect(result).toContain('Model.User.findOne');
        expect(result).toContain('userId: req.params.userId');
      });

      it('should generate findById only for a parameter literally named id', () => {
        const result = adapter.generateFindQuery('get', '/users/{id}');

        expect(result).toContain('Model.User.findById(req.params.id)');
      });

      it('should generate find restricted to schema paths for collection paths', () => {
        const result = adapter.generateFindQuery('get', '/users');

        expect(result).toContain('Model.User');
        expect(result).not.toContain('.find(req.query)');
        expect(result).toContain('schema.paths');
        expect(result).toContain('.limit(parseInt(req.query.limit) || 10)');
        expect(result).toContain('.skip(parseInt(req.query.offset) || 0)');
      });

      it('should extract parameter name from path', () => {
        expect(adapter.generateFindQuery('get', '/pets/{petId}')).toContain('req.params.petId');
        expect(adapter.generateFindQuery('get', '/posts/{postId}')).toContain('req.params.postId');
      });

      it('should handle multiple parameters (use first)', () => {
        const result = adapter.generateFindQuery('get', '/orgs/{orgId}/projects/{projectId}');

        expect(result).toContain('Model.Org.findOne');
        expect(result).toContain('orgId: req.params.orgId');
      });

      it('should singularize model names', () => {
        expect(adapter.generateFindQuery('get', '/users')).toContain('Model.User');
        expect(adapter.generateFindQuery('get', '/pets/{id}')).toContain('Model.Pet');
      });

      it('should include pagination for collection queries', () => {
        const result = adapter.generateFindQuery('get', '/users');
        
        expect(result).toContain('limit(parseInt(req.query.limit) || 10)');
        expect(result).toContain('skip(parseInt(req.query.offset) || 0)');
      });
    });

    describe('generateCreateQuery', () => {
      it('should generate create query', () => {
        const result = adapter.generateCreateQuery('users');
        
        expect(result).toContain('Model.User.create(req.body)');
      });

      it('should singularize model names', () => {
        expect(adapter.generateCreateQuery('pets')).toContain('Model.Pet');
        expect(adapter.generateCreateQuery('posts')).toContain('Model.Post');
      });

      it('should handle PascalCase resource names', () => {
        const result = adapter.generateCreateQuery('UserProfile');
        
        expect(result).toContain('Model.UserProfile.create(req.body)');
      });
    });

    describe('generateUpdateQuery', () => {
      it('should generate findOneAndUpdate on the declared parameter for PUT', () => {
        const result = adapter.generateUpdateQuery('put', '/users/{userId}');

        expect(result).toContain('Model.User.findOneAndUpdate');
        expect(result).toContain('userId: req.params.userId');
        expect(result).toContain('req.body');
        expect(result).toContain('{ new: true }');
      });

      it('should generate findOneAndUpdate on the declared parameter for PATCH', () => {
        const result = adapter.generateUpdateQuery('patch', '/users/{userId}');

        expect(result).toContain('Model.User.findOneAndUpdate');
        expect(result).toContain('{ new: true }');
      });

      it('should keep findByIdAndUpdate for a parameter literally named id', () => {
        const result = adapter.generateUpdateQuery('put', '/users/{id}');

        expect(result).toContain('Model.User.findByIdAndUpdate(req.params.id');
      });

      it('should extract parameter name', () => {
        expect(adapter.generateUpdateQuery('put', '/pets/{petId}')).toContain('req.params.petId');
        expect(adapter.generateUpdateQuery('patch', '/posts/{postId}')).toContain('req.params.postId');
      });

      it('should singularize model names', () => {
        expect(adapter.generateUpdateQuery('put', '/users/{id}')).toContain('Model.User');
        expect(adapter.generateUpdateQuery('patch', '/pets/{id}')).toContain('Model.Pet');
      });

      it('should include new: true option for returning updated document', () => {
        const putResult = adapter.generateUpdateQuery('put', '/users/{id}');
        const patchResult = adapter.generateUpdateQuery('patch', '/users/{id}');
        
        expect(putResult).toContain('{ new: true }');
        expect(patchResult).toContain('{ new: true }');
      });
    });

    describe('generateDeleteQuery', () => {
      it('should generate findOneAndDelete on the declared parameter', () => {
        const result = adapter.generateDeleteQuery('/users/{userId}');

        expect(result).toContain('Model.User.findOneAndDelete');
        expect(result).toContain('userId: req.params.userId');
      });

      it('should keep findByIdAndDelete for a parameter literally named id', () => {
        expect(adapter.generateDeleteQuery('/users/{id}'))
          .toContain('Model.User.findByIdAndDelete(req.params.id)');
      });

      it('should extract parameter name from path', () => {
        expect(adapter.generateDeleteQuery('/pets/{petId}')).toContain('req.params.petId');
        expect(adapter.generateDeleteQuery('/posts/{postId}')).toContain('req.params.postId');
      });

      it('should singularize model names', () => {
        expect(adapter.generateDeleteQuery('/users/{id}')).toContain('Model.User');
        expect(adapter.generateDeleteQuery('/pets/{id}')).toContain('Model.Pet');
      });
    });
  });

  describe('SQLiteAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = DatabaseAdapter.create('sqlite');
    });

    describe('getImportStatement', () => {
      it('should return correct Sequelize import', () => {
        const result = adapter.getImportStatement();
        expect(result).toBe(`const db = require('../models');`);
      });
    });

    describe('generateFindQuery', () => {
      it('should generate findOne on the declared parameter for business keys', () => {
        const result = adapter.generateFindQuery('get', '/users/{userId}');

        expect(result).toContain('db.User.findOne');
        expect(result).toContain('userId: req.params.userId');
      });

      it('should keep findByPk for a parameter literally named id', () => {
        const result = adapter.generateFindQuery('get', '/users/{id}');

        expect(result).toContain('db.User.findByPk(req.params.id)');
      });

      it('should generate findAll restricted to model attributes for collection paths', () => {
        const result = adapter.generateFindQuery('get', '/users');

        expect(result).toContain('db.User.findAll');
        expect(result).not.toContain('where: req.query');
        expect(result).toContain('rawAttributes');
        expect(result).toContain('limit: parseInt(req.query.limit) || 10');
        expect(result).toContain('offset: parseInt(req.query.offset) || 0');
      });

      it('should use the declared parameter name for every by-id lookup', () => {
        expect(adapter.generateFindQuery('get', '/pets/{petId}')).toContain('req.params.petId');
        expect(adapter.generateFindQuery('get', '/users/{userId}')).toContain('req.params.userId');
      });

      it('should singularize model names', () => {
        expect(adapter.generateFindQuery('get', '/users')).toContain('db.User');
        expect(adapter.generateFindQuery('get', '/pets/{id}')).toContain('db.Pet');
      });

      it('should include pagination for findAll queries', () => {
        const result = adapter.generateFindQuery('get', '/users');
        
        expect(result).toContain('limit: parseInt(req.query.limit) || 10');
        expect(result).toContain('offset: parseInt(req.query.offset) || 0');
      });

      it('should filter the where clause to model attributes', () => {
        const result = adapter.generateFindQuery('get', '/users');

        expect(result).toContain('key in db.User.rawAttributes');
      });
    });

    describe('generateCreateQuery', () => {
      it('should generate create query', () => {
        const result = adapter.generateCreateQuery('users');
        
        expect(result).toContain('db.User.create(req.body)');
      });

      it('should singularize model names', () => {
        expect(adapter.generateCreateQuery('pets')).toContain('db.Pet');
        expect(adapter.generateCreateQuery('posts')).toContain('db.Post');
      });

      it('should handle PascalCase resource names', () => {
        const result = adapter.generateCreateQuery('UserProfile');
        
        expect(result).toContain('db.UserProfile.create(req.body)');
      });
    });

    describe('generateUpdateQuery', () => {
      it('should generate update query with where clause on the declared parameter', () => {
        const result = adapter.generateUpdateQuery('put', '/users/{userId}');

        expect(result).toContain('db.User.update(req.body');
        expect(result).toContain('where: { userId: req.params.userId }');
      });

      it('should work for both PUT and PATCH', () => {
        const putResult = adapter.generateUpdateQuery('put', '/users/{id}');
        const patchResult = adapter.generateUpdateQuery('patch', '/users/{id}');
        
        expect(putResult).toContain('db.User.update');
        expect(patchResult).toContain('db.User.update');
      });

      it('should use the declared parameter name in the where clause', () => {
        expect(adapter.generateUpdateQuery('put', '/pets/{petId}')).toContain('req.params.petId');
        expect(adapter.generateUpdateQuery('patch', '/users/{userId}')).toContain('req.params.userId');
      });

      it('should singularize model names', () => {
        expect(adapter.generateUpdateQuery('put', '/users/{id}')).toContain('db.User');
        expect(adapter.generateUpdateQuery('patch', '/pets/{id}')).toContain('db.Pet');
      });

      it('should include where clause with id', () => {
        const result = adapter.generateUpdateQuery('put', '/users/{id}');
        
        expect(result).toContain('where: { id: req.params.id }');
      });
    });

    describe('generateDeleteQuery', () => {
      it('should generate destroy query with where clause on the declared parameter', () => {
        const result = adapter.generateDeleteQuery('/users/{userId}');

        expect(result).toContain('db.User.destroy');
        expect(result).toContain('where: { userId: req.params.userId }');
      });

      it('should use the declared parameter name in the where clause', () => {
        expect(adapter.generateDeleteQuery('/pets/{petId}')).toContain('req.params.petId');
        expect(adapter.generateDeleteQuery('/users/{userId}')).toContain('req.params.userId');
      });

      it('should singularize model names', () => {
        expect(adapter.generateDeleteQuery('/users/{id}')).toContain('db.User');
        expect(adapter.generateDeleteQuery('/pets/{id}')).toContain('db.Pet');
      });

      it('should include where clause with id', () => {
        const result = adapter.generateDeleteQuery('/users/{id}');
        
        expect(result).toContain('where: { id: req.params.id }');
      });
    });
  });

  describe('Cross-adapter comparison', () => {
    let mongoAdapter;
    let sqliteAdapter;

    beforeEach(() => {
      mongoAdapter = DatabaseAdapter.create('mongodb');
      sqliteAdapter = DatabaseAdapter.create('sqlite');
    });

    it('should both singularize model names consistently', () => {
      expect(mongoAdapter.getModelName('/users')).toBe('User');
      expect(sqliteAdapter.getModelName('/users')).toBe('User');
    });

    it('should have different import statements', () => {
      expect(mongoAdapter.getImportStatement()).toContain('Model');
      expect(sqliteAdapter.getImportStatement()).toContain('db');
    });

    it('should generate different query syntax for find operations', () => {
      const mongoFind = mongoAdapter.generateFindQuery('get', '/users/{id}');
      const sqliteFind = sqliteAdapter.generateFindQuery('get', '/users/{id}');
      
      expect(mongoFind).toContain('findById');
      expect(sqliteFind).toContain('findByPk');
    });

    it('should generate different query syntax for create operations', () => {
      const mongoCreate = mongoAdapter.generateCreateQuery('users');
      const sqliteCreate = sqliteAdapter.generateCreateQuery('users');
      
      expect(mongoCreate).toContain('Model.');
      expect(sqliteCreate).toContain('db.');
    });

    it('should generate different query syntax for update operations', () => {
      const mongoUpdate = mongoAdapter.generateUpdateQuery('put', '/users/{id}');
      const sqliteUpdate = sqliteAdapter.generateUpdateQuery('put', '/users/{id}');
      
      expect(mongoUpdate).toContain('findByIdAndUpdate');
      expect(sqliteUpdate).toContain('update');
      expect(sqliteUpdate).toContain('where:');
    });

    it('should generate different query syntax for delete operations', () => {
      const mongoDelete = mongoAdapter.generateDeleteQuery('/users/{id}');
      const sqliteDelete = sqliteAdapter.generateDeleteQuery('/users/{id}');
      
      expect(mongoDelete).toContain('findByIdAndDelete');
      expect(sqliteDelete).toContain('destroy');
      expect(sqliteDelete).toContain('where:');
    });
  });

  // #428: list queries honor the operation's declared pagination instead of
  // a hardcoded `limit || 10`. Operations that declare none keep the old
  // behavior (covered by the tests above).
  describe('declared pagination (#428)', () => {
    const q = (name, schema) => ({ name, in: 'query', schema });
    const harbormaster = { parameters: [q('offset', { type: 'integer', default: 0 }), q('limit', { type: 'integer', default: 50 })] };
    const stationOs = { parameters: [q('Page', { type: 'integer', default: 1 }), q('PageSize', { type: 'integer', default: 20 })] };
    const ledger = { parameters: [q('pageSize', { type: 'integer', default: 25 })] };
    const noDefault = { parameters: [q('limit', { type: 'integer' })] };

    describe('SQLite', () => {
      const adapter = DatabaseAdapter.create('sqlite');

      it('uses a declared limit default and offset (Harbormaster)', () => {
        const result = adapter.generateFindQuery('get', '/dockings', harbormaster);
        expect(result).toContain('limit: parseInt(req.query.limit, 10) || 50');
        expect(result).toContain('offset: parseInt(req.query.offset, 10) || 0');
        expect(result).not.toContain('|| 10,');
      });

      it('maps a 1-based Page/PageSize pair to limit and offset (StationOS)', () => {
        const result = adapter.generateFindQuery('get', '/telemetry', stationOs);
        expect(result).toContain('limit: parseInt(req.query.PageSize, 10) || 20');
        expect(result).toContain('offset: ((parseInt(req.query.Page, 10) || 1) - 1) * (parseInt(req.query.PageSize, 10) || 20)');
      });

      it('falls back to 10 when the page size declares no default', () => {
        const result = adapter.generateFindQuery('get', '/dockings', noDefault);
        expect(result).toContain('limit: parseInt(req.query.limit, 10) || 10');
      });

      it('keeps the old offset handling when the spec declares no offset or page', () => {
        // Silence in the spec means unchanged behavior (petstore declares only limit).
        const result = adapter.generateFindQuery('get', '/pets', noDefault);
        expect(result).toContain('offset: parseInt(req.query.offset) || 0');
      });

      it('keeps the old query when the operation declares no pagination', () => {
        expect(adapter.generateFindQuery('get', '/users', { parameters: [] }))
          .toBe(adapter.generateFindQuery('get', '/users'));
      });

      it('ignores declared pagination on item lookups', () => {
        expect(adapter.generateFindQuery('get', '/dockings/{docking_id}', harbormaster))
          .toBe(adapter.generateFindQuery('get', '/dockings/{docking_id}'));
      });
    });

    describe('MongoDB', () => {
      const adapter = DatabaseAdapter.create('mongodb');

      it('uses a declared pageSize default with no offset parameter (StellarLedger)', () => {
        const result = adapter.generateFindQuery('get', '/charges', ledger);
        expect(result).toContain('.limit(parseInt(req.query.pageSize, 10) || 25)');
        expect(result).toContain('.skip(parseInt(req.query.offset) || 0)');
      });

      it('maps Page/PageSize to limit and skip', () => {
        const result = adapter.generateFindQuery('get', '/telemetry', stationOs);
        expect(result).toContain('.limit(parseInt(req.query.PageSize, 10) || 20)');
        expect(result).toContain('.skip(((parseInt(req.query.Page, 10) || 1) - 1) * (parseInt(req.query.PageSize, 10) || 20))');
      });

      it('keeps the old query when the operation declares no pagination', () => {
        expect(adapter.generateFindQuery('get', '/users', {}))
          .toBe(adapter.generateFindQuery('get', '/users'));
      });
    });
  });
});

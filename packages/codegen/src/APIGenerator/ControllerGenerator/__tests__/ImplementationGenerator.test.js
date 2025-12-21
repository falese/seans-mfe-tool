const { ImplementationGenerator } = require('../generators/ImplementationGenerator');
const { DatabaseAdapter } = require('../adapters/DatabaseAdapter');

describe('ImplementationGenerator', () => {
  let mongoAdapter;
  let sqliteAdapter;

  beforeEach(() => {
    mongoAdapter = DatabaseAdapter.create('mongodb');
    sqliteAdapter = DatabaseAdapter.create('sqlite');
  });

  describe('generate', () => {
    it('should route to GET implementation', () => {
      const result = ImplementationGenerator.generate('get', '/pets/{petId}', {}, 'Pet', mongoAdapter);
      expect(result).toContain('Model.Pet.findById');
      expect(result).toContain('res.status(200)');
    });

    it('should route to POST implementation', () => {
      const result = ImplementationGenerator.generate('post', '/pets', {}, 'Pet', mongoAdapter);
      expect(result).toContain('Model.Pet.create');
      expect(result).toContain('res.status(201)');
    });

    it('should route to PUT implementation', () => {
      const result = ImplementationGenerator.generate('put', '/pets/{petId}', {}, 'Pet', mongoAdapter);
      expect(result).toContain('findByIdAndUpdate');
      expect(result).toContain('res.status(200)');
    });

    it('should route to PATCH implementation', () => {
      const result = ImplementationGenerator.generate('patch', '/pets/{petId}', {}, 'Pet', mongoAdapter);
      expect(result).toContain('findByIdAndUpdate');
      expect(result).toContain('res.status(200)');
    });

    it('should route to DELETE implementation', () => {
      const result = ImplementationGenerator.generate('delete', '/pets/{petId}', {}, 'Pet', mongoAdapter);
      expect(result).toContain('findByIdAndDelete');
      expect(result).toContain('res.status(204)');
    });

    it('should route to default implementation for unknown methods', () => {
      const result = ImplementationGenerator.generate('options', '/pets', {}, 'Pet', mongoAdapter);
      expect(result).toContain('ApiError(501');
      expect(result).toContain('Not implemented');
    });

    it('should be case-insensitive for HTTP methods', () => {
      const resultLower = ImplementationGenerator.generate('get', '/pets', {}, 'Pet', mongoAdapter);
      const resultUpper = ImplementationGenerator.generate('GET', '/pets', {}, 'Pet', mongoAdapter);
      const resultMixed = ImplementationGenerator.generate('Get', '/pets', {}, 'Pet', mongoAdapter);
      
      expect(resultLower).toContain('Model.Pet');
      expect(resultUpper).toContain('Model.Pet');
      expect(resultMixed).toContain('Model.Pet');
    });
  });

  describe('generateGetImplementation', () => {
    describe('MongoDB adapter', () => {
      it('should generate findById query for item paths', () => {
        const result = ImplementationGenerator.generateGetImplementation('/pets/{petId}', mongoAdapter);
        
        expect(result).toContain('Model.Pet.findById(req.params.petId)');
        expect(result).toContain('if (!item)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(200).json(item)');
      });

      it('should generate find query for collection paths', () => {
        const result = ImplementationGenerator.generateGetImplementation('/pets', mongoAdapter);
        
        expect(result).toContain('Model.Pet');
        expect(result).toContain('.find(req.query)');
        expect(result).toContain('.limit(parseInt(req.query.limit) || 10)');
        expect(result).toContain('.skip(parseInt(req.query.offset) || 0)');
        expect(result).toContain('res.status(200).json(item)');
      });

      it('should handle complex path parameters', () => {
        const result = ImplementationGenerator.generateGetImplementation('/organizations/{orgId}/projects/{projectId}', mongoAdapter);
        
        expect(result).toContain('Model.Organization.findById(req.params.orgId)');
        expect(result).toContain('if (!item)');
        expect(result).toContain('ApiError(404');
      });
    });

    describe('SQLite adapter', () => {
      it('should generate findByPk query for item paths', () => {
        const result = ImplementationGenerator.generateGetImplementation('/pets/{petId}', sqliteAdapter);
        
        expect(result).toContain('db.Pet.findByPk(req.params.id)');
        expect(result).toContain('if (!item)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(200).json(item)');
      });

      it('should generate findAll query for collection paths', () => {
        const result = ImplementationGenerator.generateGetImplementation('/pets', sqliteAdapter);
        
        expect(result).toContain('db.Pet.findAll');
        expect(result).toContain('where: req.query');
        expect(result).toContain('limit: parseInt(req.query.limit) || 10');
        expect(result).toContain('offset: parseInt(req.query.offset) || 0');
        expect(result).toContain('res.status(200).json(item)');
      });
    });

    it('should always include 404 error handling', () => {
      const mongoResult = ImplementationGenerator.generateGetImplementation('/pets/{id}', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generateGetImplementation('/pets/{id}', sqliteAdapter);
      
      expect(mongoResult).toContain("throw new ApiError(404, 'Not found')");
      expect(sqliteResult).toContain("throw new ApiError(404, 'Not found')");
    });
  });

  describe('generatePostImplementation', () => {
    describe('MongoDB adapter', () => {
      it('should generate create query', () => {
        const result = ImplementationGenerator.generatePostImplementation('Pet', mongoAdapter);
        
        expect(result).toContain('Model.Pet.create(req.body)');
        expect(result).toContain('res.status(201).json(newItem)');
      });

      it('should handle PascalCase model names', () => {
        const result = ImplementationGenerator.generatePostImplementation('UserProfile', mongoAdapter);
        
        expect(result).toContain('Model.UserProfile.create(req.body)');
      });
    });

    describe('SQLite adapter', () => {
      it('should generate create query', () => {
        const result = ImplementationGenerator.generatePostImplementation('Pet', sqliteAdapter);
        
        expect(result).toContain('db.Pet.create(req.body)');
        expect(result).toContain('res.status(201).json(newItem)');
      });
    });

    it('should always return 201 status code', () => {
      const mongoResult = ImplementationGenerator.generatePostImplementation('Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generatePostImplementation('Pet', sqliteAdapter);
      
      expect(mongoResult).toContain('res.status(201)');
      expect(sqliteResult).toContain('res.status(201)');
    });

    it('should not include 404 error handling', () => {
      const mongoResult = ImplementationGenerator.generatePostImplementation('Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generatePostImplementation('Pet', sqliteAdapter);
      
      expect(mongoResult).not.toContain('404');
      expect(sqliteResult).not.toContain('404');
    });
  });

  describe('generatePutImplementation', () => {
    describe('MongoDB adapter', () => {
      it('should generate findByIdAndUpdate query', () => {
        const result = ImplementationGenerator.generatePutImplementation('/pets/{petId}', 'Pet', mongoAdapter);
        
        expect(result).toContain('Model.Pet.findByIdAndUpdate');
        expect(result).toContain('req.params.petId');
        expect(result).toContain('req.body');
        expect(result).toContain('{ new: true }');
        expect(result).toContain('if (!updatedItem)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(200).json(updatedItem)');
      });

      it('should extract correct parameter name from path', () => {
        const result = ImplementationGenerator.generatePutImplementation('/users/{userId}', 'User', mongoAdapter);
        
        expect(result).toContain('req.params.userId');
      });
    });

    describe('SQLite adapter', () => {
      it('should generate update query', () => {
        const result = ImplementationGenerator.generatePutImplementation('/pets/{petId}', 'Pet', sqliteAdapter);
        
        expect(result).toContain('db.Pet.update(req.body');
        expect(result).toContain('where: { id: req.params.id }');
        expect(result).toContain('if (!updatedItem)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(200).json(updatedItem)');
      });
    });

    it('should always include 404 error handling', () => {
      const mongoResult = ImplementationGenerator.generatePutImplementation('/pets/{id}', 'Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generatePutImplementation('/pets/{id}', 'Pet', sqliteAdapter);
      
      expect(mongoResult).toContain("throw new ApiError(404, 'Not found')");
      expect(sqliteResult).toContain("throw new ApiError(404, 'Not found')");
    });

    it('should always return 200 status code', () => {
      const mongoResult = ImplementationGenerator.generatePutImplementation('/pets/{id}', 'Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generatePutImplementation('/pets/{id}', 'Pet', sqliteAdapter);
      
      expect(mongoResult).toContain('res.status(200)');
      expect(sqliteResult).toContain('res.status(200)');
    });
  });

  describe('generatePatchImplementation', () => {
    describe('MongoDB adapter', () => {
      it('should generate findByIdAndUpdate query', () => {
        const result = ImplementationGenerator.generatePatchImplementation('/pets/{petId}', 'Pet', mongoAdapter);
        
        expect(result).toContain('Model.Pet.findByIdAndUpdate');
        expect(result).toContain('req.params.petId');
        expect(result).toContain('req.body');
        expect(result).toContain('{ new: true }');
        expect(result).toContain('if (!patchedItem)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(200).json(patchedItem)');
      });
    });

    describe('SQLite adapter', () => {
      it('should generate update query', () => {
        const result = ImplementationGenerator.generatePatchImplementation('/pets/{petId}', 'Pet', sqliteAdapter);
        
        expect(result).toContain('db.Pet.update(req.body');
        expect(result).toContain('where: { id: req.params.id }');
        expect(result).toContain('if (!patchedItem)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(200).json(patchedItem)');
      });
    });

    it('should use different variable name than PUT (patchedItem vs updatedItem)', () => {
      const result = ImplementationGenerator.generatePatchImplementation('/pets/{id}', 'Pet', mongoAdapter);
      
      expect(result).toContain('patchedItem');
      expect(result).not.toContain('updatedItem');
    });

    it('should always include 404 error handling', () => {
      const mongoResult = ImplementationGenerator.generatePatchImplementation('/pets/{id}', 'Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generatePatchImplementation('/pets/{id}', 'Pet', sqliteAdapter);
      
      expect(mongoResult).toContain("throw new ApiError(404, 'Not found')");
      expect(sqliteResult).toContain("throw new ApiError(404, 'Not found')");
    });
  });

  describe('generateDeleteImplementation', () => {
    describe('MongoDB adapter', () => {
      it('should generate findByIdAndDelete query', () => {
        const result = ImplementationGenerator.generateDeleteImplementation('/pets/{petId}', 'Pet', mongoAdapter);
        
        expect(result).toContain('Model.Pet.findByIdAndDelete');
        expect(result).toContain('req.params.petId');
        expect(result).toContain('if (!deletedItem)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(204).send()');
      });
    });

    describe('SQLite adapter', () => {
      it('should generate destroy query', () => {
        const result = ImplementationGenerator.generateDeleteImplementation('/pets/{petId}', 'Pet', sqliteAdapter);
        
        expect(result).toContain('db.Pet.destroy');
        expect(result).toContain('where: { id: req.params.id }');
        expect(result).toContain('if (!deletedItem)');
        expect(result).toContain('ApiError(404');
        expect(result).toContain('res.status(204).send()');
      });
    });

    it('should always return 204 status code', () => {
      const mongoResult = ImplementationGenerator.generateDeleteImplementation('/pets/{id}', 'Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generateDeleteImplementation('/pets/{id}', 'Pet', sqliteAdapter);
      
      expect(mongoResult).toContain('res.status(204)');
      expect(sqliteResult).toContain('res.status(204)');
    });

    it('should use send() not json() for 204 responses', () => {
      const mongoResult = ImplementationGenerator.generateDeleteImplementation('/pets/{id}', 'Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generateDeleteImplementation('/pets/{id}', 'Pet', sqliteAdapter);
      
      expect(mongoResult).toContain('res.status(204).send()');
      expect(sqliteResult).toContain('res.status(204).send()');
      expect(mongoResult).not.toContain('.json(');
      expect(sqliteResult).not.toContain('.json(');
    });

    it('should always include 404 error handling', () => {
      const mongoResult = ImplementationGenerator.generateDeleteImplementation('/pets/{id}', 'Pet', mongoAdapter);
      const sqliteResult = ImplementationGenerator.generateDeleteImplementation('/pets/{id}', 'Pet', sqliteAdapter);
      
      expect(mongoResult).toContain("throw new ApiError(404, 'Not found')");
      expect(sqliteResult).toContain("throw new ApiError(404, 'Not found')");
    });
  });

  describe('generateDefaultImplementation', () => {
    it('should return 501 Not Implemented error', () => {
      const result = ImplementationGenerator.generateDefaultImplementation();
      
      expect(result).toContain('throw new ApiError(501');
      expect(result).toContain('Not implemented');
    });

    it('should not include any database queries', () => {
      const result = ImplementationGenerator.generateDefaultImplementation();
      
      expect(result).not.toContain('Model.');
      expect(result).not.toContain('db.');
      expect(result).not.toContain('req.');
      expect(result).not.toContain('res.');
    });

    it('should be consistent regardless of method or adapter', () => {
      const result1 = ImplementationGenerator.generateDefaultImplementation();
      const result2 = ImplementationGenerator.generateDefaultImplementation();
      
      expect(result1).toBe(result2);
    });
  });
});

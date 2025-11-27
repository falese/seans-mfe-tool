const { DatabaseGenerator } = require('../DatabaseGenerator');
const { MongoDBGenerator } = require('../generators/MongoDBGenerator');
const { SQLiteGenerator } = require('../generators/SQLiteGenerator');
const { SeedGenerator } = require('../generators/SeedGenerator');
const { MigrationGenerator } = require('../generators/MigrationGenerator');
const { MongoSchemaManager } = require('../generators/MongoSchemaManager');
const { simpleSchema } = require('./fixtures/openapi-schemas');

// Mock all generator classes
jest.mock('../generators/MongoDBGenerator');
jest.mock('../generators/SQLiteGenerator');
jest.mock('../generators/SeedGenerator');
jest.mock('../generators/MigrationGenerator');
jest.mock('../generators/MongoSchemaManager');

describe('DatabaseGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    MongoDBGenerator.prototype.generateModels = jest.fn().mockResolvedValue(undefined);
    SQLiteGenerator.prototype.generateModels = jest.fn().mockResolvedValue(undefined);
    SeedGenerator.prototype.generateSeedData = jest.fn().mockResolvedValue(undefined);
    MigrationGenerator.prototype.generateMigrations = jest.fn().mockResolvedValue(undefined);
    MongoSchemaManager.prototype.generateSchemaManagement = jest.fn().mockResolvedValue(undefined);
  });

  describe('generate', () => {
    it('should call appropriate generators for mongodb', async () => {
      await DatabaseGenerator.generate('mongodb', '/output', simpleSchema);
      
      expect(MongoDBGenerator).toHaveBeenCalled();
      expect(MongoDBGenerator.prototype.generateModels).toHaveBeenCalledWith('/output', simpleSchema);
      expect(SeedGenerator).toHaveBeenCalledWith(simpleSchema);
      expect(SeedGenerator.prototype.generateSeedData).toHaveBeenCalledWith('/output', 'mongodb');
      expect(MongoSchemaManager).toHaveBeenCalledWith(simpleSchema);
      expect(MongoSchemaManager.prototype.generateSchemaManagement).toHaveBeenCalledWith('/output');
    });

    it('should call appropriate generators for sqlite', async () => {
      await DatabaseGenerator.generate('sqlite', '/output', simpleSchema);
      
      expect(SQLiteGenerator).toHaveBeenCalled();
      expect(SQLiteGenerator.prototype.generateModels).toHaveBeenCalledWith('/output', simpleSchema);
      expect(SeedGenerator).toHaveBeenCalledWith(simpleSchema);
      expect(SeedGenerator.prototype.generateSeedData).toHaveBeenCalledWith('/output', 'sqlite');
      expect(MigrationGenerator).toHaveBeenCalledWith(simpleSchema);
      expect(MigrationGenerator.prototype.generateMigrations).toHaveBeenCalledWith('/output');
    });
  });

  describe('getGenerator', () => {
    it('should return MongoDBGenerator for mongodb', () => {
      const generator = DatabaseGenerator.getGenerator('mongodb');
      expect(generator).toBeInstanceOf(MongoDBGenerator);
    });

    it('should return MongoDBGenerator for mongo', () => {
      const generator = DatabaseGenerator.getGenerator('mongo');
      expect(generator).toBeInstanceOf(MongoDBGenerator);
    });

    it('should return SQLiteGenerator for sqlite', () => {
      const generator = DatabaseGenerator.getGenerator('sqlite');
      expect(generator).toBeInstanceOf(SQLiteGenerator);
    });

    it('should return SQLiteGenerator for sql', () => {
      const generator = DatabaseGenerator.getGenerator('sql');
      expect(generator).toBeInstanceOf(SQLiteGenerator);
    });

    it('should throw error for unsupported database type', () => {
      expect(() => DatabaseGenerator.getGenerator('invalid')).toThrow('Unsupported database type: invalid. Supported types are: mongodb, sqlite');
    });
  });
});

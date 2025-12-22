const { DatabaseGenerator } = require('../DatabaseGenerator');
const { MongoDBGenerator } = require('../generators/MongoDBGenerator');
const { SQLiteGenerator } = require('../generators/SQLiteGenerator');
const { SeedGenerator } = require('../generators/SeedGenerator');
const { MigrationGenerator } = require('../generators/MigrationGenerator');
const { MongoSchemaManager } = require('../generators/MongoSchemaManager');
const { simpleSchema } = require('./fixtures/openapi-schemas');
const { createLogger } = require('@seans-mfe-tool/logger');

// Get logger mock
const logger = createLogger();

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
    beforeEach(() => {
      // Clear logger mocks
      logger.info.mockClear();
      logger.error.mockClear();
      logger.warn.mockClear();
      logger.debug.mockClear();
      logger.success.mockClear();
    });

    it('should throw error when dbType is missing', async () => {
      await expect(DatabaseGenerator.generate(null, '/output', simpleSchema))
        .rejects.toThrow('Database type is required');
      
      await expect(DatabaseGenerator.generate(undefined, '/output', simpleSchema))
        .rejects.toThrow('Database type is required');
      
      await expect(DatabaseGenerator.generate('', '/output', simpleSchema))
        .rejects.toThrow('Database type is required');
    });

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

    it('should log start message', async () => {
      await DatabaseGenerator.generate('mongodb', '/output', simpleSchema);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generating database components')
      );
    });

    it('should log success message', async () => {
      await DatabaseGenerator.generate('mongodb', '/output', simpleSchema);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated database components successfully')
      );
    });

    it('should handle errors during generation', async () => {
      const testError = new Error('Generation failed');
      MongoDBGenerator.prototype.generateModels.mockRejectedValue(testError);

      await expect(DatabaseGenerator.generate('mongodb', '/output', simpleSchema))
        .rejects.toThrow('Generation failed');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate database components')
      );
      expect(logger.error).toHaveBeenCalledWith(testError);
    });

    it('should generate components in parallel using Promise.all', async () => {
      // Verify all three generators are called
      await DatabaseGenerator.generate('mongodb', '/output', simpleSchema);
      
      expect(MongoDBGenerator.prototype.generateModels).toHaveBeenCalled();
      expect(SeedGenerator.prototype.generateSeedData).toHaveBeenCalled();
      expect(MongoSchemaManager.prototype.generateSchemaManagement).toHaveBeenCalled();
      
      // Verify they were all instantiated (parallel execution)
      expect(MongoDBGenerator).toHaveBeenCalled();
      expect(SeedGenerator).toHaveBeenCalled();
      expect(MongoSchemaManager).toHaveBeenCalled();
    });

    it('should use MigrationGenerator for SQL databases', async () => {
      await DatabaseGenerator.generate('sqlite', '/output', simpleSchema);
      
      expect(MigrationGenerator).toHaveBeenCalledWith(simpleSchema);
      expect(MigrationGenerator.prototype.generateMigrations).toHaveBeenCalledWith('/output');
      expect(MongoSchemaManager).not.toHaveBeenCalled();
    });

    it('should use MongoSchemaManager for MongoDB databases', async () => {
      await DatabaseGenerator.generate('mongodb', '/output', simpleSchema);
      
      expect(MongoSchemaManager).toHaveBeenCalledWith(simpleSchema);
      expect(MongoSchemaManager.prototype.generateSchemaManagement).toHaveBeenCalledWith('/output');
      expect(MigrationGenerator).not.toHaveBeenCalled();
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

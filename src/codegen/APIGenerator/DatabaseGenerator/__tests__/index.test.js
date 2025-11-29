const index = require('../index');

describe('DatabaseGenerator index', () => {
  it('should export DatabaseGenerator', () => {
    expect(index.DatabaseGenerator).toBeDefined();
  });

  it('should export MongoDBGenerator', () => {
    expect(index.MongoDBGenerator).toBeDefined();
  });

  it('should export SQLiteGenerator', () => {
    expect(index.SQLiteGenerator).toBeDefined();
  });

  it('should export MigrationGenerator', () => {
    expect(index.MigrationGenerator).toBeDefined();
  });

  it('should export MongoSchemaManager', () => {
    expect(index.MongoSchemaManager).toBeDefined();
  });

  it('should export SeedGenerator', () => {
    expect(index.SeedGenerator).toBeDefined();
  });

  it('should export BaseGenerator', () => {
    expect(index.BaseGenerator).toBeDefined();
  });
});

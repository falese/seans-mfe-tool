const { SeedGenerator } = require('../generators/SeedGenerator');
const { 
  simpleSchema, 
  examplesSchema,
  multiSchemaSpec
} = require('./fixtures/openapi-schemas');
const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra
jest.mock('fs-extra');

describe('SeedGenerator', () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should store spec', () => {
      const spec = simpleSchema;
      const gen = new SeedGenerator(spec);
      
      expect(gen.spec).toBe(spec);
    });
  });

  describe('generateSeedData', () => {
    beforeEach(() => {
      generator = new SeedGenerator(multiSchemaSpec);
    });

    it('should create seeds directory', async () => {
      await generator.generateSeedData('/output', 'mongodb');
      
      expect(fs.ensureDir).toHaveBeenCalledWith(
        path.join('/output', 'src', 'database', 'seeds')
      );
    });

    it('should generate main seed file', async () => {
      await generator.generateSeedData('/output', 'mongodb');
      
      const indexCall = fs.writeFile.mock.calls.find(call => call[0].includes('index.js'));
      expect(indexCall).toBeDefined();
    });

    it('should generate seed files for all schemas', async () => {
      await generator.generateSeedData('/output', 'mongodb');
      
      expect(fs.writeFile.mock.calls.find(call => call[0].includes('Category.seed.js'))).toBeDefined();
      expect(fs.writeFile.mock.calls.find(call => call[0].includes('Product.seed.js'))).toBeDefined();
      expect(fs.writeFile.mock.calls.find(call => call[0].includes('Order.seed.js'))).toBeDefined();
    });

    it('should skip schemas without properties', async () => {
      const specWithEmpty = {
        components: {
          schemas: {
            Empty: {},
            Valid: { properties: { name: { type: 'string' } } }
          }
        }
      };
      const gen = new SeedGenerator(specWithEmpty);
      
      await gen.generateSeedData('/output', 'mongodb');
      
      const emptySeedCall = fs.writeFile.mock.calls.find(call => call[0].includes('Empty.seed.js'));
      expect(emptySeedCall).toBeUndefined();
    });

    it('should handle spec without schemas', async () => {
      const emptyGen = new SeedGenerator({ components: {} });
      
      await emptyGen.generateSeedData('/output', 'mongodb');
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('generateSeedDataForSchema', () => {
    beforeEach(() => {
      generator = new SeedGenerator(simpleSchema);
    });

    it('should export seed data array', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateSeedDataForSchema(schema);
      
      expect(result).toContain('Seed = [');
      expect(result).toContain('module.exports =');
    });

    it('should include model name in variable', () => {
      const schema = { ...simpleSchema.components.schemas.User, title: 'User' };
      const result = generator.generateSeedDataForSchema(schema);
      
      expect(result).toContain('UserSeed');
    });

    it('should generate valid JavaScript', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateSeedDataForSchema(schema);
      
      expect(() => new Function(result)).not.toThrow();
    });
  });

  describe('extractExamples', () => {
    beforeEach(() => {
      generator = new SeedGenerator(examplesSchema);
    });

    it('should generate 5 examples by default', () => {
      const schema = examplesSchema.components.schemas.SampleModel;
      const result = generator.extractExamples(schema);
      
      expect(result).toHaveLength(5);
    });

    it('should use example property if available', () => {
      const schema = {
        properties: {
          name: { type: 'string', example: 'John Doe' }
        }
      };
      const result = generator.extractExamples(schema);
      
      expect(result[0].name).toContain('John Doe');
    });

    it('should use examples array if available', () => {
      const schema = {
        properties: {
          status: { type: 'string', examples: ['active', 'inactive'] }
        }
      };
      const result = generator.extractExamples(schema);
      
      expect(['active', 'inactive']).toContain(result[0].status);
    });

    it('should generate default values if no examples', () => {
      const schema = {
        properties: {
          name: { type: 'string' }
        }
      };
      const result = generator.extractExamples(schema);
      
      expect(result[0].name).toBeDefined();
    });

    it('should return empty array for schema without properties', () => {
      const schema = {};
      const result = generator.extractExamples(schema);
      
      expect(result).toEqual([]);
    });

    it('should handle null properties', () => {
      const schema = { properties: null };
      const result = generator.extractExamples(schema);
      
      expect(result).toEqual([]);
    });
  });

  describe('generateVariation', () => {
    beforeEach(() => {
      generator = new SeedGenerator(simpleSchema);
    });

    it('should vary numbers by index', () => {
      const result0 = generator.generateVariation(100, 0);
      const result1 = generator.generateVariation(100, 1);
      
      expect(result0).not.toBe(result1);
      expect(typeof result0).toBe('number');
    });

    it('should append index to strings', () => {
      const result = generator.generateVariation('Test', 2);
      
      expect(result).toBe('Test 3');
    });

    it('should return unchanged for other types', () => {
      const result = generator.generateVariation(true, 1);
      
      expect(result).toBe(true);
    });
  });

  describe('generateDefaultValue', () => {
    beforeEach(() => {
      generator = new SeedGenerator(simpleSchema);
    });

    it('should generate string default', () => {
      const result = generator.generateDefaultValue({ type: 'string' }, 0);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('Sample');
    });

    it('should use enum value for string with enum', () => {
      const result = generator.generateDefaultValue({ 
        type: 'string', 
        enum: ['active', 'inactive'] 
      }, 0);
      
      expect(['active', 'inactive']).toContain(result);
    });

    it('should generate number default', () => {
      const result = generator.generateDefaultValue({ type: 'number' }, 2);
      
      expect(result).toBe(30);
    });

    it('should generate integer default', () => {
      const result = generator.generateDefaultValue({ type: 'integer' }, 1);
      
      expect(result).toBe(20);
    });

    it('should generate boolean default', () => {
      const result = generator.generateDefaultValue({ type: 'boolean' }, 0);
      
      expect(result).toBe(true);
    });

    it('should alternate boolean values', () => {
      const result0 = generator.generateDefaultValue({ type: 'boolean' }, 0);
      const result1 = generator.generateDefaultValue({ type: 'boolean' }, 1);
      
      expect(result0).toBe(true);
      expect(result1).toBe(false);
    });

    it('should generate array default', () => {
      const result = generator.generateDefaultValue({ 
        type: 'array',
        items: { type: 'string' }
      }, 2);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should return null for unknown type', () => {
      const result = generator.generateDefaultValue({ type: 'unknown' }, 0);
      
      expect(result).toBeNull();
    });
  });

  describe('generateMainSeedFile', () => {
    beforeEach(() => {
      generator = new SeedGenerator(multiSchemaSpec);
    });

    it('should write to seeds directory', async () => {
      await generator.generateMainSeedFile('/seeds', 'mongodb');
      
      const [[filePath]] = fs.writeFile.mock.calls;
      expect(filePath).toBe(path.join('/seeds', 'index.js'));
    });

    it('should generate content', async () => {
      await generator.generateMainSeedFile('/seeds', 'mongodb');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('generateMainSeedContent', () => {
    beforeEach(() => {
      generator = new SeedGenerator(multiSchemaSpec);
    });

    it('should include require statements for MongoDB', () => {
      const result = generator.generateMainSeedContent('mongodb');
      
      expect(result).toContain("const mongoose = require('mongoose')");
      expect(result).toContain("const Models = require('../../models')");
    });

    it('should include require statements for SQLite', () => {
      const result = generator.generateMainSeedContent('sqlite');
      
      expect(result).toContain("const db = require('../../models')");
    });

    it('should import all seed files', () => {
      const result = generator.generateMainSeedContent('mongodb');
      
      expect(result).toContain('CategorySeed');
      expect(result).toContain('ProductSeed');
      expect(result).toContain('OrderSeed');
    });

    it('should define seedDatabase function', () => {
      const result = generator.generateMainSeedContent('mongodb');
      
      expect(result).toContain('async function seedDatabase()');
    });

    it('should clear existing data for MongoDB', () => {
      const result = generator.generateMainSeedContent('mongodb');
      
      expect(result).toContain('mongoose.connection.collections');
      expect(result).toContain('collection.deleteMany()');
    });

    it('should use sync force for SQLite', () => {
      const result = generator.generateMainSeedContent('sqlite');
      
      expect(result).toContain('db.sequelize.sync({ force: true })');
    });

    it('should insert data for MongoDB', () => {
      const result = generator.generateMainSeedContent('mongodb');
      
      expect(result).toContain('insertMany');
    });

    it('should bulk create for SQLite', () => {
      const result = generator.generateMainSeedContent('sqlite');
      
      expect(result).toContain('bulkCreate');
    });

    it('should include error handling', () => {
      const result = generator.generateMainSeedContent('mongodb');
      
      expect(result).toContain('try {');
      expect(result).toContain('} catch (error) {');
      expect(result).toContain('throw error');
    });

    it('should export seedDatabase', () => {
      const result = generator.generateMainSeedContent('mongodb');
      
      expect(result).toContain('module.exports = seedDatabase');
    });

    it('should filter out schemas without properties', () => {
      const specWithEmpty = {
        components: {
          schemas: {
            Empty: {},
            Valid: { properties: { name: { type: 'string' } } }
          }
        }
      };
      const gen = new SeedGenerator(specWithEmpty);
      const result = gen.generateMainSeedContent('mongodb');
      
      expect(result).toContain('ValidSeed');
      expect(result).not.toContain('EmptySeed');
    });
  });
});

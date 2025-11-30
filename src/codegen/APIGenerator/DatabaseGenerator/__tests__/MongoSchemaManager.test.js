const { MongoSchemaManager } = require('../generators/MongoSchemaManager');
const { 
  simpleSchema, 
  multiSchemaSpec
} = require('./fixtures/openapi-schemas');
const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra
jest.mock('fs-extra');

describe('MongoSchemaManager', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should store spec', () => {
      const spec = simpleSchema;
      const mgr = new MongoSchemaManager(spec);
      
      expect(mgr.spec).toBe(spec);
    });
  });

  describe('generateSchemaManagement', () => {
    beforeEach(() => {
      manager = new MongoSchemaManager(multiSchemaSpec);
    });

    it('should create migrations directory', async () => {
      await manager.generateSchemaManagement('/output');
      
      expect(fs.ensureDir).toHaveBeenCalledWith(
        path.join('/output', 'src', 'database', 'migrations')
      );
    });

    it('should write version model file', async () => {
      await manager.generateSchemaManagement('/output');
      
      const versionModelCall = fs.writeFile.mock.calls.find(
        call => call[0].includes('schemaVersion.model.js')
      );
      expect(versionModelCall).toBeDefined();
    });

    it('should write initial version migration', async () => {
      await manager.generateSchemaManagement('/output');
      
      const migrationCall = fs.writeFile.mock.calls.find(
        call => call[0].includes('-initial-schema.js')
      );
      expect(migrationCall).toBeDefined();
    });

    it('should write schema utils', async () => {
      await manager.generateSchemaManagement('/output');
      
      const utilsCall = fs.writeFile.mock.calls.find(
        call => call[0].includes('schemaManager.js')
      );
      expect(utilsCall).toBeDefined();
    });

    it('should handle spec without schemas', async () => {
      const emptyManager = new MongoSchemaManager({ components: {} });
      
      await emptyManager.generateSchemaManagement('/output');
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle spec without components', async () => {
      const emptyManager = new MongoSchemaManager({});
      
      await emptyManager.generateSchemaManagement('/output');
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('generateVersionModel', () => {
    beforeEach(() => {
      manager = new MongoSchemaManager(simpleSchema);
    });

    it('should write to correct path', async () => {
      await manager.generateVersionModel('/output');
      
      const [[filePath]] = fs.writeFile.mock.calls;
      expect(filePath).toBe(path.join('/output', 'src', 'models', 'schemaVersion.model.js'));
    });

    it('should include mongoose require', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const mongoose = require('mongoose')");
      expect(content).toContain('const { Schema } = mongoose');
    });

    it('should define schema with version field', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('version: {');
      expect(content).toContain('type: Number');
      expect(content).toContain('required: true');
    });

    it('should define schema with appliedAt field', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('appliedAt: {');
      expect(content).toContain('type: Date');
      expect(content).toContain('default: Date.now');
    });

    it('should define schema with description field', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('description: {');
      expect(content).toContain('type: String');
    });

    it('should define schema with models array', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('models: [{');
      expect(content).toContain('name: String');
      expect(content).toContain('version: Number');
    });

    it('should set collection name', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("collection: 'schema_versions'");
    });

    it('should enable timestamps', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('timestamps: true');
    });

    it('should include getCurrentVersion static method', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('schemaVersionSchema.statics.getCurrentVersion = async function()');
      expect(content).toContain('this.findOne().sort({ version: -1 })');
      expect(content).toContain('return latest ? latest.version : 0');
    });

    it('should include recordVersion static method', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('schemaVersionSchema.statics.recordVersion = async function(version, description, models)');
      expect(content).toContain('return this.create({');
    });

    it('should create SchemaVersion model', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const SchemaVersion = mongoose.model('SchemaVersion', schemaVersionSchema)");
    });

    it('should export SchemaVersion', async () => {
      await manager.generateVersionModel('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('module.exports = SchemaVersion');
    });
  });

  describe('generateInitialVersion', () => {
    beforeEach(() => {
      manager = new MongoSchemaManager(multiSchemaSpec);
    });

    it('should write to migrations directory', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[filePath]] = fs.writeFile.mock.calls;
      expect(filePath).toMatch(/\/migrations\/\d{14}-initial-schema\.js$/);
    });

    it('should include mongoose require', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const mongoose = require('mongoose')");
    });

    it('should require Models', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const Models = require('../../models')");
    });

    it('should require SchemaVersion', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const SchemaVersion = require('../../models/schemaVersion.model')");
    });

    it('should define initialSchemas', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const initialSchemas =');
    });

    it('should include up function', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('async function up()');
      expect(content).toContain('await SchemaVersion.recordVersion(1');
    });

    it('should include down function', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('async function down()');
      expect(content).toContain('await mongoose.connection.collection(collection).drop()');
    });

    it('should export version', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('module.exports = {');
      expect(content).toContain('version: 1');
    });

    it('should export description', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("description: 'Initial schema creation'");
    });

    it('should export up and down', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('up,');
      expect(content).toContain('down');
    });

    it('should include schema information', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('Category');
      expect(content).toContain('Product');
      expect(content).toContain('Order');
    });

    it('should delete version record in down', async () => {
      await manager.generateInitialVersion('/migrations');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('await SchemaVersion.deleteOne({ version: 1 })');
    });
  });

  describe('generateSchemaUtils', () => {
    beforeEach(() => {
      manager = new MongoSchemaManager(simpleSchema);
    });

    it('should write to utils directory', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[filePath]] = fs.writeFile.mock.calls;
      expect(filePath).toBe(path.join('/output', 'src', 'utils', 'schemaManager.js'));
    });

    it('should require fs and path', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const fs = require('fs')");
      expect(content).toContain("const path = require('path')");
    });

    it('should require SchemaVersion', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const SchemaVersion = require('../models/schemaVersion.model')");
    });

    it('should define SchemaManager class', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('class SchemaManager {');
    });

    it('should include initialize method', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('static async initialize()');
      expect(content).toContain('await SchemaVersion.getCurrentVersion()');
    });

    it('should include getMigrationFiles method', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('static getMigrationFiles(migrationsDir)');
      expect(content).toContain("fs.readdirSync(migrationsDir)");
      expect(content).toContain(".filter(file => file.endsWith('.js'))");
    });

    it('should sort migrations by version', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('.sort((a, b) => a.migration.version - b.migration.version)');
    });

    it('should include applyPendingMigrations method', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('static async applyPendingMigrations(currentVersion, migrations)');
      expect(content).toContain('if (migration.version > currentVersion)');
    });

    it('should include rollback logic', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('await migration.down()');
      expect(content).toContain('Rolled back migration');
    });

    it('should include createMigration method', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('static async createMigration(description)');
      expect(content).toContain('const newVersion = currentVersion + 1');
    });

    it('should generate timestamped filename', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain("const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)");
    });

    it('should include migration template', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const template = ');
      expect(content).toContain('async function up()');
      expect(content).toContain('async function down()');
    });

    it('should export SchemaManager', async () => {
      await manager.generateSchemaUtils('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('module.exports = SchemaManager');
    });
  });

  describe('generateInitialSchemas', () => {
    beforeEach(() => {
      manager = new MongoSchemaManager(multiSchemaSpec);
    });

    it('should return object with all schemas', () => {
      const result = manager.generateInitialSchemas();
      
      expect(result).toHaveProperty('Category');
      expect(result).toHaveProperty('Product');
      expect(result).toHaveProperty('Order');
    });

    it('should include fields for each schema', () => {
      const result = manager.generateInitialSchemas();
      
      expect(result.Category).toHaveProperty('fields');
      expect(Array.isArray(result.Category.fields)).toBe(true);
    });

    it('should include version for each schema', () => {
      const result = manager.generateInitialSchemas();
      
      expect(result.Category).toHaveProperty('version', 1);
      expect(result.Product).toHaveProperty('version', 1);
    });

    it('should list property names as fields', () => {
      const result = manager.generateInitialSchemas();
      
      expect(result.Category.fields).toContain('name');
      expect(result.Category.fields).toContain('description');
    });

    it('should handle schema without properties', () => {
      const emptyManager = new MongoSchemaManager({
        components: {
          schemas: {
            Empty: {}
          }
        }
      });
      
      const result = emptyManager.generateInitialSchemas();
      
      expect(result.Empty.fields).toEqual([]);
    });

    it('should handle schema with null properties', () => {
      const nullManager = new MongoSchemaManager({
        components: {
          schemas: {
            Null: { properties: null }
          }
        }
      });
      
      const result = nullManager.generateInitialSchemas();
      
      expect(result.Null.fields).toEqual([]);
    });
  });
});

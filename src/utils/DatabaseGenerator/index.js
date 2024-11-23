const { DatabaseGenerator } = require('./DatabaseGenerator');
const { BaseGenerator } = require('./generators/BaseGenerator');
const { MongoDBGenerator } = require('./generators/MongoDBGenerator');
const { SQLiteGenerator } = require('./generators/SQLiteGenerator');
const { SeedGenerator } = require('./generators/SeedGenerator');
const { MigrationGenerator } = require('./generators/MigrationGenerator');

module.exports = {
  DatabaseGenerator,
  BaseGenerator,
  MongoDBGenerator,
  SQLiteGenerator,
  SeedGenerator,
  MigrationGenerator
};
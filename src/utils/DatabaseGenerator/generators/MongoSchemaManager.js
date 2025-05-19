class MongoSchemaManager {
  constructor(spec) {
    this.spec = spec;
  }

  async generateSchemaManagement(outputDir) {
    // Add null check for schemas here
    if (!this.spec.components?.schemas || Object.keys(this.spec.components.schemas).length === 0) {
      console.log(chalk.yellow('No schemas found to generate schema management - skipping'));
      return;
    }

    const migrationsDir = path.join(outputDir, 'src', 'database', 'migrations');
    await fs.ensureDir(migrationsDir);

    // Generate schema version tracking model
    await this.generateVersionModel(outputDir);

    // Generate initial schema version
    await this.generateInitialVersion(migrationsDir);

    // Generate schema management utilities
    await this.generateSchemaUtils(outputDir);

    console.log(chalk.green('✓ Generated MongoDB schema management files'));
  }

  // ... other methods ...

  generateInitialSchemas() {
    const schemas = {};
    
    // Make sure we have schemas before trying to iterate them
    if (!this.spec.components?.schemas) {
      return schemas;
    }
    
    for (const [schemaName, schema] of Object.entries(this.spec.components.schemas)) {
      // Make sure schema has properties before proceeding
      if (!schema || !schema.properties) {
        console.log(chalk.yellow(`Warning: Schema ${schemaName} has no properties, skipping`));
        continue;
      }
      
      const modelName = NameGenerator.toModelName(schemaName);
      schemas[modelName] = {
        fields: Object.keys(schema.properties),
        version: 1
      };
    }

    return schemas;
  }
}

module.exports = { MongoSchemaManager };
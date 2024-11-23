const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { NameGenerator } = require('../../generators/NameGenerator');

class SeedGenerator {
  constructor(spec) {
    this.spec = spec;
  }

  async generateSeedData(outputDir, dbType) {
    if (!this.spec.components?.schemas) {
      console.log(chalk.yellow('No schemas found to generate seed data'));
      return;
    }

    const seedDir = path.join(outputDir, 'src', 'database', 'seeds');
    await fs.ensureDir(seedDir);

    // Generate main seed file
    await this.generateMainSeedFile(seedDir, dbType);

    // Generate individual seed files for each model
    for (const [schemaName, schema] of Object.entries(this.spec.components.schemas)) {
      const modelName = NameGenerator.toModelName(schemaName);
      const seedPath = path.join(seedDir, `${modelName}.seed.js`);
      const seedData = this.generateSeedDataForSchema(schema);
      await fs.writeFile(seedPath, seedData);
      console.log(chalk.green(`✓ Generated seed data for: ${modelName}`));
    }
  }

  generateSeedDataForSchema(schema) {
    const examples = this.extractExamples(schema);
    const modelName = NameGenerator.toPascalCase(schema.title || 'Model');

    return `const ${modelName}Seed = ${JSON.stringify(examples, null, 2)};

module.exports = ${modelName}Seed;`;
  }

  extractExamples(schema) {
    const examples = [];
    const sampleSize = 5;

    for (let i = 0; i < sampleSize; i++) {
      const example = {};
      
      for (const [prop, config] of Object.entries(schema.properties)) {
        if (config.example !== undefined) {
          example[prop] = this.generateVariation(config.example, i);
        } else if (config.examples?.length > 0) {
          example[prop] = config.examples[i % config.examples.length];
        } else {
          example[prop] = this.generateDefaultValue(config, i);
        }
      }
      
      examples.push(example);
    }

    return examples;
  }

  generateVariation(baseValue, index) {
    if (typeof baseValue === 'number') {
      // Vary numbers by ±10%
      const variation = baseValue * 0.1;
      return baseValue + (variation * (index - 2));
    } else if (typeof baseValue === 'string') {
      // Append index to strings
      return `${baseValue} ${index + 1}`;
    }
    return baseValue;
  }

  generateDefaultValue(property, index) {
    switch (property.type) {
      case 'string':
        return property.enum ? 
          property.enum[index % property.enum.length] : 
          `Sample ${property.type} ${index + 1}`;
      case 'number':
      case 'integer':
        return (index + 1) * 10;
      case 'boolean':
        return index % 2 === 0;
      case 'array':
        return Array.from({ length: index + 1 }, (_, i) => 
          this.generateDefaultValue(property.items, i));
      default:
        return null;
    }
  }

  async generateMainSeedFile(seedDir, dbType) {
    const content = this.generateMainSeedContent(dbType);
    const mainSeedPath = path.join(seedDir, 'index.js');
    await fs.writeFile(mainSeedPath, content);
    console.log(chalk.green('✓ Generated main seed file'));
  }

  generateMainSeedContent(dbType) {
    const importStatements = Object.keys(this.spec.components.schemas)
      .map(schema => {
        const modelName = NameGenerator.toModelName(schema);
        return `const ${modelName}Seed = require('./${modelName}.seed');`;
      })
      .join('\n');

    if (dbType.toLowerCase().includes('mongo')) {
      return `const mongoose = require('mongoose');
const Models = require('../../models');
${importStatements}

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    const collections = Object.values(mongoose.connection.collections);
    for (const collection of collections) {
      await collection.deleteMany();
    }
    
    // Seed all models
    ${Object.keys(this.spec.components.schemas)
      .map(schema => {
        const modelName = NameGenerator.toPascalCase(schema);
        return `await Models.${modelName}.insertMany(${NameGenerator.toModelName(schema)}Seed);`
      })
      .join('\n    ')}
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;`;
    } else {
      return `const db = require('../../models');
${importStatements}

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Clear existing data
    await db.sequelize.sync({ force: true });
    
    // Seed all models
    ${Object.keys(this.spec.components.schemas)
      .map(schema => {
        const modelName = NameGenerator.toPascalCase(schema);
        return `await db.${modelName}.bulkCreate(${NameGenerator.toModelName(schema)}Seed);`
      })
      .join('\n    ')}
    
    console.log('✓ Database seeded successfully');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}

module.exports = seedDatabase;`;
    }
  }
}

module.exports = { SeedGenerator };
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { NameGenerator } = require('../../generators/NameGenerator');

class BaseGenerator {
  async generateModels(outputDir, spec) {
    if (!spec.components?.schemas) {
      console.log(chalk.yellow('No schemas found in OpenAPI spec'));
      return;
    }

    const modelsDir = path.join(outputDir, 'src', 'models');
    await fs.ensureDir(modelsDir);

    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      const modelName = NameGenerator.toModelName(schemaName);
      const modelPath = path.join(modelsDir, `${modelName}.model.js`);
      const modelContent = this.generateModelFile(schemaName, schema);
      await fs.writeFile(modelPath, modelContent);
      console.log(chalk.green(`✓ Generated model: ${modelName}`));
    }

    await this.generateModelIndex(modelsDir, spec.components.schemas);
  }

  generateModelFile(schemaName, schema) {
    throw new Error('generateModelFile must be implemented by subclass');
  }

  async generateModelIndex(modelsDir, schemas) {
    throw new Error('generateModelIndex must be implemented by subclass');
  }

  validateSchema(schema) {
    if (!schema.properties) {
      throw new Error('Schema must have properties defined');
    }
  }

  getPropertyType(property) {
    if (!property.type) {
      throw new Error('Property must have a type defined');
    }
    return property.type;
  }
}

module.exports = { BaseGenerator };
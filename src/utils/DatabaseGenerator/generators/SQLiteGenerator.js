const { BaseGenerator } = require('./BaseGenerator');
const { NameGenerator } = require('../../generators/NameGenerator');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

class SQLiteGenerator extends BaseGenerator {
  generateModelFile(schemaName, schema) {
    this.validateSchema(schema);
    const modelName = NameGenerator.toModelName(schemaName);
    const pascalModelName = NameGenerator.toPascalCase(schemaName);
    
    return `const { DataTypes, Model } = require('sequelize');

class ${pascalModelName} extends Model {
  static init(sequelize) {
    return super.init(
      ${this.generateSchemaObject(schema)},
      {
        sequelize,
        modelName: '${modelName}',
        tableName: '${modelName}s',
        timestamps: true,
        underscored: true,
        
        // Add hooks
        hooks: {
          beforeValidate: (instance) => {
            // Add any pre-validation logic
          },
          beforeCreate: (instance) => {
            // Add any pre-create logic
          }
        },
        
        // Add instance methods
        instanceMethods: {
          toDTO() {
            const values = this.get();
            return {
              ...values,
              createdAt: this.createdAt,
              updatedAt: this.updatedAt
            };
          }
        }
      }
    );
  }

  // Define associations
  static associate(models) {
    ${this.generateAssociations(schema)}
  }
}

module.exports = ${pascalModelName};`;
  }

  generateSchemaObject(schema) {
    if (!schema.properties) return '{}';
    
    const schemaObj = {};
    for (const [prop, config] of Object.entries(schema.properties)) {
      if (prop !== 'id') {
        schemaObj[prop] = this.convertToSequelizeType(prop, config, schema.required?.includes(prop));
      }
    }
    
    return JSON.stringify(schemaObj, null, 2)
      .replace(/"DataTypes\.([^"]+)"/g, 'DataTypes.$1');
  }

  convertToSequelizeType(propName, property, required = false) {
    const schemaType = {
      type: this.getSequelizeType(property)
    };

    // Handle required fields
    if (required) {
      schemaType.allowNull = false;
    }
    
    // Handle enums
    if (property.enum) {
      schemaType.type = 'DataTypes.ENUM';
      schemaType.values = property.enum;
    }
    
    // Handle defaults
    if (property.default !== undefined) {
      schemaType.defaultValue = property.default;
    }

    // Handle descriptions
    if (property.description) {
      schemaType.comment = property.description;
    }

    // Add validations
    const validate = {};
    
    if (property.type === 'string') {
      if (property.minLength) validate.len = [property.minLength, property.maxLength || 255];
      if (property.pattern) validate.is = new RegExp(property.pattern);
      if (property.format === 'email') validate.isEmail = true;
      if (property.format === 'uri') validate.isUrl = true;
    }

    if (property.type === 'number' || property.type === 'integer') {
      if (property.minimum !== undefined) validate.min = property.minimum;
      if (property.maximum !== undefined) validate.max = property.maximum;
    }

    if (Object.keys(validate).length > 0) {
      schemaType.validate = validate;
    }

    return schemaType;
  }

  getSequelizeType(property) {
    switch (property.type?.toLowerCase()) {
      case 'string':
        if (property.format === 'date' || property.format === 'date-time') {
          return 'DataTypes.DATE';
        }
        if (property.maxLength) {
          return `DataTypes.STRING(${property.maxLength})`;
        }
        return 'DataTypes.TEXT';
      case 'number':
        return property.format === 'float' ? 'DataTypes.FLOAT' : 'DataTypes.DECIMAL(10, 2)';
      case 'integer':
        return 'DataTypes.INTEGER';
      case 'boolean':
        return 'DataTypes.BOOLEAN';
      case 'array':
      case 'object':
        return 'DataTypes.JSON';
      default:
        return 'DataTypes.STRING';
    }
  }

  generateAssociations(schema) {
    const associations = [];
    
    // Look for relationship fields in the schema
    for (const [prop, config] of Object.entries(schema.properties)) {
      if (config['x-ref']) {
        const refModel = config['x-ref'];
        if (config.type === 'array') {
          associations.push(`this.hasMany(models.${refModel}, { as: '${prop}' });`);
        } else {
          associations.push(`this.belongsTo(models.${refModel}, { as: '${prop}' });`);
        }
      }
    }

    return associations.length ? associations.join('\n    ') : '// No associations defined';
  }

  async generateModelIndex(modelsDir, schemas) {
    const indexPath = path.join(modelsDir, 'index.js');
    const content = `const { Sequelize } = require('sequelize');
const config = require('../config/database');

${Object.keys(schemas)
  .map(schemaName => {
    const pascalName = NameGenerator.toPascalCase(schemaName);
    return `const ${pascalName} = require('./${NameGenerator.toModelName(schemaName)}.model');`;
  })
  .join('\n')}

const env = process.env.NODE_ENV || 'development';
const sequelize = new Sequelize(config[env]);

// Initialize models
${Object.keys(schemas)
  .map(schemaName => `${NameGenerator.toPascalCase(schemaName)}.init(sequelize);`)
  .join('\n')}

// Setup associations
${Object.keys(schemas)
  .map(schemaName => `${NameGenerator.toPascalCase(schemaName)}.associate(sequelize.models);`)
  .join('\n')}

module.exports = {
  sequelize,
  Sequelize,
  ${Object.keys(schemas)
    .map(schemaName => NameGenerator.toPascalCase(schemaName))
    .join(',\n  ')}
};`;

    await fs.writeFile(indexPath, content);
    console.log(chalk.green('✓ Generated SQLite models index file'));
  }
}

module.exports = { SQLiteGenerator };
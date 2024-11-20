const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class DatabaseGenerator {
  static async generate(dbType, outputDir, spec) {
    if (!dbType) {
      throw new Error('Database type is required');
    }

    console.log(chalk.blue('\nGenerating database models...'));
    
    // Get the appropriate generator
    const generator = this.getGenerator(dbType);
    
    // Generate models
    await generator.generateModels(outputDir, spec);
  }

  static getGenerator(dbType) {
    switch (dbType.toLowerCase()) {
      case 'mongodb':
      case 'mongo':
        return new MongoDBGenerator();
      case 'sqlite':
      case 'sql':
        return new SQLiteGenerator();
      default:
        throw new Error(`Unsupported database type: ${dbType}. Supported types are: mongodb, sqlite`);
    }
  }
}

class BaseGenerator {
  async generateModels(outputDir, spec) {
    if (!spec.components?.schemas) {
      console.log(chalk.yellow('No schemas found in OpenAPI spec'));
      return;
    }

    const modelsDir = path.join(outputDir, 'src', 'models');
    await fs.ensureDir(modelsDir);

    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      const modelName = this.formatModelName(schemaName);
      const modelPath = path.join(modelsDir, `${modelName}.model.js`);
      const modelContent = this.generateModelFile(schemaName, schema);
      await fs.writeFile(modelPath, modelContent);
      console.log(chalk.green(`✓ Generated model: ${modelName}`));
    }

    await this.generateModelIndex(modelsDir, spec.components.schemas);
  }

  formatModelName(name) {
    return name.charAt(0).toLowerCase() + name.slice(1)
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  getPascalName(name) {
    const modelName = this.formatModelName(name);
    return modelName.charAt(0).toUpperCase() + modelName.slice(1);
  }

  generateModelFile(schemaName, schema) {
    throw new Error('generateModelFile must be implemented by subclass');
  }

  async generateModelIndex(modelsDir, schemas) {
    throw new Error('generateModelIndex must be implemented by subclass');
  }
}

class MongoDBGenerator extends BaseGenerator {
  generateModelFile(schemaName, schema) {
    const modelName = this.formatModelName(schemaName);
    const pascalModelName = this.getPascalName(schemaName);
    
    return `const mongoose = require('mongoose');
const { Schema } = mongoose;

const ${modelName}Schema = new Schema(
  ${this.generateSchemaObject(schema)},
  { 
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Add schema validations
${this.generateSchemaValidation(schema, modelName)}

const ${pascalModelName} = mongoose.model('${pascalModelName}', ${modelName}Schema);

module.exports = ${pascalModelName};`;
  }

  generateSchemaValidation(schema, modelName) {
    if (!schema.properties) return '';

    const validations = [];
    for (const [prop, config] of Object.entries(schema.properties)) {
      if (prop !== 'id' && prop !== '_id') {
        if (config.minLength) {
          validations.push(`
${modelName}Schema.path('${prop}').validate(function(value) {
  return !value || value.length >= ${config.minLength};
}, '${prop} must be at least ${config.minLength} characters');`);
        }
        if (config.maxLength) {
          validations.push(`
${modelName}Schema.path('${prop}').validate(function(value) {
  return !value || value.length <= ${config.maxLength};
}, '${prop} must be no more than ${config.maxLength} characters');`);
        }
        if (config.pattern) {
          validations.push(`
${modelName}Schema.path('${prop}').validate(function(value) {
  return !value || ${config.pattern}.test(value);
}, '${prop} must match pattern ${config.pattern}');`);
        }
      }
    }
    return validations.join('\n');
  }

  generateSchemaObject(schema) {
    if (!schema.properties) return '{}';
    
    const schemaObj = {};
    for (const [prop, config] of Object.entries(schema.properties)) {
      if (prop !== 'id' && prop !== '_id') {
        schemaObj[prop] = this.convertToMongooseType(prop, config, schema.required?.includes(prop));
      }
    }
    
    return JSON.stringify(schemaObj, null, 2)
      .replace(/"String"/g, 'String')
      .replace(/"Number"/g, 'Number')
      .replace(/"Boolean"/g, 'Boolean')
      .replace(/"Date"/g, 'Date')
      .replace(/"ObjectId"/g, 'Schema.Types.ObjectId')
      .replace(/"Mixed"/g, 'Schema.Types.Mixed')
      .replace(/"Array"/g, 'Array');
  }

  convertToMongooseType(propName, property, required = false) {
    const schemaType = {
      type: this.getMongooseType(property)
    };

    if (required) {
      schemaType.required = [true, `${propName} is required`];
    }
    
    if (property.enum) {
      schemaType.enum = property.enum;
    }
    
    if (property.default !== undefined) {
      schemaType.default = property.default;
    }
    
    if (property.description) {
      schemaType.description = property.description;
    }

    // Add min/max validation for numbers
    if (property.type === 'number' || property.type === 'integer') {
      if (property.minimum !== undefined) schemaType.min = property.minimum;
      if (property.maximum !== undefined) schemaType.max = property.maximum;
    }

    return schemaType;
  }

  getMongooseType(property) {
    switch (property.type?.toLowerCase()) {
      case 'string': return 'String';
      case 'number':
      case 'integer': return 'Number';
      case 'boolean': return 'Boolean';
      case 'array': return property.items ? 
        `[${this.getMongooseType(property.items)}]` : 
        '[Schema.Types.Mixed]';
      case 'object':
        if (property['x-ref']) return 'Schema.Types.ObjectId';
        return 'Schema.Types.Mixed';
      default: return 'String';
    }
  }

  async generateModelIndex(modelsDir, schemas) {
    const indexPath = path.join(modelsDir, 'index.js');
    const content = `const mongoose = require('mongoose');

// Import all models
${Object.keys(schemas)
  .map(schemaName => {
    const modelName = this.formatModelName(schemaName);
    const pascalName = this.getPascalName(schemaName);
    return `const ${pascalName} = require('./${modelName}.model');`;
  })
  .join('\n')}

module.exports = {
  ${Object.keys(schemas)
    .map(schemaName => this.getPascalName(schemaName))
    .join(',\n  ')}
};`;

    await fs.writeFile(indexPath, content);
    console.log(chalk.green('✓ Generated models index file'));
  }
}

class SQLiteGenerator extends BaseGenerator {
  generateModelFile(schemaName, schema) {
    const modelName = this.formatModelName(schemaName);
    const pascalModelName = this.getPascalName(schemaName);
    
    return `const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ${pascalModelName} = sequelize.define('${modelName}',
    ${this.generateSchemaObject(schema)},
    {
      timestamps: true,
      underscored: true,
      tableName: '${modelName}s'
    }
  );

  return ${pascalModelName};
};`;
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

    if (required) {
      schemaType.allowNull = false;
    }
    
    if (property.enum) {
      schemaType.type = 'DataTypes.ENUM';
      schemaType.values = property.enum;
    }
    
    if (property.default !== undefined) {
      schemaType.defaultValue = property.default;
    }

    if (property.description) {
      schemaType.comment = property.description;
    }

    // Add validations
    const validate = {};
    if (property.minLength) validate.len = [property.minLength, property.maxLength || Number.MAX_SAFE_INTEGER];
    if (property.pattern) validate.is = new RegExp(property.pattern);
    if (Object.keys(validate).length > 0) schemaType.validate = validate;

    return schemaType;
  }

  getSequelizeType(property) {
    switch (property.type?.toLowerCase()) {
      case 'string': 
        if (property.maxLength) {
          return `DataTypes.STRING(${property.maxLength})`;
        }
        return 'DataTypes.TEXT';
      case 'number': return 'DataTypes.FLOAT';
      case 'integer': return 'DataTypes.INTEGER';
      case 'boolean': return 'DataTypes.BOOLEAN';
      case 'array':
      case 'object': return 'DataTypes.JSON';
      default: return 'DataTypes.STRING';
    }
  }

  async generateModelIndex(modelsDir, schemas) {
    const indexPath = path.join(modelsDir, 'index.js');
    const content = `const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/database');

const db = {};
const env = process.env.NODE_ENV || 'development';
const sequelize = new Sequelize(config[env]);

fs.readdirSync(__dirname)
  .filter(file => 
    file.indexOf('.') !== 0 && 
    file !== path.basename(__filename) && 
    file.slice(-9) === '.model.js'
  )
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;`;

    await fs.writeFile(indexPath, content);
    console.log(chalk.green('✓ Generated models index file'));
  }
}

module.exports = { DatabaseGenerator };
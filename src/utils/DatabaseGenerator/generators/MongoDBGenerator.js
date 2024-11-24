const { BaseGenerator } = require('./BaseGenerator');
const { NameGenerator } = require('../../generators/NameGenerator');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

class MongoDBGenerator extends BaseGenerator {
  generateModelFile(schemaName, schema) {
    this.validateSchema(schema);
    const modelName = NameGenerator.toModelName(schemaName); // e.g., PhaseMetric
    const modelNamePlural = `${modelName}s`; // e.g., PhaseMetrics
    
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
${this.generateSchemaValidations(schema, modelName)}

// Add schema methods
${modelName}Schema.methods = {
  async toDTO() {
    return {
      id: this._id,
      ...this.toObject(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
};

// Add schema statics
${modelName}Schema.statics = {
  async findByIdOrThrow(id) {
    const doc = await this.findById(id);
    if (!doc) throw new Error('Document not found');
    return doc;
  },
  
  async findOneOrThrow(conditions) {
    const doc = await this.findOne(conditions);
    if (!doc) throw new Error('Document not found');
    return doc;
  }
};

const ${modelName} = mongoose.model('${modelNamePlural}', ${modelName}Schema);

// Export both singular and plural forms for compatibility
module.exports = ${modelName};
module.exports.${modelNamePlural} = ${modelName};
module.exports.${modelName} = ${modelName};`;
  }

  validateSchema(schema) {
    if (!schema || !schema.properties) {
      throw new Error('Invalid schema: schema must have properties defined');
    }
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
      .replace(/"Array"/g, 'Array')
      .replace(/"Map"/g, 'Map');
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

    // Add string validations
    if (property.type === 'string') {
      if (property.minLength) schemaType.minlength = property.minLength;
      if (property.maxLength) schemaType.maxlength = property.maxLength;
      if (property.pattern) schemaType.match = new RegExp(property.pattern);
    }

    return schemaType;
  }

  generateSchemaValidations(schema, modelName) {
    if (!schema.properties) return '';

    const validations = [];
    for (const [prop, config] of Object.entries(schema.properties)) {
      if (prop !== 'id' && prop !== '_id') {
        // Add custom validations based on OpenAPI spec
        if (config.format === 'email') {
          validations.push(`
${modelName}Schema.path('${prop}').validate(function(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}, '${prop} must be a valid email address');`);
        }

        if (config.format === 'uri') {
          validations.push(`
${modelName}Schema.path('${prop}').validate(function(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, '${prop} must be a valid URL');`);
        }

        // Add custom validation for relationships
        if (config['x-ref']) {
          validations.push(`
${modelName}Schema.path('${prop}').validate(async function(value) {
  if (!value) return true;
  const ${config['x-ref']} = mongoose.model('${config['x-ref']}');
  const doc = await ${config['x-ref']}.findById(value);
  return !!doc;
}, '${config['x-ref']} not found');`);
        }
      }
    }
    return validations.join('\n');
  }

  getMongooseType(property) {
    switch (property.type?.toLowerCase()) {
      case 'string': 
        return 'String';
      case 'number':
      case 'integer': 
        return 'Number';
      case 'boolean': 
        return 'Boolean';
      case 'array': 
        if (property.items) {
          if (property.items['x-ref']) {
            return '[Schema.Types.ObjectId]';
          }
          return `[${this.getMongooseType(property.items)}]`;
        }
        return '[Schema.Types.Mixed]';
      case 'object':
        if (property['x-ref']) {
          return 'Schema.Types.ObjectId';
        }
        if (property.properties) {
          const nestedSchema = {};
          for (const [key, value] of Object.entries(property.properties)) {
            nestedSchema[key] = this.getMongooseType(value);
          }
          return nestedSchema;
        }
        if (property.additionalProperties) {
          return 'Map';
        }
        return 'Schema.Types.Mixed';
      default: 
        return 'String';
    }
  }

  async generateModelIndex(modelsDir, schemas) {
    const indexPath = path.join(modelsDir, 'index.js');
    const content = `const mongoose = require('mongoose');

// Import all models
${Object.keys(schemas)
  .map(schemaName => {
    const modelName = NameGenerator.toModelName(schemaName);
    return `const ${modelName} = require('./${modelName}.model');`;
  })
  .join('\n')}

// Export both singular and plural forms for each model
module.exports = {
  ${Object.keys(schemas)
    .map(schemaName => {
      const modelName = NameGenerator.toModelName(schemaName);
      const modelNamePlural = `${modelName}s`;
      return `${modelName},\n  ${modelNamePlural}: ${modelName}`;
    })
    .join(',\n  ')}
};`;

    await fs.writeFile(indexPath, content);
    console.log(chalk.green('✓ Generated models index file'));
  }
}

module.exports = { MongoDBGenerator };
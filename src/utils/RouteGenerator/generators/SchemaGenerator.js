class SchemaGenerator {
  static generateValidationSchema(operation, components) {
    const schemas = {
      body: this.generateRequestBodySchema(operation),
      params: this.generateParametersSchema(operation),
      query: this.generateQuerySchema(operation)
    };

    // Only generate schemas where we have validation needed
    const validationSchemas = Object.entries(schemas)
      .filter(([_, schema]) => schema !== null)
      .map(([type, schema]) => this.generateSchemaDefinition(operation, type, schema));

    return validationSchemas.join('\n\n');
  }

  static generateRequestBodySchema(operation) {
    if (!operation.requestBody?.content?.['application/json']?.schema) {
      return null;
    }

    return this.transformSchema(operation.requestBody.content['application/json'].schema);
  }

  static generateParametersSchema(operation) {
    const pathParams = (operation.parameters || [])
      .filter(param => param.in === 'path');

    if (pathParams.length === 0) {
      return null;
    }

    const properties = {};
    const required = [];

    pathParams.forEach(param => {
      properties[param.name] = this.transformSchema(param.schema);
      if (param.required) {
        required.push(param.name);
      }
    });

    return {
      type: 'object',
      properties,
      required
    };
  }

  static generateQuerySchema(operation) {
    const queryParams = (operation.parameters || [])
      .filter(param => param.in === 'query');

    if (queryParams.length === 0) {
      return null;
    }

    const properties = {};
    const required = [];

    queryParams.forEach(param => {
      properties[param.name] = this.transformSchema(param.schema);
      if (param.required) {
        required.push(param.name);
      }
    });

    return {
      type: 'object',
      properties,
      required
    };
  }

  static transformSchema(schema) {
    if (!schema) return null;

    // Handle references
    if (schema.$ref) {
      // For now, we'll just use a basic object validation
      // In a real implementation, you'd resolve the reference
      return 'Joi.object()';
    }

    switch (schema.type) {
      case 'string':
        let validator = 'Joi.string()';
        if (schema.enum) {
          validator += `.valid(${schema.enum.map(e => `'${e}'`).join(', ')})`;
        }
        if (schema.format === 'date-time') {
          validator += '.isoDate()';
        }
        if (schema.minLength) {
          validator += `.min(${schema.minLength})`;
        }
        if (schema.maxLength) {
          validator += `.max(${schema.maxLength})`;
        }
        if (schema.pattern) {
          validator += `.pattern(/${schema.pattern}/)`;
        }
        return validator;

      case 'number':
      case 'integer':
        let numValidator = schema.type === 'integer' ? 'Joi.number().integer()' : 'Joi.number()';
        if (schema.minimum !== undefined) {
          numValidator += `.min(${schema.minimum})`;
        }
        if (schema.maximum !== undefined) {
          numValidator += `.max(${schema.maximum})`;
        }
        return numValidator;

      case 'boolean':
        return 'Joi.boolean()';

      case 'array':
        let arrayValidator = 'Joi.array()';
        if (schema.items) {
          arrayValidator += `.items(${this.transformSchema(schema.items)})`;
        }
        if (schema.minItems) {
          arrayValidator += `.min(${schema.minItems})`;
        }
        if (schema.maxItems) {
          arrayValidator += `.max(${schema.maxItems})`;
        }
        return arrayValidator;

      case 'object':
        let objectValidator = 'Joi.object()';
        if (schema.properties) {
          const props = {};
          Object.entries(schema.properties).forEach(([key, value]) => {
            props[key] = this.transformSchema(value);
          });
          objectValidator = `Joi.object(${JSON.stringify(props)
            .replace(/"Joi\.(.*?)"/g, 'Joi.$1')
            .replace(/\\/g, '')})`;
        }
        return objectValidator;

      default:
        return 'Joi.any()';
    }
  }

  static generateSchemaDefinition(operation, type, schema) {
    const schemaName = this.getSchemaName(operation, type);
    return `const ${schemaName} = ${this.transformSchema(schema)};`;
  }

  static getSchemaName(operation, type) {
    const baseName = operation.operationId || operation.summary?.replace(/\s+/g, '') || 'unknown';
    return `${baseName}${type.charAt(0).toUpperCase() + type.slice(1)}Schema`;
  }
}

module.exports = { SchemaGenerator };
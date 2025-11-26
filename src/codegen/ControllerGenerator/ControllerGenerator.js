const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { MethodGenerator } = require('./generators/MethodGenerator');
const { ValidationGenerator } = require('./generators/ValidationGenerator');
const { ImplementationGenerator } = require('./generators/ImplementationGenerator');
const { DatabaseAdapter } = require('./adapters/DatabaseAdapter');
const { NameGenerator } = require('../generators/NameGenerator');

class ControllerGenerator {
  static async generate(dbType, controllersDir, spec) {
    console.log(chalk.blue('\nStarting controller generation...'));
    console.log('Database type:', dbType);
    console.log('Available paths:', Object.keys(spec.paths));
    
    if (!spec?.paths) {
      throw new Error('Invalid OpenAPI specification: missing paths');
    }

    const dbAdapter = DatabaseAdapter.create(dbType);
    await this.generateControllers(controllersDir, spec, dbAdapter);
  }

  static async generateControllers(controllersDir, spec, dbAdapter) {
    try {
      const resources = this.groupPathsByResource(spec.paths);
      console.log('\nResources found:', Object.keys(resources));

      for (const [resourcePath, pathGroup] of Object.entries(resources)) {
        console.log(`\nProcessing resource: ${resourcePath}`);
        
        const normalizedName = NameGenerator.toCamelCase(resourcePath);
        console.log('Normalized name:', normalizedName);
        
        const modelName = NameGenerator.toModelName(resourcePath);
        console.log('Model name:', modelName);
        
        const controllerContent = await this.generateControllerContent(normalizedName, modelName, pathGroup, dbAdapter);
        const filePath = path.join(controllersDir, `${normalizedName}.controller.js`);
        
        await fs.writeFile(filePath, controllerContent);
        console.log(chalk.green(`✓ Generated controller: ${normalizedName}`));
      }
    } catch (error) {
      console.error(chalk.red('Error generating controllers:'), error);
      throw error;
    }
  }

  static groupPathsByResource(paths) {
    const resources = {};
    
    for (const [pathKey, operations] of Object.entries(paths)) {
      // Extract resource name from path
      const parts = pathKey.split('/');
      const resource = parts[1]; // Get first path segment after leading slash
      
      if (!resources[resource]) {
        resources[resource] = { paths: [] };
      }
      
      // Filter out parameters from operations
      const { parameters, ...pathOperations } = operations;
      
      resources[resource].paths.push({
        path: pathKey,
        operations: pathOperations,
        pathParameters: parameters
      });
    }
    
    return resources;
  }

  static async generateControllerContent(resourceName, modelName, pathGroup, dbAdapter) {
    const imports = this.generateImports(dbAdapter);
    const methods = this.generateMethods(resourceName, modelName, pathGroup, dbAdapter);
    const exports = this.generateExports(methods.map(m => m.name));

    return [imports, ...methods.map(m => m.content), exports].join('\n\n');
  }

  static generateImports(dbAdapter) {
    return [
      `const { ApiError } = require('../middleware/errorHandler');`,
      `const logger = require('../utils/logger');`,
      dbAdapter.getImportStatement()
    ].join('\n');
  }

  static generateMethods(resourceName, modelName, pathGroup, dbAdapter) {
    const methods = [];

    for (const { path, operations, pathParameters } of pathGroup.paths) {
      for (const [method, operation] of Object.entries(operations)) {
        // Skip parameters
        if (method === 'parameters') continue;

        const functionName = NameGenerator.generateControllerMethodName(method, resourceName, path);
        const validations = ValidationGenerator.generateValidations({
          ...operation,
          parameters: [...(pathParameters || []), ...(operation.parameters || [])]
        });

        const implementation = ImplementationGenerator.generate(
          method,
          path,
          operation,
          modelName,
          dbAdapter
        );

        const methodContent = MethodGenerator.generateControllerMethod(
          functionName,
          method,
          path,
          operation,
          validations,
          implementation
        );

        methods.push({ name: functionName, content: methodContent });
      }
    }

    return methods;
  }

  static generateExports(methodNames) {
    return `module.exports = {\n  ${methodNames.join(',\n  ')}\n};`;
  }
}

module.exports = { ControllerGenerator };

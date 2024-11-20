const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class RouteGenerator {
  static async generate(routesDir, spec) {
    console.log(chalk.blue('\nGenerating routes...'));
    
    if (!spec.paths) {
      console.log(chalk.yellow('No paths found in OpenAPI spec'));
      return;
    }

    await fs.ensureDir(routesDir);
    const indexPath = path.join(routesDir, 'index.js');
    const routes = [];

    try {
      for (const [pathKey, pathObj] of Object.entries(spec.paths)) {
        const routeName = this.getRouteName(pathKey);
        const routePath = path.join(routesDir, `${routeName}.route.js`);
        const routeContent = this.generateRouteFile(pathKey, pathObj, routeName, spec);
        
        await fs.writeFile(routePath, routeContent);
        routes.push({ name: routeName, path: pathKey });
        console.log(chalk.green(`✓ Generated route: ${routeName}`));
      }

      await this.generateIndexFile(indexPath, routes);
      console.log(chalk.green('✓ Generated routes index file'));
    } catch (error) {
      console.error(chalk.red('Error generating routes:'), error);
      throw error;
    }
  }

  static getRouteName(pathKey) {
    // Extract the base resource name (e.g., 'pets' from '/pets' or '/pets/{id}')
    const parts = pathKey.split('/').filter(Boolean);
    return parts[0];
  }

  static getBasePath(pathKey) {
    // Get the base path for mounting routes (e.g., '/pets' from '/pets/{id}')
    const parts = pathKey.split('/').filter(Boolean);
    return `/${parts[0]}`;
  }

  static generateRouteFile(pathKey, pathObj, routeName, spec) {
    // Get all paths that start with the same base resource
    const resourcePaths = Object.entries(spec.paths)
      .filter(([path]) => path.startsWith(`/${routeName}`));

    // Collect all methods and operations across related paths
    const operationMap = {};
    const validationSchemas = [];
    const routes = [];

    resourcePaths.forEach(([path, operations]) => {
      Object.entries(operations).forEach(([method, operation]) => {
        const functionName = operation.operationId
          ? operation.operationId.charAt(0).toLowerCase() + operation.operationId.slice(1)
          : `${method.toLowerCase()}${routeName.charAt(0).toUpperCase() + routeName.slice(1)}`;
        
        operationMap[functionName] = true;

        // Generate validation schemas
        if (operation.requestBody?.content?.['application/json']?.schema) {
          const bodySchema = this.generateJoiSchema(operation.requestBody.content['application/json'].schema);
          validationSchemas.push(`const ${functionName}BodySchema = ${bodySchema};`);
        }

        const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
        if (pathParams.length > 0) {
          const paramsSchema = this.generateParamsJoiSchema(pathParams);
          validationSchemas.push(`const ${functionName}ParamsSchema = ${paramsSchema};`);
        }

        const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
        if (queryParams.length > 0) {
          const querySchema = this.generateQueryJoiSchema(queryParams);
          validationSchemas.push(`const ${functionName}QuerySchema = ${querySchema};`);
        }

        // Generate route
        let routePath = '/';
        if (path.includes('{')) {
          routePath = this.convertPathToExpress('/' + path.split('/').slice(2).join('/'));
        }

        const middlewares = [];
        if (operation.security?.some(s => s.bearerAuth)) {
          middlewares.push('auth');
        }

        if (operation.requestBody) {
          middlewares.push(`validateSchema('body', ${functionName}BodySchema)`);
        }

        if (pathParams.length > 0) {
          middlewares.push(`validateSchema('params', ${functionName}ParamsSchema)`);
        }

        if (queryParams.length > 0) {
          middlewares.push(`validateSchema('query', ${functionName}QuerySchema)`);
        }

        let route = `router.${method.toLowerCase()}('${routePath}'`;
        if (middlewares.length) {
          route += `, ${middlewares.join(', ')}`;
        }
        route += `, ${functionName});`;

        routes.push(route);
      });
    });

    // Generate the complete file content
    const imports = [
      `const express = require('express');`,
      `const { ${Object.keys(operationMap).join(', ')} } = require('../controllers/${routeName}.controller');`,
      `const { validateSchema } = require('../middleware/validator');`,
      `const { auth } = require('../middleware/auth');`,
      `const Joi = require('joi');`,
      `const router = express.Router();`
    ].join('\n');

    return `${imports}\n\n${validationSchemas.join('\n\n')}\n\n${routes.join('\n')}\n\nmodule.exports = router;`;
  }

  static generateIndexFile(indexPath, routes) {
    // Group routes by base resource to avoid duplicate mounting
    const resourceGroups = routes.reduce((acc, route) => {
      const basePath = this.getBasePath(route.path);
      if (!acc[basePath]) {
        acc[basePath] = {
          basePath,
          routeName: this.getRouteName(route.path)
        };
      }
      return acc;
    }, {});

    const content = `const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Request tracking middleware
router.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body
  });
  next();
});

${Object.values(resourceGroups).map(({ basePath, routeName }) => 
  `// Mount ${basePath} routes
router.use('${basePath}', require('./${routeName}.route'));`
).join('\n\n')}

module.exports = router;`;

    return fs.writeFile(indexPath, content);
  }

  static convertPathToExpress(pathKey) {
    // Convert OpenAPI path params ({param}) to Express style (:param)
    return pathKey.replace(/{([^}]+)}/g, ':$1');
  }

  static generateJoiSchema(schema) {
    let schemaStr = 'Joi.object({\n';
    const properties = schema.properties || {};
    const required = schema.required || [];
    
    const props = Object.entries(properties).map(([key, prop]) => {
      let validation = this.generateJoiValidation(prop);
      if (required.includes(key)) {
        validation += '.required()';
      }
      return `  ${key}: ${validation}`;
    });
    
    schemaStr += props.join(',\n');
    schemaStr += '\n})';
    return schemaStr;
  }

  static generateParamsJoiSchema(params) {
    let schemaStr = 'Joi.object({\n';
    
    const props = params.map(param => {
      let validation = this.generateJoiValidation(param.schema);
      validation += '.required()'; // Path params are always required
      return `  ${param.name}: ${validation}`;
    });
    
    schemaStr += props.join(',\n');
    schemaStr += '\n})';
    return schemaStr;
  }

  static generateQueryJoiSchema(params) {
    let schemaStr = 'Joi.object({\n';
    
    const props = params.map(param => {
      let validation = this.generateJoiValidation(param.schema);
      if (param.required) {
        validation += '.required()';
      }
      return `  ${param.name}: ${validation}`;
    });
    
    // Add common pagination parameters
    props.push('  limit: Joi.number().integer().min(1).max(100).default(10)');
    props.push('  offset: Joi.number().integer().min(0).default(0)');
    
    schemaStr += props.join(',\n');
    schemaStr += '\n})';
    return schemaStr;
  }

  static generateJoiValidation(schema) {
    switch (schema.type) {
      case 'string':
        let strValidation = 'Joi.string()';
        if (schema.enum) {
          strValidation += `.valid(${schema.enum.map(e => `'${e}'`).join(', ')})`;
        }
        if (schema.format === 'date-time') {
          strValidation += '.iso()';
        }
        if (schema.format === 'email') {
          strValidation += '.email()';
        }
        if (schema.minLength) {
          strValidation += `.min(${schema.minLength})`;
        }
        if (schema.maxLength) {
          strValidation += `.max(${schema.maxLength})`;
        }
        if (schema.pattern) {
          strValidation += `.pattern(/${schema.pattern}/)`;
        }
        return strValidation;
        
      case 'number':
      case 'integer':
        let numValidation = 'Joi.number()';
        if (schema.type === 'integer') {
          numValidation += '.integer()';
        }
        if (schema.minimum !== undefined) {
          numValidation += `.min(${schema.minimum})`;
        }
        if (schema.maximum !== undefined) {
          numValidation += `.max(${schema.maximum})`;
        }
        return numValidation;
        
      case 'boolean':
        return 'Joi.boolean()';
        
      case 'array':
        let arrayValidation = 'Joi.array()';
        if (schema.items) {
          arrayValidation += `.items(${this.generateJoiValidation(schema.items)})`;
        }
        if (schema.minItems) {
          arrayValidation += `.min(${schema.minItems})`;
        }
        if (schema.maxItems) {
          arrayValidation += `.max(${schema.maxItems})`;
        }
        return arrayValidation;
        
      case 'object':
        if (schema.properties) {
          return this.generateJoiSchema(schema);
        }
        return 'Joi.object()';
        
      default:
        return 'Joi.any()';
    }
  }
}

module.exports = {
  RouteGenerator,
  generateRoutes: RouteGenerator.generate.bind(RouteGenerator)
};
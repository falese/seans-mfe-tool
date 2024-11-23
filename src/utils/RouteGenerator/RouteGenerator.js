const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { SchemaGenerator } = require('./generators/SchemaGenerator');
const { PathGenerator } = require('./generators/PathGenerator');
const { NameGenerator } = require('../generators/NameGenerator');

class RouteGenerator {
  static async generate(routesDir, spec) {
    console.log(chalk.blue('\nGenerating routes...'));
    
    if (!spec.paths) {
      console.log(chalk.yellow('No paths found in OpenAPI spec'));
      return;
    }

    await fs.ensureDir(routesDir);
    const routes = [];

    try {
      // Group paths by resource
      const resourceGroups = this.groupPathsByResource(spec.paths);
      console.log('Found resources:', Object.keys(resourceGroups));

      // Generate route files for each resource
      for (const [resource, paths] of Object.entries(resourceGroups)) {
        console.log(`\nProcessing resource: ${resource}`);
        
        // Convert resource names
        const camelResource = NameGenerator.toCamelCase(resource); // for imports
        const fileName = camelResource; // for file names
        const routePath = NameGenerator.toKebabCase(resource); // for URL paths
        
        console.log(`Resource name: ${resource}`);
        console.log(`Camel case: ${camelResource}`);
        console.log(`File name: ${fileName}`);
        console.log(`Route path: ${routePath}`);
        
        // Generate route file
        const routeFilePath = path.join(routesDir, `${fileName}.route.js`);
        const routeContent = this.generateRouteFile(paths, camelResource, spec);
        
        await fs.writeFile(routeFilePath, routeContent);
        routes.push({ 
          name: fileName,
          path: `/${routePath}`,
          camelName: camelResource 
        });
        console.log(chalk.green(`✓ Generated route: ${fileName}`));
      }

      // Generate index file
      await this.generateIndexFile(path.join(routesDir, 'index.js'), routes);
      console.log(chalk.green('✓ Generated routes index file'));
    } catch (error) {
      console.error(chalk.red('Error generating routes:'), error);
      throw error;
    }
  }

  static generateRouteFile(paths, resourceName, spec) {
    console.log(`Generating route file for ${resourceName}`);
    const { operationMap, validationSchemas, routes } = PathGenerator.generatePathContent(
      paths, 
      resourceName,
      spec
    );

    const imports = [
      `const express = require('express');`,
      `const { ${Object.keys(operationMap).join(', ')} } = require('../controllers/${resourceName}.controller');`,
      `const { validateSchema } = require('../middleware/validator');`,
      `const { auth } = require('../middleware/auth');`,
      `const Joi = require('joi');`,
      `const router = express.Router();`
    ].join('\n');

    return [
      imports,
      '',
      validationSchemas.join('\n\n'),
      '',
      routes.join('\n'),
      '',
      'module.exports = router;'
    ].join('\n');
  }

  static async generateIndexFile(indexPath, routes) {
    const content = `const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Request logging middleware
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

${routes.map(({ name, path }) => 
  `// Mount ${path} routes
router.use('', require('./${name}.route'));`
).join('\n\n')}

module.exports = router;`;

    await fs.writeFile(indexPath, content);
  }

  static groupPathsByResource(paths) {
    const groups = {};
    
    for (const [pathKey, operations] of Object.entries(paths)) {
      const resource = pathKey.split('/')[1];
      if (!resource) continue;
      
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push([pathKey, operations]);
    }
    
    return groups;
  }
}

module.exports = { RouteGenerator };
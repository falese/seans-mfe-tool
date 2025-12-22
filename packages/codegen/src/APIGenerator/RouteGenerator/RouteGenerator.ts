// @ts-nocheck - Migrated from JS, types need cleanup
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { SchemaGenerator } from '../utils/SchemaGenerator';
import { PathGenerator } from '../utils/PathGenerator';
import { NameGenerator } from '../utils/NameGenerator';
import { createLogger } from '@seans-mfe-tool/logger';

const logger = createLogger({ context: 'codegen:routes', silent: process.env.NODE_ENV === 'test' });

class RouteGenerator {
    static async generate(routesDir, spec) {
        logger.info(chalk.blue('\nGenerating routes...'));
        if (!spec.paths) {
            logger.info(chalk.yellow('No paths found in OpenAPI spec'));
            return;
        }
        await fs.ensureDir(routesDir);
        const routes = [];
        try {
            // Group paths by resource
            const resourceGroups = this.groupPathsByResource(spec.paths);
            logger.info('Found resources:', Object.keys(resourceGroups));
            // Generate route files for each resource
            for (const [resource, paths] of Object.entries(resourceGroups)) {
                logger.info(`\nProcessing resource: ${resource}`);
                // Convert resource names
                const camelResource = NameGenerator.toCamelCase(resource); // for imports
                const fileName = camelResource; // for file names
                const routePath = NameGenerator.toKebabCase(resource); // for URL paths
                logger.info(`Resource name: ${resource}`);
                logger.info(`Camel case: ${camelResource}`);
                logger.info(`File name: ${fileName}`);
                logger.info(`Route path: ${routePath}`);
                // Generate route file
                const routeFilePath = path.join(routesDir, `${fileName}.route.js`);
                const routeContent = this.generateRouteFile(paths, camelResource, spec);
                await fs.writeFile(routeFilePath, routeContent, 'utf8');
                routes.push({
                    name: fileName,
                    path: `/${routePath}`,
                    camelName: camelResource
                });
                logger.info(chalk.green(`✓ Generated route: ${fileName}`));
            }
            // Generate index file
            await this.generateIndexFile(path.join(routesDir, 'index.js'), routes);
            logger.info(chalk.green('✓ Generated routes index file'));
        }
        catch (error) {
            logger.error(chalk.red('Error generating routes:'), error);
            throw error;
        }
    }
    static generateRouteFile(paths, resourceName, spec) {
        logger.info(`Generating route file for ${resourceName}`);
        const { operationMap, validationSchemas, routes } = PathGenerator.generatePathContent(paths, resourceName, spec);
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
const { createLogger } = require('@seans-mfe-tool/logger');

const logger = createLogger({ context: 'api:routes' });

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

${routes.map(({ name, path }) => `// Mount ${path} routes
router.use('', require('./${name}.route'));`).join('\n\n')}

module.exports = router;`;
        await fs.writeFile(indexPath, content, 'utf8');
    }
    static groupPathsByResource(paths) {
        const groups = {};
        for (const [pathKey, operations] of Object.entries(paths)) {
            const resource = pathKey.split('/')[1];
            if (!resource)
                continue;
            if (!groups[resource]) {
                groups[resource] = [];
            }
            groups[resource].push([pathKey, operations]);
        }
        return groups;
    }
}
export { RouteGenerator };

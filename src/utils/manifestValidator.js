/**
 * DSL Manifest Validator
 * Validates MFE manifest structure and configuration
 * ADR-062: Ensures proper separation of plugins and transforms
 */

const chalk = require('chalk');

// Known GraphQL Mesh plugins (from @graphql-mesh/plugin-*)
const KNOWN_PLUGINS = [
  'responseCache',
  'prometheus',
  'opentelemetry',
  'newrelic',
  'statsd',
  'liveQuery',
  'defer-stream',
  'meshHttp',
  'snapshot',
  'mock',
  'operationFieldPermissions',
  'jwtAuth',
  'hmac',
];

// Known GraphQL Mesh transforms (from @graphql-mesh/transform-*)
const KNOWN_TRANSFORMS = [
  'rateLimit',
  'filterSchema',
  'rename',
  'prefix',
  'namingConvention',
  'resolversComposition',
  'encapsulate',
  'federation',
  'extend',
  'cache',
  'mock',
  'type-merging',
  'bare',
];

/**
 * Validate manifest plugin configuration
 * @param {Object} manifest - The full manifest object
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
function validateManifest(manifest) {
  const errors = [];
  const warnings = [];

  // Check if performance section exists (legacy format)
  if (manifest.performance) {
    errors.push(
      'Legacy "performance" section detected. Please migrate to "plugins" and "transforms" sections (see ADR-062)'
    );
  }

  // Validate plugins section
  if (manifest.plugins && Array.isArray(manifest.plugins)) {
    manifest.plugins.forEach((plugin, index) => {
      const pluginName = typeof plugin === 'string' ? plugin : Object.keys(plugin)[0];
      
      if (KNOWN_TRANSFORMS.includes(pluginName)) {
        errors.push(
          `Plugin at index ${index} "${pluginName}" is a transform, not a plugin. Move it to the "transforms" section.`
        );
      } else if (!KNOWN_PLUGINS.includes(pluginName)) {
        warnings.push(
          `Unknown plugin "${pluginName}" at index ${index}. Ensure it's a valid @graphql-mesh/plugin-* package.`
        );
      }
    });
  }

  // Validate transforms section
  if (manifest.transforms && Array.isArray(manifest.transforms)) {
    manifest.transforms.forEach((transform, index) => {
      const transformName = typeof transform === 'string' ? transform : Object.keys(transform)[0];
      
      if (KNOWN_PLUGINS.includes(transformName)) {
        errors.push(
          `Transform at index ${index} "${transformName}" is a plugin, not a transform. Move it to the "plugins" section.`
        );
      } else if (!KNOWN_TRANSFORMS.includes(transformName)) {
        warnings.push(
          `Unknown transform "${transformName}" at index ${index}. Ensure it's a valid @graphql-mesh/transform-* package.`
        );
      }
    });
  }

  // Validate resolversComposition section
  if (manifest.resolversComposition) {
    if (typeof manifest.resolversComposition !== 'object') {
      errors.push('resolversComposition must be an object mapping resolver paths to composer functions');
    } else {
      Object.keys(manifest.resolversComposition).forEach((key) => {
        const value = manifest.resolversComposition[key];
        if (typeof value !== 'string') {
          errors.push(
            `resolversComposition["${key}"] must be a string path to a composer function`
          );
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Print validation results to console
 * @param {Object} result - Validation result from validateManifest
 * @param {string} manifestPath - Path to manifest file
 */
function printValidationResults(result, manifestPath) {
  if (result.valid) {
    console.log(chalk.green(`✓ Manifest validation passed: ${manifestPath}`));
  } else {
    console.log(chalk.red(`✗ Manifest validation failed: ${manifestPath}`));
  }

  if (result.errors.length > 0) {
    console.log(chalk.red('\nErrors:'));
    result.errors.forEach((error, i) => {
      console.log(chalk.red(`  ${i + 1}. ${error}`));
    });
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    result.warnings.forEach((warning, i) => {
      console.log(chalk.yellow(`  ${i + 1}. ${warning}`));
    });
  }

  console.log(); // Empty line
}

/**
 * Get required dependencies for plugins and transforms
 * @param {Object} manifest - The full manifest object
 * @returns {Object} - { plugins: string[], transforms: string[] }
 */
function getRequiredDependencies(manifest) {
  const pluginDeps = new Set();
  const transformDeps = new Set();

  // Always include core dependencies
  pluginDeps.add('@graphql-mesh/cli');
  pluginDeps.add('@graphql-mesh/graphql');

  // Add plugin dependencies
  if (manifest.plugins && Array.isArray(manifest.plugins)) {
    manifest.plugins.forEach((plugin) => {
      const pluginName = typeof plugin === 'string' ? plugin : Object.keys(plugin)[0];
      
      // Map plugin name to package name
      const packageName = `@graphql-mesh/plugin-${pluginName
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')}`;
      
      pluginDeps.add(packageName);
    });
  }

  // Add transform dependencies
  if (manifest.transforms && Array.isArray(manifest.transforms)) {
    manifest.transforms.forEach((transform) => {
      const transformName = typeof transform === 'string' ? transform : Object.keys(transform)[0];
      
      // Map transform name to package name
      const packageName = `@graphql-mesh/transform-${transformName
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')}`;
      
      transformDeps.add(packageName);
    });
  }

  return {
    plugins: Array.from(pluginDeps),
    transforms: Array.from(transformDeps),
  };
}

module.exports = {
  validateManifest,
  printValidationResults,
  getRequiredDependencies,
  KNOWN_PLUGINS,
  KNOWN_TRANSFORMS,
};

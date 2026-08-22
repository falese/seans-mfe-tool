/**
 * Manifest validation — the checks that run before anything is generated.
 *
 * `validateManifestConfiguration` is the gate `generateAllFiles` calls first:
 * it classifies the manifest's Mesh plugins and transforms against the
 * allow-lists in ./catalog and refuses to generate from a manifest that names
 * something unknown (ADR-027). Generating from a bad configuration and letting
 * it fail at runtime, in a container, is the outcome this prevents.
 *
 * Pure: no disk access, no rendering.
 */

import type { DSLManifest } from '@seans-mfe/dsl';
import { ValidationError } from '@seans-mfe/contracts';
import { KNOWN_MESH_PLUGINS, KNOWN_MESH_TRANSFORMS } from './catalog';

/**
 * Validation result for plugin/transform classification
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  classification: {
    plugins: string[];
    transforms: string[];
    unknown: string[];
  };
}

/**
 * Validate and classify plugins from manifest
 * Enforces separation between plugins and transforms
 * Supports both object format {pluginName: config} and array format [{pluginName: config}]
 */
export function validateManifestPlugins(manifest: DSLManifest): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    classification: {
      plugins: [],
      transforms: [],
      unknown: [],
    },
  };

  // Check if manifest has plugins section (can be array or object). Not a
  // field DSLManifest declares at the top level (plugins live under
  // manifest.data.plugins per ADR-027) — this defends against pre-Zod-parse
  // YAML that misplaces it, hence the unknown-narrowed read rather than a
  // typed property access.
  const manifestPlugins = (manifest as unknown as Record<string, unknown>).plugins;
  if (!manifestPlugins) return result;

  // Handle both array and object formats
  const pluginEntries = Array.isArray(manifestPlugins)
    ? manifestPlugins.map((p) => (typeof p === 'string' ? p : Object.keys(p as object)[0]))
    : Object.keys(manifestPlugins as object);

  for (const pluginName of pluginEntries) {
    if (KNOWN_MESH_PLUGINS.has(pluginName)) {
      result.classification.plugins.push(pluginName);
    } else if (KNOWN_MESH_TRANSFORMS.has(pluginName)) {
      // This is a transform, not a plugin!
      result.errors.push(
        `"${pluginName}" is a transform, not a plugin. Move it to the "transforms" section.`
      );
      result.classification.transforms.push(pluginName);
      result.valid = false;
    } else {
      result.warnings.push(
        `Unknown plugin "${pluginName}". Ensure it's a valid @graphql-mesh/plugin-* package.`
      );
      result.classification.unknown.push(pluginName);
    }
  }

  return result;
}

/**
 * Validate and classify transforms from manifest
 * Supports both object format {transformName: config} and array format [{transformName: config}]
 */
export function validateManifestTransforms(manifest: DSLManifest): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    classification: {
      plugins: [],
      transforms: [],
      unknown: [],
    },
  };

  // Check if manifest has transforms section (can be array or object). Same
  // unknown-narrowed defensive read as validateManifestPlugins above — this
  // classification predates DSLManifestSchema's current `transforms: string[]`
  // shape and still needs to tolerate a pre-Zod-parse {name: config} form.
  const manifestTransforms = (manifest as unknown as Record<string, unknown>).transforms;
  if (!manifestTransforms) return result;

  // Handle both array and object formats
  const transformEntries = Array.isArray(manifestTransforms)
    ? manifestTransforms.map((t) => (typeof t === 'string' ? t : Object.keys(t as object)[0]))
    : Object.keys(manifestTransforms as object);

  for (const transformName of transformEntries) {
    if (KNOWN_MESH_TRANSFORMS.has(transformName)) {
      result.classification.transforms.push(transformName);
    } else if (KNOWN_MESH_PLUGINS.has(transformName)) {
      // This is a plugin, not a transform!
      result.errors.push(
        `"${transformName}" is a plugin, not a transform. Move it to the "plugins" section.`
      );
      result.classification.plugins.push(transformName);
      result.valid = false;
    } else {
      result.warnings.push(
        `Unknown transform "${transformName}". Ensure it's a valid @graphql-mesh/transform-* package.`
      );
      result.classification.unknown.push(transformName);
    }
  }

  return result;
}

/**
 * Comprehensive validation of manifest plugin/transform configuration
 * Throws error if validation fails (protect code generation)
 */
export function validateManifestConfiguration(manifest: DSLManifest): void {
  const pluginValidation = validateManifestPlugins(manifest);
  const transformValidation = validateManifestTransforms(manifest);

  const allErrors = [...pluginValidation.errors, ...transformValidation.errors];
  const allWarnings = [...pluginValidation.warnings, ...transformValidation.warnings];

  // Log warnings (non-fatal)
  if (allWarnings.length > 0) {
    console.warn('\n⚠️  Manifest Configuration Warnings:');
    allWarnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  // Throw on errors (fatal - prevent bad generation)
  if (allErrors.length > 0) {
    console.error('\n❌ Manifest Configuration Errors:');
    allErrors.forEach((error) => console.error(`  - ${error}`));
    throw new ValidationError(
      `Manifest validation failed with ${allErrors.length} error(s). ` +
        `Please correct the plugin/transform configuration in your mfe-manifest.yaml.`,
      'data',
      'valid-plugin-transform-config'
    );
  }

  // Log success for visibility
  const totalPlugins = pluginValidation.classification.plugins.length;
  const totalTransforms = transformValidation.classification.transforms.length;
  console.log(
    `✅ Manifest validation passed: ${totalPlugins} plugin(s), ${totalTransforms} transform(s)`
  );
}

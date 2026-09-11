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
import { classifyMeshEntry } from '@seans-mfe/contracts';
import type { GeneratorDiagnostic } from './file-plan';

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
    switch (classifyMeshEntry(pluginName)) {
      // 'ambiguous' shares this branch: a name Mesh ships in both positions
      // (`mock`, `snapshot`) is correct here and must not be reported as
      // misplaced — ADR-090 §2. The previous Set-based lookup listed those
      // names in both allow-lists, which disabled the misclassification check
      // for them by accident rather than by decision.
      case 'plugin':
      case 'ambiguous':
        result.classification.plugins.push(pluginName);
        break;
      case 'transform':
        result.errors.push(
          `"${pluginName}" is a transform, not a plugin. Move it to the "transforms" section.`
        );
        result.classification.transforms.push(pluginName);
        result.valid = false;
        break;
      case 'unknown':
        result.warnings.push(
          `Unknown plugin "${pluginName}". Ensure it's a valid @graphql-mesh/plugin-* package.`
        );
        result.classification.unknown.push(pluginName);
        break;
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
    switch (classifyMeshEntry(transformName)) {
      case 'transform':
      case 'ambiguous':
        result.classification.transforms.push(transformName);
        break;
      case 'plugin':
        result.errors.push(
          `"${transformName}" is a plugin, not a transform. Move it to the "plugins" section.`
        );
        result.classification.plugins.push(transformName);
        result.valid = false;
        break;
      case 'unknown':
        result.warnings.push(
          `Unknown transform "${transformName}". Ensure it's a valid @graphql-mesh/transform-* package.`
        );
        result.classification.unknown.push(transformName);
        break;
    }
  }

  return result;
}

/**
 * Classify a manifest's Mesh plugins and transforms, and say whether
 * generation may proceed (ADR-027, ADR-092).
 *
 * Returns rather than prints. It used to write four kinds of line to stdout
 * and stderr — an emoji warnings heading, an emoji errors heading, the items
 * under each, and a "✅ Manifest validation passed" summary on every single
 * successful run. A library that narrates is not embeddable, and under
 * `--json` that output lands in a stream the envelope contract reserves
 * (ADR-018).
 *
 * It still refuses: the caller throws on `ok: false`. ADR-027's point is that
 * generating from a bad configuration and discovering it at runtime, in a
 * container, is the outcome worth preventing — reporting differently is not
 * the same as permitting.
 */
export function validateManifestConfiguration(manifest: DSLManifest): {
  ok: boolean;
  diagnostics: GeneratorDiagnostic[];
} {
  const plugins = validateManifestPlugins(manifest);
  const transforms = validateManifestTransforms(manifest);

  const diagnostics: GeneratorDiagnostic[] = [
    ...[...plugins.errors, ...transforms.errors].map((message) => ({
      severity: 'error' as const,
      code: 'mesh-misclassified',
      message,
      fix: 'Move the entry to the section its kind belongs in.',
    })),
    ...[...plugins.warnings, ...transforms.warnings].map((message) => ({
      severity: 'warning' as const,
      code: 'mesh-unknown',
      message,
    })),
  ];

  return { ok: !diagnostics.some((d) => d.severity === 'error'), diagnostics };
}

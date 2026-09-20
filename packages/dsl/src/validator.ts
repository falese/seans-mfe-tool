/**
 * DSL Validator using Zod
 * Following ADR-014: Incremental TypeScript migration
 * Implements REQ-REMOTE-001: DSL validation
 */

import { ZodError } from 'zod';
import { classifyMeshEntry } from '@seans-mfe/contracts';
import { 
  DSLManifestSchema, 
  PartialDSLManifestSchema,
  CapabilityEntrySchema,
  DataConfigSchema,
  type DSLManifest,
  type ValidationResult,
  type ValidationError
} from './schema';

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Format Zod errors into our ValidationError format
 */
function formatZodErrors(zodError: ZodError): ValidationError[] {
  return zodError.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate a complete DSL manifest
 * 
 * @param data - Raw data to validate (from YAML parse)
 * @returns Validation result with typed manifest if valid
 */
export function validateManifest(data: unknown): ValidationResult {
  const result = DSLManifestSchema.safeParse(data);
  
  if (result.success) {
    return {
      valid: true,
      errors: [],
      manifest: result.data
    };
  }
  
  return {
    valid: false,
    errors: formatZodErrors(result.error)
  };
}

/**
 * Validate a partial manifest (for scaffolding)
 * Only requires name, relaxes other fields
 * 
 * @param data - Raw data to validate
 * @returns Validation result
 */
export function validatePartialManifest(data: unknown): ValidationResult {
  const result = PartialDSLManifestSchema.safeParse(data);
  
  if (result.success) {
    return {
      valid: true,
      errors: [],
      manifest: result.data as DSLManifest  // Partial but valid
    };
  }
  
  return {
    valid: false,
    errors: formatZodErrors(result.error)
  };
}

/**
 * Validate capabilities array
 * 
 * @param capabilities - Capabilities to validate
 * @returns Validation result
 */
export function validateCapabilities(capabilities: unknown): ValidationResult {
  const schema = CapabilityEntrySchema.array();
  const result = schema.safeParse(capabilities);
  
  if (result.success) {
    return {
      valid: true,
      errors: []
    };
  }
  
  return {
    valid: false,
    errors: formatZodErrors(result.error)
  };
}

/**
 * Validate data configuration (BFF layer)
 * 
 * @param data - Data config to validate
 * @returns Validation result
 */
export function validateDataConfig(data: unknown): ValidationResult {
  const result = DataConfigSchema.safeParse(data);
  
  if (result.success) {
    return {
      valid: true,
      errors: []
    };
  }
  
  return {
    valid: false,
    errors: formatZodErrors(result.error)
  };
}

// =============================================================================
// Semantic Validation (Beyond Schema)
// =============================================================================

/**
 * Validate performance configuration for proper plugin/transform categorization
 * 
 * @param manifest - Already schema-validated manifest
 * @returns Array of validation errors (empty if valid)
 */
function validatePerformanceConfig(_manifest: DSLManifest): ValidationError[] {
  // Deliberately empty (ADR-092).
  //
  // This used to require that enabling `performance.rateLimit` or
  // `performance.filterSchema` was accompanied by a matching entry in the
  // top-level `transforms` array, and reported `missing_transform` otherwise.
  // The generator derives both transforms from the `performance` block itself
  // (`render-model.ts`: `rateLimit: performanceConfig.rateLimit?.enabled ? … :
  // null`), so the check demanded the author duplicate a derivation — and
  // failed the manifest when they did not. Measured: a manifest with
  // `performance.rateLimit.enabled: true` and no `transforms` array was
  // rejected, for a configuration the platform handles correctly.
  //
  // Kept as a named seam rather than deleted outright: performance config is
  // the obvious place for real cross-field rules, and the next one should land
  // here rather than re-growing a copy elsewhere.
  return [];
}

/**
 * Classify each entry of the top-level `transforms` array (ADR-092).
 *
 * Entries are plain strings (`CustomTransformSchema = z.string()`). The name
 * is resolved through the single Mesh table in `@seans-mfe/contracts`, so both
 * the config-key spelling (`filterSchema`) and the package spelling
 * (`filter-schema`) are accepted — they previously disagreed with codegen,
 * which read this same field against a camelCase-only list.
 */
function validateTransformsConfig(manifest: DSLManifest): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!manifest.transforms || manifest.transforms.length === 0) return errors;

  manifest.transforms.forEach((transform, index) => {
    if (typeof transform !== 'string') return;
    const name = transform.split(':')[0].trim();
    if (!name) return;

    switch (classifyMeshEntry(name)) {
      case 'plugin':
        errors.push({
          path: `transforms[${index}]`,
          message: `'${name}' is a plugin, not a transform. It should be configured in the 'performance' section instead.`,
          code: 'misclassified_plugin',
        });
        break;
      case 'unknown':
        // Deliberately NOT an error here (ADR-092). `ValidationResult` has no
        // warning channel, so reporting an unrecognised name would make it
        // fatal — and the platform's stated policy for open vocabularies is a
        // warning, not a rejection (ADR-036, applied to `framework` and
        // `bundler` for the same reason: Mesh ships more transforms than any
        // table here will track).
        //
        // Codegen already warns on exactly this field at generation time
        // (`validateManifestTransforms`), so the concern has an owner. What it
        // does not have, any more, is two owners disagreeing about severity.
        break;
      case 'transform':
      case 'ambiguous':
        break;
    }
  });

  return errors;
}

/**
 * Perform semantic validation beyond schema checks
 * 
 * @param manifest - Already schema-validated manifest
 * @returns Array of validation errors (empty if valid)
 */
export function validateSemantics(manifest: DSLManifest): ValidationError[] {
  const errors: ValidationError[] = [];

  // The web build has two spellings — the top-level `framework`/`bundler`
  // scalars and `targets.web` (ADR-095 §6). They may coexist; they may not
  // disagree. Resolving a winner silently is the defect class this repo keeps
  // paying for, so a manifest that states the same fact twice and differently
  // is rejected here rather than quietly building one of the two.
  const web = manifest.targets?.web;
  if (web?.framework && manifest.framework && web.framework !== manifest.framework) {
    errors.push({
      path: 'targets.web.framework',
      message:
        `targets.web.framework is "${web.framework}" but the top-level framework is ` +
        `"${manifest.framework}". They describe the same build — remove one.`,
      code: 'target_web_conflict',
    });
  }
  if (web?.bundler && manifest.bundler && web.bundler !== manifest.bundler) {
    errors.push({
      path: 'targets.web.bundler',
      message:
        `targets.web.bundler is "${web.bundler}" but the top-level bundler is ` +
        `"${manifest.bundler}". They describe the same build — remove one.`,
      code: 'target_web_conflict',
    });
  }
  
  // Check for duplicate capability names
  const capabilityNames = new Set<string>();
  for (const entry of manifest.capabilities) {
    for (const name of Object.keys(entry)) {
      if (capabilityNames.has(name)) {
        errors.push({
          path: `capabilities.${name}`,
          message: `Duplicate capability name: ${name}`,
          code: 'duplicate_capability'
        });
      }
      capabilityNames.add(name);
    }
  }
  
  // Check that data sources have unique names
  if (manifest.data?.sources) {
    const sourceNames = new Set<string>();
    for (const source of manifest.data.sources) {
      if (sourceNames.has(source.name)) {
        errors.push({
          path: `data.sources.${source.name}`,
          message: `Duplicate data source name: ${source.name}`,
          code: 'duplicate_source'
        });
      }
      sourceNames.add(source.name);
    }
  }
  
  // Check that capability names are valid identifiers (PascalCase recommended)
  for (const entry of manifest.capabilities) {
    for (const name of Object.keys(entry)) {
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        errors.push({
          path: `capabilities.${name}`,
          message: `Capability name should be PascalCase: ${name}`,
          code: 'naming_convention'
        });
      }
    }
  }
  
  // Check MFE name is kebab-case
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
    errors.push({
      path: 'name',
      message: 'MFE name should be kebab-case (e.g., my-remote)',
      code: 'naming_convention'
    });
  }
  
  // ADR-027: Validate performance configuration (plugins vs transforms)
  errors.push(...validatePerformanceConfig(manifest));
  
  // ADR-027: Validate transforms array (ensure no plugins are misclassified)
  errors.push(...validateTransformsConfig(manifest));
  
  return errors;
}

/**
 * Full validation: schema + semantics
 * 
 * @param data - Raw data to validate
 * @returns Validation result
 */
export function validateFull(data: unknown): ValidationResult {
  // First validate schema
  const schemaResult = validateManifest(data);
  
  if (!schemaResult.valid || !schemaResult.manifest) {
    return schemaResult;
  }
  
  // Then validate semantics
  const semanticErrors = validateSemantics(schemaResult.manifest);
  
  if (semanticErrors.length > 0) {
    return {
      valid: false,
      errors: semanticErrors,
      manifest: schemaResult.manifest  // Include manifest even with semantic errors
    };
  }
  
  return schemaResult;
}

// =============================================================================
// CLI Error Formatting
// =============================================================================

/**
 * Format validation errors for CLI output
 * 
 * @param errors - Validation errors
 * @returns Formatted string for terminal output
 */
export function formatErrorsForCLI(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }
  
  const lines: string[] = ['Validation errors:'];
  
  for (const error of errors) {
    const path = error.path ? `  ${error.path}: ` : '  ';
    lines.push(`${path}${error.message}`);
  }
  
  return lines.join('\n');
}

/**
 * Get a single-line summary of validation errors
 * 
 * @param errors - Validation errors
 * @returns Summary string
 */
export function getErrorSummary(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'Valid';
  }
  
  if (errors.length === 1) {
    return errors[0].message;
  }
  
  return `${errors.length} validation errors`;
}

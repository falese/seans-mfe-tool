/**
 * DSL Validator using Zod
 * Following ADR-048: Incremental TypeScript migration
 * Implements REQ-REMOTE-001: DSL validation
 */

import { ZodError } from 'zod';
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
 * Perform semantic validation beyond schema checks
 * 
 * @param manifest - Already schema-validated manifest
 * @returns Array of validation errors (empty if valid)
 */
export function validateSemantics(manifest: DSLManifest): ValidationError[] {
  const errors: ValidationError[] = [];
  
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

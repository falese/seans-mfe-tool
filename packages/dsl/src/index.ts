/**
 * DSL Module - Public API
 * Following ADR-014: Incremental TypeScript migration
 * 
 * This module provides parsing, validation, and generation for MFE DSL manifests.
 */

// Schema and types
export * from './schema';
export * from './types';

// Parser functions
export {
  parseYAML,
  parseManifestFile,
  findManifest,
  parseManifestFromDirectory,
  parseAndValidateFile,
  parseAndValidateDirectory,
  getCapabilityNames,
  getDomainCapabilities,
  hasDataLayer,
  serializeToYAML,
  writeManifest,
  createMinimalManifest,
  addCapability,
  generateEndpoints,
  MANIFEST_FILENAMES,
  WELL_KNOWN_PATH
} from './parser';

// Validator functions
export {
  validateManifest,
  validatePartialManifest,
  validateCapabilities,
  validateDataConfig,
  validateSemantics,
  validateFull,
  formatErrorsForCLI,
  getErrorSummary
} from './validator';
// NOTE: the generator (generateAllFiles / writeGeneratedFiles /
// extractManifestVars) is intentionally NOT re-exported here. It lives in
// @seans-mfe/codegen, which depends on this package for manifest types —
// re-exporting it would form a dsl -> codegen -> dsl cycle (ADR-061). Import
// generator functions from '@seans-mfe/codegen' directly.
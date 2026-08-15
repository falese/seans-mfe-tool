/**
 * DSL Module - Public API
 * Following ADR-014: Incremental TypeScript migration
 * 
 * This module provides parsing, validation, and generation for MFE DSL manifests.
 */

// Schema and types
export * from './schema';
export * from './types';
// Design-time slot checks (ADR-073): declared-but-unreferenced slots and
// registry placement targets. Pure functions; the CLI supplies the IO.
export * from './slot-validation';
// ADR library drift control (ADR-075): the frontmatter schema that makes the
// decision record machine-readable, and the rules that keep it from rotting.
// Same pure-core / thin-command split as the slot checks above.
export * from './adr-schema';
export * from './adr-validation';
// Control-plane composition (ADR-083): the project-scoped document a deploying
// project authors, and the compiler that turns it plus the fleet's manifests
// into the registry payload. Same pure-core / thin-command split again.
export * from './control-plane-schema';
export * from './control-plane-compiler';

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
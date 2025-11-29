/**
 * DSL Module - Public API
 * Following ADR-048: Incremental TypeScript migration
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

// Generator functions
// export {
//   generateCapabilityFiles,
//   generateAllCapabilityFiles,
//   writeGeneratedFiles,
//   getNewCapabilities,
//   getRemovedCapabilities,
//   generateSharedConfig,
//   generateRspackConfig
// } from './generator';

export {
  generateAllFiles,
  writeGeneratedFiles,
  extractManifestVars
} from './unified-generator';
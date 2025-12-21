/**
 * Codegen Module - Public API
 *
 * This module provides code generation for MFE applications.
 */

// Unified Generator
export {
  generateAllFiles,
  writeGeneratedFiles,
  extractManifestVars
} from './UnifiedGenerator/unified-generator';

// API Generator - export for create-api command
export { DatabaseGenerator } from './APIGenerator/DatabaseGenerator/DatabaseGenerator';
export { ControllerGenerator } from './APIGenerator/ControllerGenerator/ControllerGenerator';
export { generateRoutes } from './APIGenerator/RouteGenerator';

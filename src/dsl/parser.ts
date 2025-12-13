/**
 * DSL Parser
 * Following ADR-048: Incremental TypeScript migration
 * Implements REQ-REMOTE-001: DSL as single source of truth
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { DSLManifest, ValidationResult } from './schema';
import { validateManifest, validateFull } from './validator';

// =============================================================================
// Constants
// =============================================================================

/** Standard manifest filenames to search for */
export const MANIFEST_FILENAMES = [
  'mfe-manifest.yaml',
  'mfe-manifest.yml',
  '.mfe-manifest.yaml',
  '.mfe-manifest.yml'
] as const;

/** Well-known discovery path */
export const WELL_KNOWN_PATH = '.well-known/mfe-manifest.yaml';

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Parse a DSL manifest from a YAML string
 * 
 * @param content - YAML content string
 * @returns Parsed DSL manifest (unvalidated)
 * @throws Error if YAML parsing fails
 */
export function parseYAML(content: string): DSLManifest {
  try {
    const parsed = yaml.load(content);
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML: expected an object');
    }
    
    return parsed as DSLManifest;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`YAML parse error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Read and parse a DSL manifest from a file path
 * 
 * @param manifestPath - Path to the manifest file
 * @returns Parsed DSL manifest
 * @throws Error if file not found or parsing fails
 */
export async function parseManifestFile(manifestPath: string): Promise<DSLManifest> {
  const absolutePath = path.resolve(process.cwd(), manifestPath);
  
  if (!await fs.pathExists(absolutePath)) {
    throw new Error(`Manifest not found: ${absolutePath}`);
  }
  
  const content = await fs.readFile(absolutePath, 'utf8');
  return parseYAML(content);
}

/**
 * Find manifest file in a directory by searching common filenames
 * 
 * @param directory - Directory to search in
 * @returns Path to found manifest, or null if not found
 */
export async function findManifest(directory: string): Promise<string | null> {
  const absoluteDir = path.resolve(process.cwd(), directory);
  
  // Check each standard filename
  for (const filename of MANIFEST_FILENAMES) {
    const manifestPath = path.join(absoluteDir, filename);
    if (await fs.pathExists(manifestPath)) {
      return manifestPath;
    }
  }
  
  // Check well-known path
  const wellKnownPath = path.join(absoluteDir, WELL_KNOWN_PATH);
  if (await fs.pathExists(wellKnownPath)) {
    return wellKnownPath;
  }
  
  return null;
}

/**
 * Parse manifest from a directory (auto-detects filename)
 * 
 * @param directory - Directory containing the manifest
 * @returns Parsed DSL manifest and its path
 * @throws Error if no manifest found or parsing fails
 */
export async function parseManifestFromDirectory(directory: string): Promise<{
  manifest: DSLManifest;
  manifestPath: string;
}> {
  const manifestPath = await findManifest(directory);
  
  if (!manifestPath) {
    throw new Error(
      `No manifest found in ${directory}. ` +
      `Expected one of: ${MANIFEST_FILENAMES.join(', ')}`
    );
  }
  
  const manifest = await parseManifestFile(manifestPath);
  return { manifest, manifestPath };
}

/**
 * Parse and validate manifest from file
 * 
 * @param manifestPath - Path to manifest file
 * @returns Validation result with manifest if valid
 */
export async function parseAndValidateFile(manifestPath: string): Promise<ValidationResult> {
  const absolutePath = path.resolve(process.cwd(), manifestPath);
  
  if (!await fs.pathExists(absolutePath)) {
    return {
      valid: false,
      errors: [{ path: '', message: `Manifest not found: ${absolutePath}` }]
    };
  }
  
  try {
    const content = await fs.readFile(absolutePath, 'utf8');
    const parsed = yaml.load(content);
    return validateFull(parsed);
  } catch (error) {
    return {
      valid: false,
      errors: [{ path: '', message: (error as Error).message }]
    };
  }
}

/**
 * Parse and validate manifest from directory
 * 
 * @param directory - Directory containing manifest
 * @returns Validation result with manifest path
 */
export async function parseAndValidateDirectory(directory: string): Promise<ValidationResult & { manifestPath?: string }> {
  const manifestPath = await findManifest(directory);
  
  if (!manifestPath) {
    return {
      valid: false,
      errors: [{ 
        path: '', 
        message: `No manifest found in ${directory}. Expected one of: ${MANIFEST_FILENAMES.join(', ')}`
      }]
    };
  }
  
  const result = await parseAndValidateFile(manifestPath);
  return { ...result, manifestPath };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract capability names from a manifest
 * 
 * @param manifest - Parsed DSL manifest
 * @returns Array of capability names
 */
export function getCapabilityNames(manifest: DSLManifest): string[] {
  if (!manifest.capabilities || !Array.isArray(manifest.capabilities)) {
    return [];
  }
  
  return manifest.capabilities.flatMap(entry => Object.keys(entry));
}

/**
 * Get domain capabilities only (excludes platform capabilities)
 * 
 * @param manifest - Parsed DSL manifest
 * @returns Array of domain capability names
 */
export function getDomainCapabilities(manifest: DSLManifest): string[] {
  if (!manifest.capabilities || !Array.isArray(manifest.capabilities)) {
    return [];
  }
  
  const domainCapabilities: string[] = [];
  
  for (const entry of manifest.capabilities) {
    for (const [name, config] of Object.entries(entry)) {
      if (config.type === 'domain') {
        domainCapabilities.push(name);
      }
    }
  }
  
  return domainCapabilities;
}

/**
 * Check if manifest has data section (needs BFF)
 * 
 * @param manifest - Parsed DSL manifest
 * @returns True if data section exists with sources
 */
export function hasDataLayer(manifest: DSLManifest): boolean {
  return !!(manifest.data?.sources && manifest.data.sources.length > 0);
}

/**
 * Serialize a DSL manifest to YAML
 * 
 * @param manifest - DSL manifest to serialize
 * @returns YAML string
 */
export function serializeToYAML(manifest: DSLManifest): string {
  return yaml.dump(manifest, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
}

/**
 * Write manifest to file
 * 
 * @param manifest - DSL manifest to write
 * @param filePath - Path to write to
 */
export async function writeManifest(manifest: DSLManifest, filePath: string): Promise<void> {
  const content = serializeToYAML(manifest);
  await fs.writeFile(filePath, content, 'utf8');
}

// =============================================================================
// Manifest Creation Helpers
// =============================================================================

/**
 * Create a minimal valid manifest for scaffolding
 * 
 * @param name - MFE name
 * @param options - Optional configuration
 * @returns Minimal DSL manifest
 */
export function createMinimalManifest(
  name: string,
  options: {
    type?: DSLManifest['type'];
    language?: DSLManifest['language'];
    description?: string;
  } = {}
): DSLManifest {
  return {
    name,
    version: '1.0.0',
    type: options.type || 'remote',
    language: options.language || 'typescript',
    description: options.description || '',
    capabilities: [],
    dependencies: {
      runtime: {
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      },
      'design-system': {
        '@mui/material': '^5.14.0'
      }
    }
  };
}

/**
 * Add a capability to a manifest
 * 
 * @param manifest - Manifest to modify
 * @param name - Capability name
 * @param config - Capability configuration
 * @returns Modified manifest (new object)
 */
export function addCapability(
  manifest: DSLManifest,
  name: string,
  config: { type: 'platform' | 'domain'; description?: string }
): DSLManifest {
  const newCapability = {
    [name]: {
      type: config.type,
      description: config.description || ''
    }
  };
  
  return {
    ...manifest,
    capabilities: [...manifest.capabilities, newCapability]
  };
}

/**
 * Generate endpoint URLs from name and port
 * 
 * @param name - MFE name
 * @param port - Port number
 * @returns Endpoint configuration
 */
export function generateEndpoints(
  name: string,
  port: number
): Pick<DSLManifest, 'endpoint' | 'remoteEntry' | 'discovery'> {
  const baseUrl = `http://localhost:${port}`;
  return {
    endpoint: baseUrl,
    remoteEntry: `${baseUrl}/remoteEntry.js`,
    discovery: `${baseUrl}/.well-known/mfe-manifest.yaml`
  };
}

/**
 * DSL Type Definitions
 * Following ADR-048: Incremental TypeScript migration
 * Reference: docs/dsl-schema-reference.md v3.2
 * 
 * Re-exports types from schema.ts (Zod-derived) for backward compatibility.
 * Import from './schema' for validation, from './types' for types only.
 */

// Re-export all types from schema (single source of truth)
export type {
  MFEType,
  Language,
  CapabilityType,
  DSLInput,
  DSLOutput,
  LifecycleHook,
  LifecycleHookEntry,
  Lifecycle,
  CapabilityConfig,
  CapabilityEntry,
  OpenAPIHandler,
  DataSource,
  DataTransform,
  DataPlugin,
  DataServe,
  DataLineage,
  DataConfig,
  Dependencies,
  DSLManifest,
  PartialDSLManifest,
  ValidationError,
  ValidationResult,
  GeneratedFile,
  GenerationResult,
  CapabilityScaffold,
  RemoteInitOptions,
  RemoteGenerateOptions
} from './schema';

// Re-export constants
export { PLATFORM_CAPABILITIES } from './schema';

// Additional type helpers not in Zod schema
export const VALID_MFE_TYPES = [
  'tool', 'agent', 'feature', 'service', 'remote', 'shell', 'bff'
] as const;

export const VALID_LANGUAGES = ['javascript', 'typescript'] as const;

export const VALID_CAPABILITY_TYPES = ['platform', 'domain'] as const;


/**
 * DSL Schema Definitions using Zod
 * Following ADR-048: Incremental TypeScript migration
 * Reference: docs/dsl-schema-reference.md v3.2
 * 
 * This file defines both validation schemas AND TypeScript types.
 * Types are inferred from Zod schemas - single source of truth.
 */

import { z } from 'zod';

// =============================================================================
// Enums and Constants
// =============================================================================

/** MFE type enumeration */
export const MFETypeSchema = z.enum([
  'tool', 'agent', 'feature', 'service', 'remote', 'shell', 'bff'
]);
export type MFEType = z.infer<typeof MFETypeSchema>;

/** Supported implementation languages */
export const LanguageSchema = z.enum([
  'javascript', 'typescript',   // JS/TS ecosystem (Module Federation, Node.js)
  'python',                      // Flask / FastAPI MFEs
  'go',                          // net/http MFEs
  'rust',                        // Tokio / axum MFEs
  'java'                         // Spring Boot MFEs
]);
export type Language = z.infer<typeof LanguageSchema>;

/** Capability type discrimination */
export const CapabilityTypeSchema = z.enum(['platform', 'domain']);
export type CapabilityType = z.infer<typeof CapabilityTypeSchema>;

/** Platform capabilities that all MFEs must implement */
export const PLATFORM_CAPABILITIES = [
  'load',
  'render', 
  'refresh',
  'authorizeAccess',
  'health',
  'describe',
  'schema',
  'query',
  'emit'
] as const;

// =============================================================================
// Input/Output Schemas
// =============================================================================

/** Input parameter definition */
export const DSLInputSchema = z.object({
  name: z.string(),
  type: z.string(),  // DSL type string (e.g., 'string!', 'array<User!>!')
  description: z.string().optional(),
  default: z.unknown().optional(),
  values: z.array(z.string()).optional(),  // For enum types
  formats: z.array(z.string()).optional()  // For file types
});
export type DSLInput = z.infer<typeof DSLInputSchema>;

/** Output definition */
export const DSLOutputSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional()
});
export type DSLOutput = z.infer<typeof DSLOutputSchema>;

// =============================================================================
// Lifecycle Schemas
// =============================================================================

/** Single lifecycle hook */
/** Platform wrapper methods forbidden as handler references */
export const PLATFORM_WRAPPER_METHODS = [
  'doLoad', 'doRender', 'doRefresh', 'doAuthorizeAccess', 'doHealth', 'doDescribe', 'doSchema', 'doQuery', 'doEmit'
];

export const LifecycleHookSchema = z.object({
  handler: z.union([z.string(), z.array(z.string())]),
  description: z.string().optional(),
  mandatory: z.boolean().optional(),
  contained: z.boolean().optional()
}).refine(
  (hook) => {
    const forbidden = PLATFORM_WRAPPER_METHODS;
    if (typeof hook.handler === 'string') {
      return !forbidden.includes(hook.handler);
    }
    if (Array.isArray(hook.handler)) {
      return hook.handler.every(h => !forbidden.includes(h));
    }
    return true;
  },
  {
    message: `Handler must not reference platform wrapper methods (${PLATFORM_WRAPPER_METHODS.join(', ')})`,
    path: ['handler']
  }
);
export type LifecycleHook = z.infer<typeof LifecycleHookSchema>;

/** Lifecycle hook entry (name → config) */
export const LifecycleHookEntrySchema = z.record(z.string(), LifecycleHookSchema);
export type LifecycleHookEntry = z.infer<typeof LifecycleHookEntrySchema>;

/** Lifecycle configuration for a capability */
export const LifecycleSchema = z.object({
  before: z.array(LifecycleHookEntrySchema).optional(),
  main: z.array(LifecycleHookEntrySchema).optional(),
  after: z.array(LifecycleHookEntrySchema).optional(),
  error: z.array(LifecycleHookEntrySchema).optional()
});
export type Lifecycle = z.infer<typeof LifecycleSchema>;

// =============================================================================
// Capability Schemas
// =============================================================================

/** Capability configuration */
export const CapabilityConfigSchema = z.object({
  type: CapabilityTypeSchema,
  description: z.string().optional(),
  handler: z.string().optional(),
  inputs: z.array(DSLInputSchema).optional(),
  outputs: z.array(DSLOutputSchema).optional(),
  lifecycle: LifecycleSchema.optional(),
  authorization: z.string().optional()  // Deferred - ADR-041
});
export type CapabilityConfig = z.infer<typeof CapabilityConfigSchema>;

/** Capability entry (name → config) */
export const CapabilityEntrySchema = z.record(z.string(), CapabilityConfigSchema);
export type CapabilityEntry = z.infer<typeof CapabilityEntrySchema>;

// =============================================================================
// Data Layer Schemas (GraphQL BFF - ADR-046)
// =============================================================================

/** OpenAPI handler configuration */
export const OpenAPIHandlerSchema = z.object({
  source: z.string(),
  operationHeaders: z.record(z.string(), z.string()).optional()
});
export type OpenAPIHandler = z.infer<typeof OpenAPIHandlerSchema>;

/** Mesh source configuration */
export const DataSourceSchema = z.object({
  name: z.string(),
  handler: z.object({
    openapi: OpenAPIHandlerSchema
  }),
  transforms: z.array(z.record(z.string(), z.unknown())).optional()
});
export type DataSource = z.infer<typeof DataSourceSchema>;

/** Mesh transform - flexible schema with validation */
export const DataTransformSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  const transformNames = Object.keys(val);
  
  for (const name of transformNames) {
    // Check if this looks like a plugin that was put in transforms
    if (KNOWN_PLUGINS.includes(name as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${name}" is a plugin, not a transform. Move it to the plugins section.`,
        path: [name]
      });
    }
  }
});
export type DataTransform = z.infer<typeof DataTransformSchema>;

/** Known Mesh plugin names (validation list) */
const KNOWN_PLUGINS = [
  'prometheus',
  'useMaskedErrors',
  'useResponseCache',
  'usePersistedOperations',
  'newrelic',
  'datadog',
  'statsd',
  'mock',
  'snapshot'
] as const;

/** Known Mesh transform names (validation list) */
const KNOWN_TRANSFORMS = [
  'filterSchema',
  'rateLimit',
  'rename',
  'prefix',
  'encapsulate',
  'federation',
  'namingConvention',
  'cache',
  'snapshot',
  'mock',
  'resolversComposition',
  'type-merging'
] as const;

/** Mesh plugin - flexible schema with validation */
export const DataPluginSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  const pluginNames = Object.keys(val);
  
  for (const name of pluginNames) {
    // Check if this looks like a transform that was put in plugins
    if (KNOWN_TRANSFORMS.includes(name as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${name}" is a transform, not a plugin. Move it to the transforms section.`,
        path: [name]
      });
    }
  }
});
export type DataPlugin = z.infer<typeof DataPluginSchema>;

/** Serve configuration */
export const DataServeSchema = z.object({
  endpoint: z.string(),
  playground: z.boolean()
});
export type DataServe = z.infer<typeof DataServeSchema>;

/** Data lineage tracking */
export const DataLineageSchema = z.object({
  openapi: z.string().optional(),
  service: z.string().optional(),
  version: z.string().optional()
});
export type DataLineage = z.infer<typeof DataLineageSchema>;

/** Data section configuration (maps to GraphQL Mesh) */
export const DataConfigSchema = z.object({
  sources: z.array(DataSourceSchema),
  transforms: z.array(DataTransformSchema).optional(),
  plugins: z.array(DataPluginSchema).optional(),
  serve: DataServeSchema.optional(),
  generatedFrom: z.array(DataLineageSchema).optional()
});
export type DataConfig = z.infer<typeof DataConfigSchema>;

// =============================================================================
// Performance & Observability Schemas (ADR-062)
// =============================================================================

/** Caching configuration */
export const CachingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().default(300000), // 5 minutes
  strategies: z
    .array(
      z.object({
        type: z.string(),
        field: z.string(),
        ttl: z.number(),
      })
    )
    .optional(),
});
export type CachingConfig = z.infer<typeof CachingConfigSchema>;

/** Prometheus observability configuration */
export const PrometheusConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().default(9090),
  endpoint: z.string().default('/metrics'),
});
export type PrometheusConfig = z.infer<typeof PrometheusConfigSchema>;

/** OpenTelemetry observability configuration */
export const OpenTelemetryConfigSchema = z.object({
  enabled: z.boolean().default(false),
  serviceName: z.string().optional(),
  sampling: z
    .object({
      probability: z.number().min(0).max(1).default(0.1),
    })
    .optional(),
  exporters: z
    .array(
      z.object({
        type: z.string(),
        endpoint: z.string(),
      })
    )
    .optional(),
});
export type OpenTelemetryConfig = z.infer<typeof OpenTelemetryConfigSchema>;

/** Observability configuration */
export const ObservabilityConfigSchema = z.object({
  prometheus: PrometheusConfigSchema.optional(),
  opentelemetry: OpenTelemetryConfigSchema.optional(),
});
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;

/** Rate limiting configuration */
export const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(false),
  config: z
    .array(
      z.object({
        type: z.string(), // Query, Mutation
        field: z.string(), // Field name or "*"
        max: z.number(), // Max requests
        ttl: z.number(), // Time window (ms)
        identifyContext: z.string().optional(), // Context field for per-user limits
      })
    )
    .optional(),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/** Filter schema configuration */
export const FilterSchemaConfigSchema = z.object({
  enabled: z.boolean().default(false),
  filters: z.array(z.string()).optional(),
});
export type FilterSchemaConfig = z.infer<typeof FilterSchemaConfigSchema>;

/** Performance configuration */
export const PerformanceConfigSchema = z.object({
  caching: CachingConfigSchema.optional(),
  observability: ObservabilityConfigSchema.optional(),
  rateLimit: RateLimitConfigSchema.optional(),
  filterSchema: FilterSchemaConfigSchema.optional(),
});
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;

/** Custom transform configuration (resolvers composition) */
export const CustomTransformSchema = z.string(); // YAML string for resolver composition
export type CustomTransform = z.infer<typeof CustomTransformSchema>;

// =============================================================================
// Dependencies Schemas
// =============================================================================

/** Dependencies section */
export const DependenciesSchema = z.object({
  runtime: z.record(z.string(), z.string()).optional(),
  'design-system': z.record(z.string(), z.string()).optional(),
  mfes: z.record(z.string(), z.string()).optional()
});
export type Dependencies = z.infer<typeof DependenciesSchema>;

// =============================================================================
// Main DSL Schema
// =============================================================================

/** Complete MFE DSL manifest */
export const DSLManifestSchema = z.object({
  // Core identity (required)
  name: z.string().min(1, 'Name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Version must be semver (e.g., 1.0.0)'),
  type: MFETypeSchema,
  language: LanguageSchema,
  
  // Optional identity
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  
  // Endpoints (required for runtime, generated for new projects)
  endpoint: z.string().url().optional(),
  remoteEntry: z.string().url().optional(),
  discovery: z.string().url().optional(),
  
  // Core sections
  capabilities: z.array(CapabilityEntrySchema),
  dependencies: DependenciesSchema.optional(),
  data: DataConfigSchema.optional(),
  
  // Performance & observability config (ADR-062)
  performance: PerformanceConfigSchema.optional(),
  transforms: z.array(CustomTransformSchema).optional(),
  
  // Future sections (deferred)
  authorization: z.unknown().optional()  // ADR-041
});
export type DSLManifest = z.infer<typeof DSLManifestSchema>;

// =============================================================================
// Partial Schemas (for scaffolding)
// =============================================================================

/** Partial manifest for scaffolding (relaxed validation) */
export const PartialDSLManifestSchema = DSLManifestSchema.partial().extend({
  name: z.string().min(1),  // Name always required
});
export type PartialDSLManifest = z.infer<typeof PartialDSLManifestSchema>;

// =============================================================================
// Validation Result Types
// =============================================================================

/** Validation error */
export interface ValidationError {
  path: string;
  message: string;
  code?: string;
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  manifest?: DSLManifest;
}

// =============================================================================
// Generation Types (not Zod - plain TS)
// =============================================================================

/** File to generate */
export interface GeneratedFile {
  path: string;
  content: string;
  overwrite: boolean;
}

/** Generation result */
export interface GenerationResult {
  files: GeneratedFile[];
  skipped: string[];
  errors: string[];
}

/** Capability scaffold request */
export interface CapabilityScaffold {
  name: string;
  config: CapabilityConfig;
  basePath: string;
}

// =============================================================================
// Command Options Types
// =============================================================================

/** remote:init command options */
export interface RemoteInitOptions {
  port?: number;
  template?: string;
  skipInstall?: boolean;
  force?: boolean;
}

/** remote:generate command options */
export interface RemoteGenerateOptions {
  dryRun?: boolean;
  force?: boolean;
  capability?: string;  // Generate specific capability only
}

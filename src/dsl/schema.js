"use strict";
/**
 * DSL Schema Definitions using Zod
 * Following ADR-048: Incremental TypeScript migration
 * Reference: docs/dsl-schema-reference.md v3.2
 *
 * This file defines both validation schemas AND TypeScript types.
 * Types are inferred from Zod schemas - single source of truth.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartialDSLManifestSchema = exports.DSLManifestSchema = exports.DependenciesSchema = exports.CustomTransformSchema = exports.PerformanceConfigSchema = exports.FilterSchemaConfigSchema = exports.RateLimitConfigSchema = exports.ObservabilityConfigSchema = exports.OpenTelemetryConfigSchema = exports.PrometheusConfigSchema = exports.CachingConfigSchema = exports.DataConfigSchema = exports.DataLineageSchema = exports.DataServeSchema = exports.DataPluginSchema = exports.DataTransformSchema = exports.DataSourceSchema = exports.OpenAPIHandlerSchema = exports.CapabilityEntrySchema = exports.CapabilityConfigSchema = exports.LifecycleSchema = exports.LifecycleHookEntrySchema = exports.LifecycleHookSchema = exports.PLATFORM_WRAPPER_METHODS = exports.DSLOutputSchema = exports.DSLInputSchema = exports.PLATFORM_CAPABILITIES = exports.CapabilityTypeSchema = exports.LanguageSchema = exports.MFETypeSchema = void 0;
const zod_1 = require("zod");
// =============================================================================
// Enums and Constants
// =============================================================================
/** MFE type enumeration */
exports.MFETypeSchema = zod_1.z.enum([
    'tool', 'agent', 'feature', 'service', 'remote', 'shell', 'bff'
]);
/** Supported implementation languages */
exports.LanguageSchema = zod_1.z.enum(['javascript', 'typescript']);
/** Capability type discrimination */
exports.CapabilityTypeSchema = zod_1.z.enum(['platform', 'domain']);
/** Platform capabilities that all MFEs must implement */
exports.PLATFORM_CAPABILITIES = [
    'load',
    'render',
    'refresh',
    'authorizeAccess',
    'health',
    'describe',
    'schema',
    'query',
    'emit'
];
// =============================================================================
// Input/Output Schemas
// =============================================================================
/** Input parameter definition */
exports.DSLInputSchema = zod_1.z.object({
    name: zod_1.z.string(),
    type: zod_1.z.string(), // DSL type string (e.g., 'string!', 'array<User!>!')
    description: zod_1.z.string().optional(),
    default: zod_1.z.unknown().optional(),
    values: zod_1.z.array(zod_1.z.string()).optional(), // For enum types
    formats: zod_1.z.array(zod_1.z.string()).optional() // For file types
});
/** Output definition */
exports.DSLOutputSchema = zod_1.z.object({
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    description: zod_1.z.string().optional()
});
// =============================================================================
// Lifecycle Schemas
// =============================================================================
/** Single lifecycle hook */
/** Platform wrapper methods forbidden as handler references */
exports.PLATFORM_WRAPPER_METHODS = [
    'doLoad', 'doRender', 'doRefresh', 'doAuthorizeAccess', 'doHealth', 'doDescribe', 'doSchema', 'doQuery', 'doEmit'
];
exports.LifecycleHookSchema = zod_1.z.object({
    handler: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]),
    description: zod_1.z.string().optional(),
    mandatory: zod_1.z.boolean().optional(),
    contained: zod_1.z.boolean().optional()
}).refine((hook) => {
    const forbidden = exports.PLATFORM_WRAPPER_METHODS;
    if (typeof hook.handler === 'string') {
        return !forbidden.includes(hook.handler);
    }
    if (Array.isArray(hook.handler)) {
        return hook.handler.every(h => !forbidden.includes(h));
    }
    return true;
}, {
    message: `Handler must not reference platform wrapper methods (${exports.PLATFORM_WRAPPER_METHODS.join(', ')})`,
    path: ['handler']
});
/** Lifecycle hook entry (name → config) */
exports.LifecycleHookEntrySchema = zod_1.z.record(zod_1.z.string(), exports.LifecycleHookSchema);
/** Lifecycle configuration for a capability */
exports.LifecycleSchema = zod_1.z.object({
    before: zod_1.z.array(exports.LifecycleHookEntrySchema).optional(),
    main: zod_1.z.array(exports.LifecycleHookEntrySchema).optional(),
    after: zod_1.z.array(exports.LifecycleHookEntrySchema).optional(),
    error: zod_1.z.array(exports.LifecycleHookEntrySchema).optional()
});
// =============================================================================
// Capability Schemas
// =============================================================================
/** Capability configuration */
exports.CapabilityConfigSchema = zod_1.z.object({
    type: exports.CapabilityTypeSchema,
    description: zod_1.z.string().optional(),
    handler: zod_1.z.string().optional(),
    inputs: zod_1.z.array(exports.DSLInputSchema).optional(),
    outputs: zod_1.z.array(exports.DSLOutputSchema).optional(),
    lifecycle: exports.LifecycleSchema.optional(),
    authorization: zod_1.z.string().optional() // Deferred - ADR-041
});
/** Capability entry (name → config) */
exports.CapabilityEntrySchema = zod_1.z.record(zod_1.z.string(), exports.CapabilityConfigSchema);
// =============================================================================
// Data Layer Schemas (GraphQL BFF - ADR-046)
// =============================================================================
/** OpenAPI handler configuration */
exports.OpenAPIHandlerSchema = zod_1.z.object({
    source: zod_1.z.string(),
    operationHeaders: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional()
});
/** Mesh source configuration */
exports.DataSourceSchema = zod_1.z.object({
    name: zod_1.z.string(),
    handler: zod_1.z.object({
        openapi: exports.OpenAPIHandlerSchema
    }),
    transforms: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())).optional()
});
/** Mesh transform - flexible schema with validation */
exports.DataTransformSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).superRefine((val, ctx) => {
    const transformNames = Object.keys(val);
    for (const name of transformNames) {
        // Check if this looks like a plugin that was put in transforms
        if (KNOWN_PLUGINS.includes(name)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `"${name}" is a plugin, not a transform. Move it to the plugins section.`,
                path: [name]
            });
        }
    }
});
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
];
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
];
/** Mesh plugin - flexible schema with validation */
exports.DataPluginSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).superRefine((val, ctx) => {
    const pluginNames = Object.keys(val);
    for (const name of pluginNames) {
        // Check if this looks like a transform that was put in plugins
        if (KNOWN_TRANSFORMS.includes(name)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `"${name}" is a transform, not a plugin. Move it to the transforms section.`,
                path: [name]
            });
        }
    }
});
/** Serve configuration */
exports.DataServeSchema = zod_1.z.object({
    endpoint: zod_1.z.string(),
    playground: zod_1.z.boolean()
});
/** Data lineage tracking */
exports.DataLineageSchema = zod_1.z.object({
    openapi: zod_1.z.string().optional(),
    service: zod_1.z.string().optional(),
    version: zod_1.z.string().optional()
});
/** Data section configuration (maps to GraphQL Mesh) */
exports.DataConfigSchema = zod_1.z.object({
    sources: zod_1.z.array(exports.DataSourceSchema),
    transforms: zod_1.z.array(exports.DataTransformSchema).optional(),
    plugins: zod_1.z.array(exports.DataPluginSchema).optional(),
    serve: exports.DataServeSchema.optional(),
    generatedFrom: zod_1.z.array(exports.DataLineageSchema).optional()
});
// =============================================================================
// Performance & Observability Schemas (ADR-062)
// =============================================================================
/** Caching configuration */
exports.CachingConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    ttl: zod_1.z.number().default(300000), // 5 minutes
    strategies: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.string(),
        field: zod_1.z.string(),
        ttl: zod_1.z.number(),
    }))
        .optional(),
});
/** Prometheus observability configuration */
exports.PrometheusConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    port: zod_1.z.number().default(9090),
    endpoint: zod_1.z.string().default('/metrics'),
});
/** OpenTelemetry observability configuration */
exports.OpenTelemetryConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    serviceName: zod_1.z.string().optional(),
    sampling: zod_1.z
        .object({
        probability: zod_1.z.number().min(0).max(1).default(0.1),
    })
        .optional(),
    exporters: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.string(),
        endpoint: zod_1.z.string(),
    }))
        .optional(),
});
/** Observability configuration */
exports.ObservabilityConfigSchema = zod_1.z.object({
    prometheus: exports.PrometheusConfigSchema.optional(),
    opentelemetry: exports.OpenTelemetryConfigSchema.optional(),
});
/** Rate limiting configuration */
exports.RateLimitConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    config: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.string(), // Query, Mutation
        field: zod_1.z.string(), // Field name or "*"
        max: zod_1.z.number(), // Max requests
        ttl: zod_1.z.number(), // Time window (ms)
        identifyContext: zod_1.z.string().optional(), // Context field for per-user limits
    }))
        .optional(),
});
/** Filter schema configuration */
exports.FilterSchemaConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    filters: zod_1.z.array(zod_1.z.string()).optional(),
});
/** Performance configuration */
exports.PerformanceConfigSchema = zod_1.z.object({
    caching: exports.CachingConfigSchema.optional(),
    observability: exports.ObservabilityConfigSchema.optional(),
    rateLimit: exports.RateLimitConfigSchema.optional(),
    filterSchema: exports.FilterSchemaConfigSchema.optional(),
});
/** Custom transform configuration (resolvers composition) */
exports.CustomTransformSchema = zod_1.z.string(); // YAML string for resolver composition
// =============================================================================
// Dependencies Schemas
// =============================================================================
/** Dependencies section */
exports.DependenciesSchema = zod_1.z.object({
    runtime: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    'design-system': zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    mfes: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional()
});
// =============================================================================
// Main DSL Schema
// =============================================================================
/** Complete MFE DSL manifest */
exports.DSLManifestSchema = zod_1.z.object({
    // Core identity (required)
    name: zod_1.z.string().min(1, 'Name is required'),
    version: zod_1.z.string().regex(/^\d+\.\d+\.\d+/, 'Version must be semver (e.g., 1.0.0)'),
    type: exports.MFETypeSchema,
    language: exports.LanguageSchema,
    // Optional identity
    description: zod_1.z.string().optional(),
    owner: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    category: zod_1.z.string().optional(),
    // Endpoints (required for runtime, generated for new projects)
    endpoint: zod_1.z.string().url().optional(),
    remoteEntry: zod_1.z.string().url().optional(),
    discovery: zod_1.z.string().url().optional(),
    // Core sections
    capabilities: zod_1.z.array(exports.CapabilityEntrySchema),
    dependencies: exports.DependenciesSchema.optional(),
    data: exports.DataConfigSchema.optional(),
    // Performance & observability config (ADR-062)
    performance: exports.PerformanceConfigSchema.optional(),
    transforms: zod_1.z.array(exports.CustomTransformSchema).optional(),
    // Future sections (deferred)
    authorization: zod_1.z.unknown().optional() // ADR-041
});
// =============================================================================
// Partial Schemas (for scaffolding)
// =============================================================================
/** Partial manifest for scaffolding (relaxed validation) */
exports.PartialDSLManifestSchema = exports.DSLManifestSchema.partial().extend({
    name: zod_1.z.string().min(1), // Name always required
});
//# sourceMappingURL=schema.js.map
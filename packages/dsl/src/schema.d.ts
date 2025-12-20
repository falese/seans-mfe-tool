/**
 * DSL Schema Definitions using Zod
 * Following ADR-048: Incremental TypeScript migration
 * Reference: docs/dsl-schema-reference.md v3.2
 *
 * This file defines both validation schemas AND TypeScript types.
 * Types are inferred from Zod schemas - single source of truth.
 */
import { z } from 'zod';
/** MFE type enumeration */
export declare const MFETypeSchema: z.ZodEnum<{
    tool: "tool";
    agent: "agent";
    feature: "feature";
    service: "service";
    remote: "remote";
    shell: "shell";
    bff: "bff";
}>;
export type MFEType = z.infer<typeof MFETypeSchema>;
/** Supported implementation languages */
export declare const LanguageSchema: z.ZodEnum<{
    javascript: "javascript";
    typescript: "typescript";
}>;
export type Language = z.infer<typeof LanguageSchema>;
/** Capability type discrimination */
export declare const CapabilityTypeSchema: z.ZodEnum<{
    platform: "platform";
    domain: "domain";
}>;
export type CapabilityType = z.infer<typeof CapabilityTypeSchema>;
/** Platform capabilities that all MFEs must implement */
export declare const PLATFORM_CAPABILITIES: readonly ["load", "render", "refresh", "authorizeAccess", "health", "describe", "schema", "query", "emit"];
/** Input parameter definition */
export declare const DSLInputSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodUnknown>;
    values: z.ZodOptional<z.ZodArray<z.ZodString>>;
    formats: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type DSLInput = z.infer<typeof DSLInputSchema>;
/** Output definition */
export declare const DSLOutputSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DSLOutput = z.infer<typeof DSLOutputSchema>;
/** Single lifecycle hook */
/** Platform wrapper methods forbidden as handler references */
export declare const PLATFORM_WRAPPER_METHODS: string[];
export declare const LifecycleHookSchema: z.ZodObject<{
    handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    description: z.ZodOptional<z.ZodString>;
    mandatory: z.ZodOptional<z.ZodBoolean>;
    contained: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type LifecycleHook = z.infer<typeof LifecycleHookSchema>;
/** Lifecycle hook entry (name → config) */
export declare const LifecycleHookEntrySchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    description: z.ZodOptional<z.ZodString>;
    mandatory: z.ZodOptional<z.ZodBoolean>;
    contained: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>>;
export type LifecycleHookEntry = z.infer<typeof LifecycleHookEntrySchema>;
/** Lifecycle configuration for a capability */
export declare const LifecycleSchema: z.ZodObject<{
    before: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
        handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
        description: z.ZodOptional<z.ZodString>;
        mandatory: z.ZodOptional<z.ZodBoolean>;
        contained: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>>;
    main: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
        handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
        description: z.ZodOptional<z.ZodString>;
        mandatory: z.ZodOptional<z.ZodBoolean>;
        contained: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>>;
    after: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
        handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
        description: z.ZodOptional<z.ZodString>;
        mandatory: z.ZodOptional<z.ZodBoolean>;
        contained: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>>;
    error: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
        handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
        description: z.ZodOptional<z.ZodString>;
        mandatory: z.ZodOptional<z.ZodBoolean>;
        contained: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type Lifecycle = z.infer<typeof LifecycleSchema>;
/** Capability configuration */
export declare const CapabilityConfigSchema: z.ZodObject<{
    type: z.ZodEnum<{
        platform: "platform";
        domain: "domain";
    }>;
    description: z.ZodOptional<z.ZodString>;
    handler: z.ZodOptional<z.ZodString>;
    inputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodUnknown>;
        values: z.ZodOptional<z.ZodArray<z.ZodString>>;
        formats: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    outputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    lifecycle: z.ZodOptional<z.ZodObject<{
        before: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
        main: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
        after: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
        error: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
    }, z.core.$strip>>;
    authorization: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CapabilityConfig = z.infer<typeof CapabilityConfigSchema>;
/** Capability entry (name → config) */
export declare const CapabilityEntrySchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    type: z.ZodEnum<{
        platform: "platform";
        domain: "domain";
    }>;
    description: z.ZodOptional<z.ZodString>;
    handler: z.ZodOptional<z.ZodString>;
    inputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodUnknown>;
        values: z.ZodOptional<z.ZodArray<z.ZodString>>;
        formats: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    outputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    lifecycle: z.ZodOptional<z.ZodObject<{
        before: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
        main: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
        after: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
        error: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
            handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
            description: z.ZodOptional<z.ZodString>;
            mandatory: z.ZodOptional<z.ZodBoolean>;
            contained: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>>>;
    }, z.core.$strip>>;
    authorization: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export type CapabilityEntry = z.infer<typeof CapabilityEntrySchema>;
/** OpenAPI handler configuration */
export declare const OpenAPIHandlerSchema: z.ZodObject<{
    source: z.ZodString;
    operationHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type OpenAPIHandler = z.infer<typeof OpenAPIHandlerSchema>;
/** Mesh source configuration */
export declare const DataSourceSchema: z.ZodObject<{
    name: z.ZodString;
    handler: z.ZodObject<{
        openapi: z.ZodObject<{
            source: z.ZodString;
            operationHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    transforms: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export type DataSource = z.infer<typeof DataSourceSchema>;
/** Mesh transform - flexible schema with validation */
export declare const DataTransformSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type DataTransform = z.infer<typeof DataTransformSchema>;
/** Mesh plugin - flexible schema with validation */
export declare const DataPluginSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type DataPlugin = z.infer<typeof DataPluginSchema>;
/** Serve configuration */
export declare const DataServeSchema: z.ZodObject<{
    endpoint: z.ZodString;
    playground: z.ZodBoolean;
}, z.core.$strip>;
export type DataServe = z.infer<typeof DataServeSchema>;
/** Data lineage tracking */
export declare const DataLineageSchema: z.ZodObject<{
    openapi: z.ZodOptional<z.ZodString>;
    service: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DataLineage = z.infer<typeof DataLineageSchema>;
/** Data section configuration (maps to GraphQL Mesh) */
export declare const DataConfigSchema: z.ZodObject<{
    sources: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        handler: z.ZodObject<{
            openapi: z.ZodObject<{
                source: z.ZodString;
                operationHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, z.core.$strip>;
        }, z.core.$strip>;
        transforms: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>>;
    transforms: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    plugins: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    serve: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodString;
        playground: z.ZodBoolean;
    }, z.core.$strip>>;
    generatedFrom: z.ZodOptional<z.ZodArray<z.ZodObject<{
        openapi: z.ZodOptional<z.ZodString>;
        service: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type DataConfig = z.infer<typeof DataConfigSchema>;
/** Caching configuration */
export declare const CachingConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    ttl: z.ZodDefault<z.ZodNumber>;
    strategies: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        field: z.ZodString;
        ttl: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type CachingConfig = z.infer<typeof CachingConfigSchema>;
/** Prometheus observability configuration */
export declare const PrometheusConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    port: z.ZodDefault<z.ZodNumber>;
    endpoint: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PrometheusConfig = z.infer<typeof PrometheusConfigSchema>;
/** OpenTelemetry observability configuration */
export declare const OpenTelemetryConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    serviceName: z.ZodOptional<z.ZodString>;
    sampling: z.ZodOptional<z.ZodObject<{
        probability: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    exporters: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        endpoint: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type OpenTelemetryConfig = z.infer<typeof OpenTelemetryConfigSchema>;
/** Observability configuration */
export declare const ObservabilityConfigSchema: z.ZodObject<{
    prometheus: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        port: z.ZodDefault<z.ZodNumber>;
        endpoint: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    opentelemetry: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        serviceName: z.ZodOptional<z.ZodString>;
        sampling: z.ZodOptional<z.ZodObject<{
            probability: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        exporters: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            endpoint: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
/** Rate limiting configuration */
export declare const RateLimitConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    config: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        field: z.ZodString;
        max: z.ZodNumber;
        ttl: z.ZodNumber;
        identifyContext: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
/** Filter schema configuration */
export declare const FilterSchemaConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    filters: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type FilterSchemaConfig = z.infer<typeof FilterSchemaConfigSchema>;
/** Performance configuration */
export declare const PerformanceConfigSchema: z.ZodObject<{
    caching: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        ttl: z.ZodDefault<z.ZodNumber>;
        strategies: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            field: z.ZodString;
            ttl: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    observability: z.ZodOptional<z.ZodObject<{
        prometheus: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            port: z.ZodDefault<z.ZodNumber>;
            endpoint: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        opentelemetry: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            serviceName: z.ZodOptional<z.ZodString>;
            sampling: z.ZodOptional<z.ZodObject<{
                probability: z.ZodDefault<z.ZodNumber>;
            }, z.core.$strip>>;
            exporters: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                endpoint: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    rateLimit: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        config: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            field: z.ZodString;
            max: z.ZodNumber;
            ttl: z.ZodNumber;
            identifyContext: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    filterSchema: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        filters: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
/** Custom transform configuration (resolvers composition) */
export declare const CustomTransformSchema: z.ZodString;
export type CustomTransform = z.infer<typeof CustomTransformSchema>;
/** Dependencies section */
export declare const DependenciesSchema: z.ZodObject<{
    runtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    'design-system': z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    mfes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type Dependencies = z.infer<typeof DependenciesSchema>;
/** Complete MFE DSL manifest */
export declare const DSLManifestSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    type: z.ZodEnum<{
        tool: "tool";
        agent: "agent";
        feature: "feature";
        service: "service";
        remote: "remote";
        shell: "shell";
        bff: "bff";
    }>;
    language: z.ZodEnum<{
        javascript: "javascript";
        typescript: "typescript";
    }>;
    description: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    category: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
    remoteEntry: z.ZodOptional<z.ZodString>;
    discovery: z.ZodOptional<z.ZodString>;
    capabilities: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<{
            platform: "platform";
            domain: "domain";
        }>;
        description: z.ZodOptional<z.ZodString>;
        handler: z.ZodOptional<z.ZodString>;
        inputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodUnknown>;
            values: z.ZodOptional<z.ZodArray<z.ZodString>>;
            formats: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
        outputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        lifecycle: z.ZodOptional<z.ZodObject<{
            before: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
            main: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
            after: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
            error: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
        }, z.core.$strip>>;
        authorization: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    dependencies: z.ZodOptional<z.ZodObject<{
        runtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        'design-system': z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        mfes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
    data: z.ZodOptional<z.ZodObject<{
        sources: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            handler: z.ZodObject<{
                openapi: z.ZodObject<{
                    source: z.ZodString;
                    operationHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                }, z.core.$strip>;
            }, z.core.$strip>;
            transforms: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$strip>>;
        transforms: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        plugins: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        serve: z.ZodOptional<z.ZodObject<{
            endpoint: z.ZodString;
            playground: z.ZodBoolean;
        }, z.core.$strip>>;
        generatedFrom: z.ZodOptional<z.ZodArray<z.ZodObject<{
            openapi: z.ZodOptional<z.ZodString>;
            service: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    performance: z.ZodOptional<z.ZodObject<{
        caching: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            ttl: z.ZodDefault<z.ZodNumber>;
            strategies: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                field: z.ZodString;
                ttl: z.ZodNumber;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        observability: z.ZodOptional<z.ZodObject<{
            prometheus: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                endpoint: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            opentelemetry: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                serviceName: z.ZodOptional<z.ZodString>;
                sampling: z.ZodOptional<z.ZodObject<{
                    probability: z.ZodDefault<z.ZodNumber>;
                }, z.core.$strip>>;
                exporters: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    type: z.ZodString;
                    endpoint: z.ZodString;
                }, z.core.$strip>>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            config: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                field: z.ZodString;
                max: z.ZodNumber;
                ttl: z.ZodNumber;
                identifyContext: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        filterSchema: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            filters: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    transforms: z.ZodOptional<z.ZodArray<z.ZodString>>;
    authorization: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type DSLManifest = z.infer<typeof DSLManifestSchema>;
/** Partial manifest for scaffolding (relaxed validation) */
export declare const PartialDSLManifestSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<{
        tool: "tool";
        agent: "agent";
        feature: "feature";
        service: "service";
        remote: "remote";
        shell: "shell";
        bff: "bff";
    }>>;
    language: z.ZodOptional<z.ZodEnum<{
        javascript: "javascript";
        typescript: "typescript";
    }>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    owner: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    tags: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    endpoint: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    remoteEntry: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    discovery: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    capabilities: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<{
            platform: "platform";
            domain: "domain";
        }>;
        description: z.ZodOptional<z.ZodString>;
        handler: z.ZodOptional<z.ZodString>;
        inputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodUnknown>;
            values: z.ZodOptional<z.ZodArray<z.ZodString>>;
            formats: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
        outputs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        lifecycle: z.ZodOptional<z.ZodObject<{
            before: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
            main: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
            after: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
            error: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodObject<{
                handler: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
                description: z.ZodOptional<z.ZodString>;
                mandatory: z.ZodOptional<z.ZodBoolean>;
                contained: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>>>;
        }, z.core.$strip>>;
        authorization: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
    dependencies: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        runtime: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        'design-system': z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        mfes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>>;
    data: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        sources: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            handler: z.ZodObject<{
                openapi: z.ZodObject<{
                    source: z.ZodString;
                    operationHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                }, z.core.$strip>;
            }, z.core.$strip>;
            transforms: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$strip>>;
        transforms: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        plugins: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        serve: z.ZodOptional<z.ZodObject<{
            endpoint: z.ZodString;
            playground: z.ZodBoolean;
        }, z.core.$strip>>;
        generatedFrom: z.ZodOptional<z.ZodArray<z.ZodObject<{
            openapi: z.ZodOptional<z.ZodString>;
            service: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    performance: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        caching: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            ttl: z.ZodDefault<z.ZodNumber>;
            strategies: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                field: z.ZodString;
                ttl: z.ZodNumber;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        observability: z.ZodOptional<z.ZodObject<{
            prometheus: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                port: z.ZodDefault<z.ZodNumber>;
                endpoint: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            opentelemetry: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                serviceName: z.ZodOptional<z.ZodString>;
                sampling: z.ZodOptional<z.ZodObject<{
                    probability: z.ZodDefault<z.ZodNumber>;
                }, z.core.$strip>>;
                exporters: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    type: z.ZodString;
                    endpoint: z.ZodString;
                }, z.core.$strip>>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            config: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                field: z.ZodString;
                max: z.ZodNumber;
                ttl: z.ZodNumber;
                identifyContext: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        filterSchema: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            filters: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    transforms: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    authorization: z.ZodOptional<z.ZodOptional<z.ZodUnknown>>;
    name: z.ZodString;
}, z.core.$strip>;
export type PartialDSLManifest = z.infer<typeof PartialDSLManifestSchema>;
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
    capability?: string;
}
//# sourceMappingURL=schema.d.ts.map
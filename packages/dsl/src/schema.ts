/**
 * The manifest language — everything an `mfe-manifest.yaml` is allowed to say.
 *
 * Zod schemas here are the single source of truth twice over: they validate the
 * manifest at parse time, and the TypeScript types are inferred from them, so a
 * field cannot exist in the types without existing in the validator. The
 * committed JSON Schema is generated from these too (ADR-065).
 *
 * WHY THIS IS THE CENTRE OF THE PLATFORM: the manifest is the only input to
 * code generation (ADR-043). A capability, its lifecycle hooks, its data
 * sources, its slots and its framework all come from here, and the generator
 * branches on nothing else. That is what makes a generated MFE reproducible —
 * regenerate from the same manifest and you get the same bytes, which is
 * exactly what `check:mfe-drift` asserts across 21 examples.
 *
 * It also means a field added here reaches every generated MFE. `framework` and
 * `bundler` are deliberately open strings rather than enums (ADR-036): an
 * unknown value warns on stderr instead of failing, so shipping a new framework
 * plugin does not require a schema change here.
 */

import { z } from 'zod';
import { SLOT_ID_SEGMENT, PLATFORM_WRAPPER_METHODS, classifyMeshEntry } from '@seans-mfe/contracts';

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

/** Known built-in frameworks — used for validation warnings, not hard errors (ADR-036, #181). */
export const KNOWN_FRAMEWORKS = ['react', 'angular'] as const;

/** Known built-in bundlers — used for validation warnings, not hard errors (ADR-036, #181). */
export const KNOWN_BUNDLERS = ['rspack', 'webpack'] as const;

/** UI framework — open string so third-party plugins can register new values (ADR-036, #181). */
export const FrameworkSchema = z.string().min(1);
export type Framework = z.infer<typeof FrameworkSchema>;

/** Bundler — open string so third-party plugins can register new values (ADR-036, #181). */
export const BundlerSchema = z.string().min(1);
export type Bundler = z.infer<typeof BundlerSchema>;

// ---------------------------------------------------------------------------
// Secondary build targets (ADR-095)
// ---------------------------------------------------------------------------

/**
 * Known built-in secondary targets — warnings, not hard errors, exactly as
 * KNOWN_FRAMEWORKS/KNOWN_BUNDLERS are (ADR-036, #181). A target generator
 * shipped outside this repo must not require a schema change here.
 */
export const KNOWN_TARGETS = ['swift'] as const;

/**
 * A Swift identifier: a letter or underscore, then letters/digits/underscores.
 * The module name becomes `Sources/<moduleName>/` and the Swift `module` name,
 * so a kebab-case MFE name cannot be passed through unchanged — codegen derives
 * a PascalCase default, and an explicit override has to be legal Swift.
 */
const SWIFT_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The Swift native target (ADR-095, ADR-096).
 *
 * Deliberately tiny: everything here is either unavailable to codegen (an
 * Apple bundle id) or a toolchain pin. Capability set, module identity and
 * lifecycle all come from the manifest proper — a secondary target declares
 * how to BUILD, never what the MFE IS.
 */
export const SwiftTargetSchema = z.object({
  moduleName: z
    .string()
    .min(1)
    .regex(SWIFT_IDENTIFIER, 'moduleName must be a Swift identifier (letters, digits, underscore; not leading-digit)')
    .optional()
    .describe('Swift module name. Omitted ⇒ derived as PascalCase(manifest.name).'),
  bundleId: z
    .string()
    .min(1)
    .optional()
    .describe('Apple bundle identifier. Omitted ⇒ derived from owner and name.'),
  deploymentTarget: z
    .string()
    .min(1)
    .default('17.0')
    .describe('Minimum iOS deployment target for the generated Package.swift.'),
  swiftToolsVersion: z
    .string()
    .min(1)
    .default('5.9')
    .describe('swift-tools-version pin for the generated Package.swift.'),
});
export type SwiftTarget = z.infer<typeof SwiftTargetSchema>;

/**
 * Secondary build targets — a second artifact from the same manifest.
 *
 * Open in shape for the same reason `framework` is an open string: `swift` is
 * the only key the platform ships, not the only key that may exist.
 */
export const TargetsSchema = z.object({
  swift: SwiftTargetSchema.optional()
    .describe('Emit a Swift Package alongside the web build (ADR-095, ADR-096).'),
});
export type Targets = z.infer<typeof TargetsSchema>;

/** Capability type discrimination */
export const CapabilityTypeSchema = z.enum(['platform', 'domain']);
export type CapabilityType = z.infer<typeof CapabilityTypeSchema>;

/**
 * Platform capabilities that all MFEs must implement. Single-sourced in
 * `@seans-mfe/contracts` (ADR-080) — this list previously omitted
 * `updateControlPlaneState`, which the runtime had already shipped.
 */
export { PLATFORM_CAPABILITIES } from '@seans-mfe/contracts';
export type { PlatformCapability } from '@seans-mfe/contracts';

// =============================================================================
// Input/Output Schemas
// =============================================================================

/** Input parameter definition */
export const DSLInputSchema = z.object({
  name: z.string(),
  type: z.string(),  // DSL type string (e.g., 'string!', 'array<User!>!')
  description: z.string().optional().describe('Human-readable summary shown in describe output.'),
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

/**
 * Platform wrapper methods forbidden as handler references — a hook naming one
 * would re-enter the orchestrator it runs inside. Derived from the canonical
 * capability set in `@seans-mfe/contracts` (ADR-080), so a new capability is
 * forbidden here the moment it is defined there.
 */
export { PLATFORM_WRAPPER_METHODS };

export const LifecycleHookSchema = z.object({
  handler: z.union([z.string(), z.array(z.string())]),
  // ADR-040: declarative module specifier for the handler implementation.
  // Accepts a relative path ("./handlers/foo.ts"), a module ("@org/pkg"), or
  // module+named-export ("@org/pkg#exportName"). Codegen emits a static import
  // and wires the function into deps.customHandlers; BaseMFE.invokeHandler
  // already picks it up via its existing DI branch.
  source: z.string().min(1).optional(),
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
  authorization: z.string().optional()  // Deferred - ADR-007
});
export type CapabilityConfig = z.infer<typeof CapabilityConfigSchema>;

/** Capability entry (name → config) */
export const CapabilityEntrySchema = z.record(z.string(), CapabilityConfigSchema);
export type CapabilityEntry = z.infer<typeof CapabilityEntrySchema>;

// =============================================================================
// Data Layer Schemas (GraphQL BFF - ADR-012)
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

/**
 * Mesh transform — open record, rejected only when the name is a Mesh *plugin*
 * put in the wrong section. Classification is single-sourced in
 * `@seans-mfe/contracts` (ADR-092); an unknown name passes, and a name Mesh
 * ships in both positions (`mock`, `snapshot`) is never reported as misplaced.
 */
export const DataTransformSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  for (const name of Object.keys(val)) {
    if (classifyMeshEntry(name) === 'plugin') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${name}" is a plugin, not a transform. Move it to the plugins section.`,
        path: [name]
      });
    }
  }
});
export type DataTransform = z.infer<typeof DataTransformSchema>;

/** Mesh plugin - flexible schema with validation */
export const DataPluginSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  for (const name of Object.keys(val)) {
    if (classifyMeshEntry(name) === 'transform') {
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
/** Demo-mode mock switch (ADR-052): opt-in per-request live/mock switching. */
export const MockSwitchSchema = z.object({
  enabled: z.boolean().default(false)
});

export const DataConfigSchema = z.object({
  sources: z.array(DataSourceSchema),
  transforms: z.array(DataTransformSchema).optional(),
  plugins: z.array(DataPluginSchema).optional(),
  serve: DataServeSchema.optional(),
  mockSwitch: MockSwitchSchema.optional(),
  generatedFrom: z.array(DataLineageSchema).optional()
});
export type DataConfig = z.infer<typeof DataConfigSchema>;

// =============================================================================
// Performance & Observability Schemas (ADR-027)
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
// Provided Slots (ADR-066 / ADR-067)
// =============================================================================

/**
 * A slot id segment is either a `{param}` placeholder (keyed/repeated slots —
 * the ADR-066 domain-key rule) or a literal containing at least one letter.
 * Purely numeric segments are rejected: a number describes a position, and
 * addresses must be assigned names, never measured ordinals (ADR-066).
 * The grammar is single-sourced in @seans-mfe/contracts (ADR-069); the
 * runtime matcher compiles from the same definition.
 */

/** One slot an MFE declares it will provide at runtime (ADR-067). */
export const ProvidedSlotSchema = z.object({
  id: z.string().min(1, 'Slot id is required').superRefine((id, ctx) => {
    if (id.includes('/')) {
      ctx.addIssue({
        code: 'custom',
        message: `Slot id "${id}" must not contain "/" — path composition is host-owned (ADR-068); declare the local name only`,
      });
      return;
    }
    for (const segment of id.split('.')) {
      if (!SLOT_ID_SEGMENT.test(segment)) {
        ctx.addIssue({
          code: 'custom',
          message:
            `Slot id "${id}" segment "${segment}" is invalid: each dot-separated segment must be an assigned name ` +
            `(contain a letter) or a {param} placeholder — positional/numeric addresses are not part of the contract (ADR-066)`,
        });
      }
    }
  }),
  description: z.string().optional(),
});
export type ProvidedSlot = z.infer<typeof ProvidedSlotSchema>;

/** The manifest's slot contract: unique, assigned slot ids (ADR-067). */
export const ProvidesSlotsSchema = z.array(ProvidedSlotSchema).superRefine((slots, ctx) => {
  const seen = new Set<string>();
  for (const slot of slots) {
    if (seen.has(slot.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate slot id "${slot.id}" — each declared slot must have a unique assigned name (ADR-066)`,
      });
    }
    seen.add(slot.id);
  }
});
export type ProvidesSlots = z.infer<typeof ProvidesSlotsSchema>;

// =============================================================================
// Main DSL Schema
// =============================================================================

/** Complete MFE DSL manifest */
export const DSLManifestSchema = z.object({
  // Core identity (required)
  name: z.string().min(1, 'Name is required')
    .describe('Unique MFE identifier. Used as the registry key and as the generated class/module name. kebab-case.'),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Version must be semver (e.g., 1.0.0)')
    .describe('Manifest version. Bump on any breaking change to capability inputs or outputs.'),
  type: MFETypeSchema.describe('Architectural role of this MFE.'),
  language: LanguageSchema.describe('Implementation language. Only javascript/typescript generate code today.'),

  // UI framework + bundler (omit ⇒ react + rspack for back-compat).
  // Drives codegen template variant selection in UnifiedGenerator.
  framework: FrameworkSchema.optional()
    .describe('UI framework. Open string — an unknown value warns rather than failing (ADR-036). Omitted defaults to react.'),
  bundler: BundlerSchema.optional()
    .describe('Build tool. Open string, same policy as framework. Omitted defaults to rspack.'),

  // Secondary build targets — a SECOND artifact from this same manifest
  // (ADR-095). `framework`/`bundler` above describe the primary web build;
  // this describes anything built beside it. Must be declared here: the
  // manifest object is non-strict, so an undeclared key is stripped silently.
  targets: TargetsSchema.optional()
    .describe('Secondary build targets built from this same manifest, e.g. a Swift Package (ADR-095).'),

  // Optional identity
  description: z.string().optional(),
  owner: z.string().optional().describe('Team or individual responsible. Used for impact analysis (ADR-008).'),
  tags: z.array(z.string()).optional().describe('Arbitrary labels for registry search and impact analysis.'),
  category: z.string().optional().describe('Domain grouping for discovery and the marketplace.'),
  
  // Endpoints (required for runtime, generated for new projects)
  endpoint: z.string().url().optional()
    .describe('Base URL this MFE is served from. Also sets the generated dev-server port and the BFF origin.'),
  remoteEntry: z.string().url().optional().describe('Module Federation remote entry URL.'),
  discovery: z.string().url().optional().describe('URL of the MFE\'s .well-known manifest, for discovery.'),
  
  // Core sections
  capabilities: z.array(CapabilityEntrySchema)
    .describe('The domain and platform capabilities this MFE implements. Drives feature-file generation.'),
  dependencies: DependenciesSchema.optional()
    .describe('Runtime, design-system and federated-MFE dependencies. Versions flow into the generated package.json.'),
  data: DataConfigSchema.optional()
    .describe('GraphQL Mesh configuration. Its presence is what makes the generator emit a BFF.'),

  // Slot contract: the named regions this MFE registers at runtime via
  // provideSlot (ADR-058). Declared here so codegen emits the registration
  // and registry rules validate placement targets at design time (ADR-067).
  providesSlots: ProvidesSlotsSchema.optional()
    .describe('Named regions this MFE registers at runtime for others to fill (ADR-058, ADR-067).'),
  
  // Performance & observability config (ADR-027)
  performance: PerformanceConfigSchema.optional()
    .describe('Caching, observability and rate-limiting config. Mesh plugins and transforms are derived from it (ADR-027).'),
  transforms: z.array(CustomTransformSchema).optional()
    .describe('Top-level Mesh transform names. Both the config-key and package spellings resolve (ADR-092).'),
  
  // Future sections (deferred)
  authorization: z.unknown().optional()
    .describe('Reserved. Deferred by ADR-007; accepted and ignored.')
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

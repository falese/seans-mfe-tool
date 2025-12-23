/**
 * Runtime exports for MFE platform
 * 
 * REQ-RUNTIME-002: Context interfaces and utilities
 * REQ-RUNTIME-001: Load capability and BaseMFE
 */

// Context (REQ-RUNTIME-002)
export {
  Context,
  UserContext,
  TelemetryEvent,
  ValidationError,
  ContextFactory,
  ContextValidator,
} from './context';

// BaseMFE and result types (REQ-RUNTIME-001)
export {
  BaseMFE,
  LoadResult,
  RenderResult,
  HealthResult,
  DescribeResult,
  SchemaResult,
  QueryResult,
  EmitResult,
  MFEState,
  VALID_TRANSITIONS,
} from './base-mfe';

// ADR-060 Load Capability types
export {
  CapabilityMetadata,
  PhaseError,
  PhaseTelemetry,
} from './types';

// ADR-060 LoadResult validator
export {
  LoadResultValidator,
  ValidationResult,
  PerformanceMetrics,
} from './validators/load-result-validator';

// Alpha Orchestration System
// Note: These are also exported from @seans-mfe-tool/control which extends them with daemon integration
export {
  OrchestrationContext,
  MFERegistryEntry,
  MFEDependency,
  createOrchestrationContext,
} from './orchestration-context';

export {
  OrchestrationTelemetry,
  OrchestrationTelemetryEvent,
} from './orchestration-telemetry';

export {
  OrchestrationRuntime,
  MFEDescriptor,
} from './orchestration-runtime';

export {
  OrchestrationValidator,
  OrchestrationValidationResult,
  AggregatedPerformanceMetrics,
} from './validators/orchestration-validator';

// RemoteMFE concrete implementation (REQ-RUNTIME-001, REQ-RUNTIME-004)
export {
  RemoteMFE,
  ModuleFederationContainer,
} from './remote-mfe';

// Platform handlers (REQ-RUNTIME-005 through REQ-RUNTIME-010)
export * from './handlers';

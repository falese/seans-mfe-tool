/**
 * @seans-mfe-tool/control
 *
 * Orchestration control plane - hybrid library and remote MFE
 *
 * Library Exports:
 * - Orchestration runtime, context, telemetry, validators
 * - Daemon client/bridge for Rust daemon integration
 *
 * Remote MFE Exports (via Module Federation):
 * - Visual orchestration dashboard
 * - Telemetry viewer and workflow tracer
 * - Dependency graph visualizer
 * - Developer tools and playground
 */

// Orchestration Runtime
export {
  OrchestrationRuntime,
  OrchestrationContext,
  MFERegistryEntry,
  MFEDependency,
  createOrchestrationContext,
  MFEDescriptor,
} from './runtime';

export {
  OrchestrationTelemetry,
  OrchestrationTelemetryEvent,
} from './runtime';

export {
  OrchestrationValidator,
  OrchestrationValidationResult,
  AggregatedPerformanceMetrics,
} from './runtime';

// Daemon Client/Bridge
export {
  DaemonClient,
  DaemonConfig,
  DaemonStatus,
  MessageHandler,
} from './daemon';

export {
  RegistryClient,
  MFERegistryResponse,
} from './daemon';

export type {
  DaemonMessage,
  DaemonMessageType,
  MFEMetadata,
  MFELoadRequest,
  MFELoadResponse,
  RegistryUpdatePayload,
  DaemonError,
} from './daemon';

// Note: React hooks will be added after UI components are implemented
// export { useOrchestration } from './hooks/useOrchestration';
// export { useDaemon } from './hooks/useDaemon';
// export { useTelemetry } from './hooks/useTelemetry';

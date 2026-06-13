/**
 * Runtime exports for MFE platform
 * 
 * REQ-RUNTIME-002: Context interfaces and utilities
 * REQ-RUNTIME-001: Load capability and BaseMFE
 */

// Context (REQ-RUNTIME-002)
export type { Context, UserContext, TelemetryEvent, ValidationError, QueryInput } from './context';
export { ContextFactory, ContextValidator } from './context';

// BaseMFE and result types (REQ-RUNTIME-001)
export { BaseMFE, VALID_TRANSITIONS } from './base-mfe';
export type { LoadResult, RenderResult, HealthResult, DescribeResult, SchemaResult, QueryResult, EmitResult, ControlPlaneStateResult, MFEState } from './base-mfe';

// RemoteMFE concrete implementation (REQ-RUNTIME-001, REQ-RUNTIME-004)
export { RemoteMFE } from './remote-mfe';
export type { ModuleFederationContainer } from './remote-mfe';

// AngularRemoteMFE is available via the ./angular subpath (ADR-035).
// Import as: import { AngularRemoteMFE } from '@seans-mfe-tool/runtime/angular'

// Daemon WebSocket client (used to wire up the control-plane connection)
export { GraphQLWebSocketClient } from './graphql-ws-client';
export type { DaemonWebSocketClient } from './graphql-ws-client';

// Platform handlers (REQ-RUNTIME-005 through REQ-RUNTIME-010)
export * from './handlers';

// Daemon-driven slot composition (ADR-055) — generic shells host a
// LayoutManager and stay empty until the daemon publishes experiences
export {
  LayoutManager,
  GraphQLTransportWsDaemonTransport,
  htmlAdaptor,
  jsonAdaptor,
  moduleFederationAdaptor,
} from './layout-manager';
export type {
  ExperienceAdaptor,
  AdaptorHelpers,
  DaemonTransport,
  DaemonEnvelope,
  LayoutManagerConfig,
  SlotElementLike,
  TransportStatus,
  UnmountFn,
  WebSocketLike,
} from './layout-manager';

// Presentation boundary (ADR-056) — the MFE side exposes its lifecycle as the
// guaranteed imperative handle; host-side providers consume the sealed port.
export { createImperativeHandle } from './imperative-handle';
export type { MountableLifecycle, ImperativeHandleOptions } from './imperative-handle';

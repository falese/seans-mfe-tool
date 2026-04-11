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
  ControlPlaneStateResult,
  MFEState,
  VALID_TRANSITIONS,
} from './base-mfe';

// RemoteMFE concrete implementation (REQ-RUNTIME-001, REQ-RUNTIME-004)
export {
  RemoteMFE,
  ModuleFederationContainer,
} from './remote-mfe';

// Daemon WebSocket client (used to wire up the control-plane connection)
export { GraphQLWebSocketClient } from './graphql-ws-client';
export type { DaemonWebSocketClient } from './graphql-ws-client';

// Platform handlers (REQ-RUNTIME-005 through REQ-RUNTIME-010)
export * from './handlers';

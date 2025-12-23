/**
 * Daemon WebSocket Protocol Types
 *
 * Defines the message protocol for communicating with the Rust daemon
 * via WebSocket for real-time registry updates and MFE lifecycle events.
 */

export interface DaemonMessage {
  type: DaemonMessageType;
  payload: unknown;
  timestamp: string;
  requestId?: string;
}

export type DaemonMessageType =
  | 'registry.update'
  | 'registry.query'
  | 'mfe.registered'
  | 'mfe.unregistered'
  | 'mfe.health.update'
  | 'mfe.load.request'
  | 'mfe.load.response'
  | 'ping'
  | 'pong'
  | 'error';

export interface RegistryUpdatePayload {
  action: 'add' | 'remove' | 'update';
  mfe: MFEMetadata;
}

export interface MFEMetadata {
  id: string;
  name: string;
  version: string;
  type: 'tool' | 'agent' | 'feature' | 'service' | 'remote' | 'shell' | 'bff';
  manifestUrl: string;
  remoteEntryUrl: string;
  healthUrl?: string;
  capabilities: string[];
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
  registeredAt: string;
}

export interface MFELoadRequest {
  mfeId: string;
  context?: Record<string, unknown>;
}

export interface MFELoadResponse {
  mfeId: string;
  success: boolean;
  manifest?: unknown;
  error?: string;
}

export interface DaemonError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

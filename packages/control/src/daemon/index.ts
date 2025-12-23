/**
 * Daemon Client Module Exports
 *
 * Exports WebSocket client, HTTP REST client, and protocol types
 * for communicating with the Rust daemon registry service.
 */

export {
  DaemonClient,
  DaemonConfig,
  DaemonStatus,
  MessageHandler,
} from './DaemonClient';

export {
  RegistryClient,
  MFERegistryResponse,
} from './RegistryClient';

export type {
  DaemonMessage,
  DaemonMessageType,
  RegistryUpdatePayload,
  MFEMetadata,
  MFELoadRequest,
  MFELoadResponse,
  DaemonError,
} from './types';

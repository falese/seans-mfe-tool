/** Metadata threaded through every envelope for correlation and acknowledgement */
export interface MessageMetadata {
  correlationId: string;
  acknowledged: boolean;
  error: string | null;
}

/**
 * The action payload carried inside a Message envelope.
 * Corresponds to DaemonService's internal ActionRecord shape.
 */
export interface ActionRecord {
  id: string;
  componentId: string;
  actionType: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Full Message envelope sent over the graphql-transport-ws connection.
 * direction / kind drive the daemon's handleAction pipeline.
 */
export interface Message {
  direction: 'ACTION' | 'ECHO' | 'SNAPSHOT' | 'RESOLVE';
  kind: 'ACTION' | 'ACTION_ECHO' | 'STATE_SNAPSHOT' | 'RESOLVE';
  payload: ActionRecord;
  metadata: MessageMetadata;
}

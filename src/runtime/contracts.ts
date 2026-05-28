// Inlined from @seans-mfe/contracts — avoids external package resolution in
// Docker builds where packages/contracts/dist/ is not present.

export interface MessageMetadata {
  correlationId: string;
  acknowledged: boolean;
  error: string | null;
}

export interface ActionRecord {
  id: string;
  componentId: string;
  actionType: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface Message {
  direction: 'ACTION' | 'ECHO' | 'SNAPSHOT' | 'RESOLVE';
  kind: 'ACTION' | 'ACTION_ECHO' | 'STATE_SNAPSHOT' | 'RESOLVE';
  payload: ActionRecord;
  metadata: MessageMetadata;
}

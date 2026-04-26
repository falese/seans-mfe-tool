/**
 * WebSocket broadcaster
 *
 * Fans out registry change events to all connected shell runtimes.
 *
 * Pattern from falese/daemon (ComponentDaemon.publish + PubSub):
 *   Every connected renderer receives every published message.
 *   Messages use a direction/kind/payload envelope so clients can
 *   route them without parsing the full payload first.
 */
import type { WebSocketServer } from 'ws';

export interface RegistryEvent {
  type: 'REGISTERED' | 'UPDATED' | 'DEREGISTERED';
  entry: unknown;
  timestamp: string;
}

export function createBroadcaster(wss: WebSocketServer) {
  wss.on('connection', (ws) => {
    console.log('[orchestration] Shell runtime connected via WS');
    ws.on('close', () => console.log('[orchestration] Shell runtime disconnected'));
    ws.on('error', (err) => console.error('[orchestration] WS error:', err.message));
  });

  return function broadcast(event: RegistryEvent) {
    const payload = JSON.stringify(event);
    let sent = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === 1 /* OPEN */) {
        try {
          client.send(payload);
          sent++;
        } catch (err) {
          // Non-fatal — client may have disconnected mid-broadcast
        }
      }
    });
    if (sent > 0) {
      console.log(`[orchestration] Broadcast ${event.type} to ${sent} client(s)`);
    }
  };
}

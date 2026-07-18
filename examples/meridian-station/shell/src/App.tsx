/**
 * Meridian Station shell — a 100% generic, daemon-driven layout host (ADR-055).
 *
 * The shell knows NOTHING about which MFEs exist. It hosts a LayoutManager
 * from @seans-mfe-tool/runtime and stays empty until the daemon control plane
 * publishes EXPERIENCE components; each experience is mounted into a layout
 * slot by the adaptor for its contentType (module-federation experiences load
 * any framework's remote — React, Angular — through the shared BaseMFE
 * bootstrap contract).
 *
 * Configuration (set at build time via rspack DefinePlugin / env):
 *   DAEMON_WS_URL — the daemon's graphql-transport-ws endpoint
 *                   (default ws://localhost:3004/graphql; run the Node daemon
 *                   with DAEMON_PORT=3004 since flappy/hockey own 3001/3002)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  GraphQLTransportWsDaemonTransport,
  LayoutManager,
  type TransportStatus,
  type WebSocketLike,
} from '@seans-mfe-tool/runtime';
import type { SessionContext } from '@seans-mfe/contracts';

// Replaced at build time by rspack DefinePlugin; the declaration keeps the
// shell free of @types/node.
declare const process: { env: { DAEMON_WS_URL?: string } };
const DAEMON_WS_URL: string = process.env.DAEMON_WS_URL || 'ws://localhost:4504/graphql';

/** Per-tab session: who is here, in what kind of application. */
function createSession(): SessionContext {
  return {
    sessionId: `shell-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    application: 'web',
    locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
  };
}

const App: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<TransportStatus>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasExperiences, setHasExperiences] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const host = hostRef.current;

    const transport = new GraphQLTransportWsDaemonTransport(
      DAEMON_WS_URL,
      (url, protocol) => new WebSocket(url, protocol) as unknown as WebSocketLike
    );

    const manager = new LayoutManager({
      container: host,
      transport,
      session: createSession(),
      // This shell is React; declare it so the provider can negotiate the
      // MFE's native handle when frameworks match (ADR-056). Today every game
      // composes via its guaranteed imperative handle (isolated island).
      hostFramework: 'react',
      onStatus: setStatus,
      onError: setLastError,
    });

    // The layout is empty until the daemon signals; flip the placeholder off
    // the first time a slot appears.
    const observer = new MutationObserver(() => {
      if (host.childElementCount > 0) setHasExperiences(true);
    });
    observer.observe(host, { childList: true });

    manager.start();
    return () => {
      observer.disconnect();
      void manager.stop();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0b0e1a' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          color: '#8b93b5',
          borderBottom: '1px solid #1c2340',
        }}
      >
        <span
          aria-label={`daemon ${status}`}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: status === 'connected' ? '#2e9e44' : status === 'connecting' ? '#d9a514' : '#c33',
          }}
        />
        <span>Meridian Station · control plane: {status}</span>
        {lastError && <span style={{ color: '#c33' }}>· {lastError}</span>}
      </header>

      {!hasExperiences && (
        <p
          style={{
            textAlign: 'center',
            marginTop: '20vh',
            fontFamily: 'system-ui, sans-serif',
            color: '#5d6690',
          }}
        >
          Awaiting Meridian Station control plane…
        </p>
      )}

      {/* All experiences mount here — one child element per layout slot. */}
      <div ref={hostRef} data-testid="layout-host" className="layout-host" />
    </div>
  );
};

export default App;

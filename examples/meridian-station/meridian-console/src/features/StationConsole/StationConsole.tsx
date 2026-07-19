/**
 * StationConsole — the Meridian Station operator home (ADR-058).
 *
 * Renders the domain menu in its own region and contributes three kinds of
 * region to the host layout through the manifest-backed slot contract
 * (generated src/slots.tsx, ADR-067):
 *
 *   main       — the active domain MFE composes here
 *   status     — compact status cards compose here
 *   berth.{id} — KEYED slots (ADR-069): one address per berth on the strip
 *                (meridian-console/berth.b1 … berth.b6 once provider-scoped)
 *
 * Selecting a domain drives the control plane via the inherited BaseMFE
 * platform capability updateControlPlaneState (ADR-057); on mount the
 * console fires one meridian.berth.<id> action per berth so the strip
 * populates itself through six independent control-plane round trips —
 * the console knows nothing about what renders inside a tile.
 */
import React, { useCallback, useEffect } from 'react';
import { mfe } from '../../platform/base-mfe/bootstrap';
import { slotContract } from '../../slots';

export interface Domain {
  id: string;
  title: string;
  emoji?: string;
  color?: string;
  blurb?: string;
}

export interface StationConsoleProps {
  /** Domain catalog injected by the registry root rule (ADR-058). */
  domains?: Domain[];
  /** Berth ids for the keyed strip — injected by the registry root rule. */
  berths?: string[];
  /** Host callback to contribute or release a slot element (ADR-058). */
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
}

/** Fallback catalog for standalone/dev mode; the registry rule overrides it. */
export const DEFAULT_DOMAINS: readonly Domain[] = [
  { id: 'docking', title: 'Docking Control', emoji: '🛰️', color: '#3b6ff5', blurb: 'Berths, traffic, assignments' },
  { id: 'life-support', title: 'Life Support', emoji: '🫁', color: '#2e9e6b', blurb: 'Telemetry, environment, alerts' },
  { id: 'cargo', title: 'Cargo Operations', emoji: '📦', color: '#c77b21', blurb: 'Manifests, hazards, valuations' },
  { id: 'crew', title: 'Crew Services', emoji: '🧑‍🚀', color: '#8455d6', blurb: 'Roster, certifications, pay' },
  { id: 'concourse', title: 'Concourse', emoji: '🍜', color: '#d64570', blurb: 'Vendors, stalls, settlements' },
] as const;

// Narrow view of the inherited platform capability — avoids importing the
// full Context type into example feature code.
type ControlPlane = {
  updateControlPlaneState(ctx: {
    requestId: string;
    timestamp: Date;
    inputs: { stateKey: string };
  }): Promise<unknown>;
};

function dispatch(stateKey: string): void {
  const cp = mfe as unknown as ControlPlane;
  void cp.updateControlPlaneState({
    requestId: `${stateKey}-${Date.now()}`,
    timestamp: new Date(),
    inputs: { stateKey },
  });
}

/** One keyed berth slot — its own component so the ref callback is stable. */
const BerthSlot: React.FC<{
  berthId: string;
  provideSlot?: StationConsoleProps['provideSlot'];
}> = ({ berthId, provideSlot }) => {
  const register = useCallback(
    (el: HTMLElement | null) => slotContract.register(provideSlot, `berth.${berthId}`, el),
    [berthId, provideSlot]
  );
  return (
    <div
      ref={register}
      data-berth={berthId}
      style={{
        minHeight: 96,
        borderRadius: 10,
        border: '1px dashed #2a3358',
        background: '#111631',
        display: 'grid',
        placeItems: 'center',
        color: '#3d4770',
        fontSize: 12,
      }}
    >
      {berthId}
    </div>
  );
};

export const StationConsole: React.FC<StationConsoleProps> = ({
  domains = DEFAULT_DOMAINS as Domain[],
  berths = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
  provideSlot,
}) => {
  const registerMain = useCallback(
    (el: HTMLElement | null) => slotContract.register(provideSlot, 'main', el),
    [provideSlot]
  );
  const registerStatus = useCallback(
    (el: HTMLElement | null) => slotContract.register(provideSlot, 'status', el),
    [provideSlot]
  );

  // Populate the berth strip: one action per berth, each resolved by the
  // registry into a BerthTile experience addressed to its keyed slot.
  const berthKey = berths.join(',');
  useEffect(() => {
    for (const berthId of berths) {
      dispatch(`meridian.berth.${berthId}`);
    }
    // berthKey stands in for the array identity — re-fire only when the
    // actual berth set changes, not on parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berthKey]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(230px, 280px) 1fr minmax(230px, 300px)',
        gridTemplateRows: 'auto 1fr',
        gap: 16,
        minHeight: '92vh',
        padding: 16,
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0b0e1a',
        color: '#dfe4ff',
      }}
    >
      {/* Berth strip — six keyed slots the control plane fills independently */}
      <section style={{ gridColumn: '1 / -1' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 13, letterSpacing: 1.5, color: '#5d6690', textTransform: 'uppercase' }}>
          Berth strip
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(berths.length, 1)}, 1fr)`, gap: 10 }}>
          {berths.map((berthId) => (
            <BerthSlot key={berthId} berthId={berthId} provideSlot={provideSlot} />
          ))}
        </div>
      </section>

      {/* Domain menu */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <header>
          <h1 style={{ margin: '4px 0', fontSize: 24 }}>🛸 Meridian Station</h1>
          <p style={{ margin: 0, color: '#5d6690', fontSize: 13 }}>Select a station domain</p>
        </header>
        <div style={{ display: 'grid', gap: 10 }} role="list">
          {domains.map((domain) => (
            <button
              key={domain.id}
              role="listitem"
              onClick={() => dispatch(`meridian.open.${domain.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 10,
                border: `1px solid ${domain.color ?? '#2a3358'}`,
                background: '#111631',
                color: '#dfe4ff',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 15,
              }}
            >
              <span style={{ fontSize: 22 }}>{domain.emoji ?? '🛰️'}</span>
              <span>
                <strong style={{ display: 'block' }}>{domain.title}</strong>
                {domain.blurb && (
                  <span style={{ fontSize: 12, color: '#8b93b5' }}>{domain.blurb}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Contributed regions: the active domain and the status rail */}
      <div
        ref={registerMain}
        data-declared-slot="main"
        style={{ minHeight: '60vh', borderRadius: 12, border: '1px dashed #2a3358', background: '#0e1226' }}
      />
      <div
        ref={registerStatus}
        data-declared-slot="status"
        style={{ minHeight: '60vh', borderRadius: 12, border: '1px dashed #2a3358', background: '#0e1226' }}
      />
    </div>
  );
};

export default StationConsole;

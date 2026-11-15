/**
 * PassengerManifest Feature Component
 *
 * StationOS passengers (PascalCase pages) grouped by the Harbormaster docking
 * they arrived on (bare snake_case arrays). The join is the station's id pun:
 * a passenger's DockingNo 4025 is Harbormaster's docking_id 4025 — and an
 * arrival Harbormaster has no record of is shown as such, not dropped.
 */
import React, { useEffect, useState } from 'react';
import { query } from '../../platform/bff/bff';

interface Passenger { passengerId: number; passengerName: string; dockingNo: number; cabinClass: string; clearanceStatus: string }
interface Docking { dockingId: number; vesselRegistryNo: string; statusCode: string; etaUtc: string }
interface ManifestData { passengers: Passenger[]; listDockings: Docking[] }

export interface ArrivalGroup {
  dockingNo: number;
  docking: Docking | undefined;
  passengers: Passenger[];
}

const MANIFEST_QUERY = /* GraphQL */ `
  {
    passengers { passengerId passengerName dockingNo cabinClass clearanceStatus }
    listDockings { dockingId vesselRegistryNo statusCode etaUtc }
  }
`;

/** Passengers by docking, in arrival (ETA) order; arrivals with no Harbormaster record last. */
export function groupByDocking(passengers: Passenger[], dockings: Docking[]): ArrivalGroup[] {
  const byId = new Map(dockings.map((d) => [d.dockingId, d]));
  const groups = new Map<number, ArrivalGroup>();
  for (const p of passengers) {
    const g = groups.get(p.dockingNo) ?? { dockingNo: p.dockingNo, docking: byId.get(p.dockingNo), passengers: [] };
    g.passengers.push(p);
    groups.set(p.dockingNo, g);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.docking || !b.docking) return a.docking ? -1 : b.docking ? 1 : a.dockingNo - b.dockingNo;
    return a.docking.etaUtc.localeCompare(b.docking.etaUtc);
  });
}

/** Clearance filter values: every passenger, or one clearance status. */
const CLEARANCES = ['ALL', 'CLEARED', 'FLAGGED', 'PENDING'];

/** Whether a passenger is shown: the name contains the search (any case), and the clearance fits. */
export function matches(p: Passenger, search: string, clearance: string): boolean {
  return p.passengerName.toLowerCase().includes(search.trim().toLowerCase()) && (clearance === 'ALL' || p.clearanceStatus === clearance);
}

/** "6 cleared · 1 flagged · 1 pending", omitting zeroes. */
function tally(passengers: Passenger[]): string {
  const count = (s: string) => passengers.filter((p) => p.clearanceStatus === s).length;
  return [['cleared', count('CLEARED')], ['flagged', count('FLAGGED')], ['pending', count('PENDING')]]
    .filter(([, n]) => Number(n) > 0)
    .map(([label, n]) => `${n} ${label}`)
    .join(' · ');
}

const dockingRef = (id: number): string => `DCK-${String(id).padStart(6, '0')}`;
const CLEARANCE_COLOR: Record<string, string> = { CLEARED: '#2e9e6b', FLAGGED: '#c33b4e', PENDING: '#d9a514' };

const wrap: React.CSSProperties = { background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20, fontFamily: 'system-ui, sans-serif' };
const group: React.CSSProperties = { border: '1px solid #1c2340', borderRadius: 10, padding: 12, marginBottom: 12 };

export type PassengerManifestProps = Record<string, never>;

export const PassengerManifest: React.FC<PassengerManifestProps> = () => {
  const [data, setData] = useState<ManifestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clearance, setClearance] = useState('ALL');

  useEffect(() => {
    query<ManifestData>(MANIFEST_QUERY).then(setData).catch((err) => setError(String(err?.message ?? err)));
  }, []);

  if (error) return <div style={wrap}><p style={{ color: '#c33b4e' }}>Passenger manifest unavailable: {error}</p></div>;
  if (!data) return <div style={wrap}><p style={{ color: '#5d6690' }}>Reading the manifests…</p></div>;

  const shown = data.passengers.filter((p) => matches(p, search, clearance));

  return (
    <div style={wrap}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🧳 Passenger Manifest</h2>
      <p style={{ margin: '0 0 12px', color: '#5d6690', fontSize: 12 }}>StationOS passengers · Harbormaster arrivals</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="search"
          aria-label="Search passengers"
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, background: '#141a33', color: '#dfe4ff', border: '1px solid #1c2340', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b93b5' }}>
          Clearance
          <select
            value={clearance}
            onChange={(e) => setClearance(e.target.value)}
            style={{ background: '#141a33', color: '#dfe4ff', border: '1px solid #1c2340', borderRadius: 6, padding: '5px 6px', fontSize: 12 }}
          >
            {CLEARANCES.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All' : c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 && <p style={{ color: '#5d6690', fontSize: 12 }}>No passenger matches.</p>}
      {groupByDocking(shown, data.listDockings).map((g) => (
        <section key={g.dockingNo} style={group} data-docking={g.dockingNo}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <strong style={{ fontSize: 13 }}>
              {g.docking ? `${dockingRef(g.dockingNo)} · ${g.docking.vesselRegistryNo}` : `${dockingRef(g.dockingNo)} · no Harbormaster record`}
            </strong>
            {g.docking && <span style={{ color: '#3b6ff5', fontWeight: 700, fontSize: 10 }}>{g.docking.statusCode}</span>}
          </div>
          <div style={{ color: '#8b93b5', fontSize: 11, marginBottom: 6 }}>{tally(g.passengers)}</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {g.passengers.map((p) => (
              <li key={p.passengerId} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '3px 0' }}>
                <span>{p.passengerName}</span>
                <span style={{ color: '#5d6690' }}>{p.cabinClass}</span>
                <span style={{ marginLeft: 'auto', color: CLEARANCE_COLOR[p.clearanceStatus] ?? '#8b93b5', fontWeight: 700, fontSize: 10 }}>{p.clearanceStatus}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default PassengerManifest;

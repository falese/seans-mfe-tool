import React from 'react';
import { useAppState } from '../store/AppContext';
import { formatCents, statusColor, toDockingRef } from '../utils/helpers';
import StatusChip from './StatusChip';

const th: React.CSSProperties = { textAlign: 'left', color: '#5d6690', fontWeight: 600, padding: '6px 10px', borderBottom: '1px solid #1c2340', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #141a33' };

export default function DockingBoard() {
  const { berths, dockings, charges, loading, error } = useAppState();

  if (error) {
    return <section className="board"><p className="err" style={{ color: '#c33b4e' }}>Docking board unavailable: {error}</p></section>;
  }

  const dockingById = new Map(dockings.map((d) => [d.dockingId, d]));
  const rows = berths.map((berth) => {
    const docking = berth.currentDockingId != null ? dockingById.get(berth.currentDockingId) : undefined;
    const ref = docking ? toDockingRef(docking.dockingId) : null;
    const open = ref ? charges.filter((c) => c.dockingRef === ref && (c.status === 'PENDING' || c.status === 'DISPUTED')) : [];
    const total = open.reduce((sum, c) => sum + c.amountCents, 0);
    return {
      berthId: berth.berthId,
      berthClass: berth.berthClass.replace(/_/g, ' '),
      vessel: docking?.vesselRegistryNo ?? '',
      status: docking?.statusCode ?? 'FREE',
      outstanding: total > 0 ? formatCents(total) : null,
      disputed: open.some((c) => c.status === 'DISPUTED'),
    };
  });

  return (
    <section className="board" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🛰️ Docking Board</h2>
      <p style={{ margin: '0 0 16px', color: '#5d6690', fontSize: 12 }}>Harbormaster occupancy · StellarLedger outstanding tariffs</p>
      {loading && rows.length === 0 && <p style={{ color: '#5d6690' }}>Loading…</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr><th style={th}>Berth</th><th style={th}>Class</th><th style={th}>Vessel</th><th style={th}>Status</th><th style={th}>Outstanding</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.berthId}>
              <td style={td}><strong>{row.berthId}</strong></td>
              <td style={td}>{row.berthClass}</td>
              <td style={td}>{row.vessel || '—'}</td>
              <td style={td}><StatusChip label={row.status} color={statusColor(row.status)} /></td>
              <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                {row.outstanding ? row.outstanding : <span style={{ color: '#5d6690' }}>—</span>}
                {row.disputed && <span className="disputed" style={{ color: '#c33b4e', fontSize: 11, marginLeft: 6, fontWeight: 700 }}>DISPUTED</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

import React from 'react';
import { useAppState } from '../store/AppContext';
import { formatCents, statusColor, toDockingRef } from '../utils/helpers';
import StatusChip from './StatusChip';

interface Props {
  berthId: string;
}

// One tile on the berth strip. Reads from the global store (the strip is
// always on screen, so the store keeps berths/dockings/charges warm).
export default function BerthTile({ berthId }: Props) {
  const { berths, dockings, charges, error } = useAppState();

  const berth = berths.find((b) => b.berthId === berthId);
  const docking = berth?.currentDockingId != null
    ? dockings.find((d) => d.dockingId === berth.currentDockingId && d.berthId === berthId)
    : undefined;

  let status = berth ? docking?.statusCode ?? 'FREE' : '…';
  let outstanding: string | null = null;
  if (docking) {
    const ref = toDockingRef(docking.dockingId);
    const due = charges
      .filter((c) => c.dockingRef === ref && (c.status === 'PENDING' || c.status === 'DISPUTED'))
      .reduce((sum, c) => sum + c.amountCents, 0);
    outstanding = due > 0 ? formatCents(due) : null;
  }
  if (error) status = 'OFFLINE';

  return (
    <div className="tile" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 10, padding: '10px 12px', minHeight: 96, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{berthId}</span>
        <StatusChip small label={status} color={statusColor(status)} />
      </div>
      {docking && <span style={{ fontSize: 12, color: '#8b93b5' }}>{docking.vesselRegistryNo}</span>}
      {!docking && !error && <span style={{ color: '#5d6690', fontSize: 12 }}>berth available</span>}
      {outstanding && <span style={{ fontSize: 11, color: '#d9a514', fontVariantNumeric: 'tabular-nums' }}>{outstanding} due</span>}
      {error && <span style={{ color: '#c33b4e', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

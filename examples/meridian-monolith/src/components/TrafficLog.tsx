import React from 'react';
import { useAppState } from '../store/AppContext';
import { shortTime, statusColor } from '../utils/helpers';
import StatusChip from './StatusChip';

export default function TrafficLog() {
  const { dockings, error } = useAppState();
  const entries = [...dockings].sort((a, b) => b.etaUtc.localeCompare(a.etaUtc));

  return (
    <section className="log" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 16 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 15 }}>🚦 Traffic Log</h2>
      {error && <p style={{ color: '#c33b4e', fontSize: 12 }}>Traffic log unavailable: {error}</p>}
      {entries.map((entry) => (
        <div key={entry.dockingId} className="entry" style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid #141a33', fontSize: 12 }}>
          <span style={{ color: '#5d6690', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{shortTime(entry.etaUtc)}</span>
          <span style={{ fontWeight: 600 }}>{entry.vesselRegistryNo}</span>
          <span style={{ color: '#8b93b5' }}>→ {entry.berthId}</span>
          <span style={{ marginLeft: 'auto' }}><StatusChip small label={entry.statusCode} color={statusColor(entry.statusCode)} /></span>
        </div>
      ))}
    </section>
  );
}

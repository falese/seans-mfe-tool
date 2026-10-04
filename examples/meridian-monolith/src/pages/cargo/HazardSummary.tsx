import React, { useEffect, useState } from 'react';
import { getManifestLines } from '../../api/client';
import { useAppState } from '../../store/AppContext';
import StatusChip from '../../components/StatusChip';
import { hazardColor } from '../../utils/helpers';
import type { ManifestLine } from '../../types';

// Hazardous cargo currently DOCKED, grouped by class. Dockings come from the
// global store; manifest lines are fetched here.
export default function HazardSummary() {
  const { dockings } = useAppState();
  const [lines, setLines] = useState<ManifestLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getManifestLines().then(setLines).catch((err) => setError(String(err?.message ?? err)));
  }, []);

  const docked = new Set(dockings.filter((d) => d.statusCode === 'DOCKED').map((d) => d.dockingId));
  const byHazard = new Map<string, { skus: string[]; massKg: number }>();
  for (const line of lines ?? []) {
    if (line.hazardClass === 'NONE' || !docked.has(line.dockingId)) continue;
    const group = byHazard.get(line.hazardClass) ?? { skus: [], massKg: 0 };
    group.skus.push(line.sku);
    group.massKg += line.declaredMassKg;
    byHazard.set(line.hazardClass, group);
  }
  const groups = [...byHazard.entries()].map(([hazard, g]) => ({ hazard, ...g }));

  return (
    <section className="rail" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 14 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 14 }}>☣️ Hazardous Cargo Aboard</h2>
      {error && <p style={{ color: '#c33b4e', fontSize: 12 }}>{error}</p>}
      {!error && lines && groups.length === 0 && <p style={{ color: '#5d6690', fontSize: 12 }}>No hazardous cargo docked.</p>}
      {groups.map((group) => (
        <div key={group.hazard} className="row" style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', fontSize: 12, borderBottom: '1px solid #141a33' }}>
          <StatusChip small label={group.hazard} color={hazardColor(group.hazard)} />
          <span>{group.skus.join(', ')}</span>
          <span style={{ marginLeft: 'auto', color: '#8b93b5', fontVariantNumeric: 'tabular-nums' }}>{group.massKg.toLocaleString()} kg</span>
        </div>
      ))}
    </section>
  );
}

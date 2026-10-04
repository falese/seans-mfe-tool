import React from 'react';
import BerthTile from '../components/BerthTile';
import { BERTHS } from '../utils/constants';

export default function BerthStrip() {
  return (
    <section style={{ gridColumn: '1 / -1' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 13, letterSpacing: 1.5, color: '#5d6690', textTransform: 'uppercase' }}>Berth strip</h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BERTHS.length}, 1fr)`, gap: 10 }}>
        {BERTHS.map((id) => (
          <div key={id} className="berth-slot" style={{ borderRadius: 10, border: '1px dashed #2a3358', background: '#111631' }}>
            <BerthTile berthId={id} />
          </div>
        ))}
      </div>
    </section>
  );
}

import React from 'react';
import { useAppState } from '../store/AppContext';
import { alertColor, worstLevel } from '../utils/helpers';

// Default contents of the status rail (shown on the home screen).
export default function ModuleStatus() {
  const { modules, telemetry, error } = useAppState();
  const rows = modules.map((m) => ({
    name: m.moduleName,
    zone: m.deckZone,
    level: worstLevel(telemetry.filter((r) => r.moduleId === m.moduleId).map((r) => r.alertLevel)),
  }));

  return (
    <section className="rail" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 14 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 14 }}>🧯 Module Status</h2>
      {error && <p style={{ color: '#c33b4e', fontSize: 12 }}>{error}</p>}
      {rows.map((row) => (
        <div key={row.name} className="row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, borderBottom: '1px solid #141a33' }}>
          <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: alertColor(row.level) }} />
          <span>{row.name}</span>
          <span style={{ marginLeft: 'auto', color: '#5d6690', fontSize: 10 }}>{row.zone}</span>
        </div>
      ))}
    </section>
  );
}

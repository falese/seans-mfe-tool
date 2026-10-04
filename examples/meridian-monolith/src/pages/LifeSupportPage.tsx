import React from 'react';
import { useAppState } from '../store/AppContext';
import { alertColor, formatMetric, worstLevel } from '../utils/helpers';

// Telemetry dashboard. Was a separate component until the page only ever
// rendered this one thing.
export default function LifeSupportPage() {
  const { modules, telemetry, error } = useAppState();

  const panels = modules.map((module) => {
    const readings = telemetry.filter((r) => r.moduleId === module.moduleId);
    return { module, readings, worst: worstLevel(readings.map((r) => r.alertLevel)) };
  });

  return (
    <section className="board" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🫁 Life Support Telemetry</h2>
      <p style={{ margin: '0 0 16px', color: '#5d6690', fontSize: 12 }}>StationOS environmental readings</p>
      {error && <p style={{ color: '#c33b4e' }}>Telemetry unavailable: {error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {panels.map((panel) => (
          <div key={panel.module.moduleId} className="module" style={{ border: '1px solid #1c2340', borderRadius: 10, padding: 12 }}>
            <h3 style={{ margin: '0 0 2px', fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
              {panel.module.moduleName}
              <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block', background: alertColor(panel.worst) }} />
            </h3>
            <div style={{ color: '#5d6690', fontSize: 11, marginBottom: 8 }}>{panel.module.deckZone} · {panel.module.moduleType}</div>
            {panel.readings.map((reading) => (
              <div key={reading.readingId} className="metric" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                <span style={{ color: '#8b93b5' }}>{reading.metricKind}</span>
                <span style={{ color: alertColor(reading.alertLevel) }}>{formatMetric(reading.metricKind, reading.metricValue)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

import React from 'react';
import { useAppState } from '../store/AppContext';
import { alertColor, formatMetric } from '../utils/helpers';
import StatusChip from './StatusChip';

export default function AlertsFeed() {
  const { telemetry, error } = useAppState();
  const alerts = telemetry
    .filter((r) => r.alertLevel === 'WATCH' || r.alertLevel === 'CRITICAL')
    .sort((a, b) => b.recordedAtUtc.localeCompare(a.recordedAtUtc));

  return (
    <section className="feed" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 14 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 14 }}>🚨 Alerts</h2>
      {error && <p style={{ color: '#c33b4e', fontSize: 12 }}>{error}</p>}
      {!error && alerts.length === 0 && <p style={{ color: '#5d6690', fontSize: 12 }}>All systems nominal.</p>}
      {alerts.map((alert) => (
        <div key={alert.readingId} className="entry" style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #141a33' }}>
          <span style={{ color: '#5d6690', fontVariantNumeric: 'tabular-nums' }}>{alert.recordedAtUtc.slice(11, 16)}</span>
          <span>module {alert.moduleId} · {formatMetric(alert.metricKind, alert.metricValue)}</span>
          <span style={{ marginLeft: 'auto' }}><StatusChip small label={alert.alertLevel} color={alertColor(alert.alertLevel)} /></span>
        </div>
      ))}
    </section>
  );
}

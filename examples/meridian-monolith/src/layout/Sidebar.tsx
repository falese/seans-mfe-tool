import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppState } from '../store/AppContext';
import { DOMAINS } from '../utils/constants';

export default function Sidebar() {
  const { telemetry } = useAppState();
  // Ops asked for an alert count on the Life Support entry (OPS-212).
  const alertCount = telemetry.filter((r) => r.alertLevel === 'CRITICAL' || r.alertLevel === 'WATCH').length;

  return (
    <nav className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header>
        <h1 style={{ margin: '4px 0', fontSize: 24 }}>🛸 Meridian Station</h1>
        <p style={{ margin: 0, color: '#5d6690', fontSize: 13 }}>Select a station domain</p>
      </header>
      <div style={{ display: 'grid', gap: 10 }} role="list">
        {DOMAINS.map((domain) => (
          <NavLink
            key={domain.id}
            to={domain.path}
            role="listitem"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${domain.color}`,
              background: isActive ? '#1a2148' : '#111631',
              color: '#dfe4ff',
              textDecoration: 'none',
              fontSize: 15,
            })}
          >
            <span style={{ fontSize: 22 }}>{domain.emoji}</span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: 'block' }}>{domain.title}</strong>
              <span style={{ fontSize: 12, color: '#8b93b5' }}>{domain.blurb}</span>
            </span>
            {domain.id === 'life-support' && alertCount > 0 && (
              <span className="badge" style={{ background: '#c33b4e', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

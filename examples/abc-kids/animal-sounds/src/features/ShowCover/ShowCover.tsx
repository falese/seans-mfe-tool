import React from 'react';

export const ShowCover: React.FC = () => (
  <div style={{ maxWidth: 340, margin: '0 auto', borderRadius: 16, overflow: 'hidden',
    background: '#33691e', color: '#fff', textAlign: 'center', padding: 24,
    fontFamily: 'system-ui, sans-serif' }}>
    <div style={{ fontSize: 72 }}>🐮</div>
    <h2 style={{ margin: '8px 0' }}>Animal Sounds</h2>
    <p style={{ opacity: 0.85 }}>Animal Sounds — which animal makes that sound?</p>
    <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '4px 12px', fontSize: 13 }}>
      ages 4-8
    </span>
  </div>
);

export default ShowCover;

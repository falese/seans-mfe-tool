import React from 'react';
import DockingSimulation from '../simulator/DockingSimulation';

export default function SimulatorPage() {
  return (
    <div style={{ height: '70vh', borderRadius: 12, overflow: 'hidden' }}>
      <DockingSimulation />
    </div>
  );
}

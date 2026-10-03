import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Sidebar from './layout/Sidebar';
import BerthStrip from './layout/BerthStrip';
import DockingBoard from './components/DockingBoard';
import TrafficLog from './components/TrafficLog';
import AlertsFeed from './components/AlertsFeed';
import ModuleStatus from './components/ModuleStatus';
import LifeSupportPage from './pages/LifeSupportPage';
import CargoPage, { HazardSummary } from './pages/cargo';
import CrewRoster from './components/crew/CrewRoster';
import PayStatus from './components/crew/PayStatus';
import ConcoursePage from './pages/ConcoursePage';
import SimulatorPage from './pages/SimulatorPage';

const panel: React.CSSProperties = { minHeight: '60vh', borderRadius: 12, border: '1px dashed #2a3358', background: '#0e1226' };

export default function App() {
  return (
    <div
      className="app"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(230px, 280px) 1fr minmax(230px, 300px)',
        gridTemplateRows: 'auto 1fr',
        gap: 16,
        minHeight: '92vh',
        padding: 16,
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0b0e1a',
        color: '#dfe4ff',
      }}
    >
      <BerthStrip />
      <Sidebar />

      <main style={panel}>
        <Routes>
          <Route path="/" element={null} />
          <Route path="/docking" element={<DockingBoard />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/life-support" element={<LifeSupportPage />} />
          <Route path="/cargo" element={<CargoPage />} />
          <Route path="/crew" element={<CrewRoster />} />
          <Route path="/concourse" element={<ConcoursePage />} />
        </Routes>
      </main>

      {/* status rail - keep in sync with the routes above */}
      <aside style={panel}>
        <Routes>
          <Route path="/" element={<ModuleStatus />} />
          <Route path="/docking" element={<TrafficLog />} />
          <Route path="/life-support" element={<AlertsFeed />} />
          <Route path="/cargo" element={<HazardSummary />} />
          <Route path="/crew" element={<PayStatus />} />
          <Route path="*" element={null} />
        </Routes>
      </aside>
    </div>
  );
}

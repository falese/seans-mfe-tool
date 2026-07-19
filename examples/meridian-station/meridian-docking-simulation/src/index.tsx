/**
 * Standalone App Entry Point
 * Bootstraps React for standalone development/testing
 *
 * Following REQ-RUNTIME-002: Context integration
 * Following e2e2 dual entry pattern
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { DockingSimulation } from './features/DockingSimulation/DockingSimulation';
import { ShipControl } from './features/ShipControl/ShipControl';

const Container = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0a0f;
  color: #0f0;
  font-family: 'Courier New', monospace;
`;

const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid #0f0;
  background: rgba(0, 15, 0, 0.1);
`;

const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid #0f0;
  background: rgba(0, 15, 0, 0.05);
`;

const Tab = styled.button<{ active?: boolean }>`
  padding: 12px 24px;
  background: ${(p) => (p.active ? '#0f0' : 'transparent')};
  color: ${(p) => (p.active ? '#000' : '#0f0')};
  border: 1px solid #0f0;
  border-right: none;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  font-weight: ${(p) => (p.active ? 'bold' : 'normal')};

  &:last-child {
    border-right: 1px solid #0f0;
  }

  &:hover {
    opacity: 0.8;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow: auto;
`;

interface TabPanelProps {
  children?: React.ReactNode;
  active: boolean;
}

function TabPanel({ children, active }: TabPanelProps) {
  if (!active) return null;
  return <>{children}</>;
}

const StandaloneApp: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Container>
      <Header>
        <h1>Meridian Docking Simulation</h1>
        <p>Module Federation MFE - Standalone Mode</p>
      </Header>

      <TabBar>
        <Tab active={tabValue === 0} onClick={() => setTabValue(0)}>
          DockingSimulation
        </Tab>
        <Tab active={tabValue === 1} onClick={() => setTabValue(1)}>
          ShipControl
        </Tab>
      </TabBar>

      <Content>
        <TabPanel active={tabValue === 0}>
          <DockingSimulation />
        </TabPanel>
        <TabPanel active={tabValue === 1}>
          <ShipControl />
        </TabPanel>
      </Content>
    </Container>
  );
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>
);

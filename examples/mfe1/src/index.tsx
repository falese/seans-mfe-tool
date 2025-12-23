/**
 * Standalone App Entry Point
 * Bootstraps React for standalone development/testing
 *
 * Following REQ-RUNTIME-002: Context integration
 * Following e2e2 dual entry pattern
 * Following ADR-060: Load Capability with telemetry
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Tabs, Tab, Box, Container, Typography } from '@mui/material';
import { HomePage } from './features/HomePage/HomePage';
import { IconView } from './features/IconView/IconView';
import { CatalogView } from './features/CatalogView/CatalogView';
import { DevTelemetryLogger } from './platform/telemetry/dev-telemetry-logger';

// Initialize telemetry logger in development mode
if (process.env.NODE_ENV === 'development') {
  const telemetryLogger = new DevTelemetryLogger();

  // Mock load result for demonstration
  // In a real scenario, this would come from the actual MFE load process
  const mockLoadResult = {
    status: 'loaded' as const,
    timestamp: new Date(),
    duration: 1000,
    container: { init: () => Promise.resolve() }, // Mock container
    manifest: { name: 'mfe1', version: '1.0.0', type: 'tool' }, // Mock manifest
    availableComponents: ['HomePage', 'IconView', 'CatalogView'],
    capabilities: [
      { name: 'load', type: 'platform' as const, available: true },
      { name: 'render', type: 'platform' as const, available: true },
      { name: 'HomePage', type: 'domain' as const, available: true },
      { name: 'IconView', type: 'domain' as const, available: true },
      { name: 'CatalogView', type: 'domain' as const, available: true }
    ],
    telemetry: {
      entry: { start: new Date(Date.now() - 1000), duration: 400 },
      mount: { start: new Date(Date.now() - 600), duration: 300 },
      enableRender: { start: new Date(Date.now() - 300), duration: 300 }
    }
  };

  // Store in global context for dashboard
  (window as any).__MFE_LOAD_RESULT__ = mockLoadResult;

  // Simulate telemetry events in console
  telemetryLogger.emit({
    name: 'load-start',
    capability: 'load',
    phase: 'entry',
    status: 'start',
    timestamp: new Date()
  });

  telemetryLogger.emit({
    name: 'entry-metric',
    capability: 'load',
    phase: 'entry',
    status: 'end',
    duration: 400,
    timestamp: new Date()
  });

  telemetryLogger.emit({
    name: 'mount-metric',
    capability: 'load',
    phase: 'mount',
    status: 'end',
    duration: 300,
    timestamp: new Date()
  });

  telemetryLogger.emit({
    name: 'enable_render-metric',
    capability: 'load',
    phase: 'enable_render',
    status: 'end',
    duration: 300,
    timestamp: new Date()
  });

  console.log('%c✨ ADR-060 Load Capability Telemetry Active', 'color: #4CAF50; font-weight: bold; font-size: 16px');
  console.log('%cCheck the HomePage tab to see the visual telemetry dashboard', 'color: #2196F3; font-style: italic');
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const StandaloneApp: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Mfe1
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Module Federation MFE - Standalone Mode
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="feature tabs">
            <Tab label="📦 HomePage" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="📦 IconView" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="📦 CatalogView" id="tab-2" aria-controls="tabpanel-2" />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <HomePage />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <IconView />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <CatalogView />
        </TabPanel>
      </Box>
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

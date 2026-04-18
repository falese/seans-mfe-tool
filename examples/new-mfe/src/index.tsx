/**
 * Standalone App Entry Point
 * Bootstraps React for standalone development/testing
 * 
 * Following REQ-RUNTIME-002: Context integration
 * Following e2e2 dual entry pattern
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Tabs, Tab, Box, Container, Typography } from '@mui/material';
import { UserProfile } from './features/UserProfile/UserProfile';

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
          New Mfe
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Module Federation MFE - Standalone Mode
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="feature tabs">
            <Tab label="📦 UserProfile" id="tab-0" aria-controls="tabpanel-0" />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <UserProfile />
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

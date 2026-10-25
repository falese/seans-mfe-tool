/**
 * Standalone App Entry Point
 * Bootstraps React for standalone development/testing
 * 
 * Following REQ-RUNTIME-002: Context integration
 * Following e2e2 dual entry pattern
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SystemError } from '@seans-mfe-tool/runtime';
import { Tabs, Tab, Box, Container, Typography } from '@mui/material';
import { ProposalMap } from './features/ProposalMap/ProposalMap';
import { ShapeProposal } from './features/ShapeProposal/ShapeProposal';
import { AgentPane } from './features/AgentPane/AgentPane';
import { ApproveProposal } from './features/ApproveProposal/ApproveProposal';

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
          Decomposition Workspace
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Module Federation MFE - Standalone Mode
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="feature tabs">
            <Tab label="📦 ProposalMap" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="📦 ShapeProposal" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="📦 AgentPane" id="tab-2" aria-controls="tabpanel-2" />
            <Tab label="📦 ApproveProposal" id="tab-3" aria-controls="tabpanel-3" />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <ProposalMap />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <ShapeProposal />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <AgentPane />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <ApproveProposal />
        </TabPanel>
      </Box>
    </Container>
  );
};

const container = document.getElementById('root');
if (!container) {
  throw new SystemError('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>
);

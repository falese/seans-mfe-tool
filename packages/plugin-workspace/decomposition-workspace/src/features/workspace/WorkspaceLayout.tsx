/**
 * The standalone page (ADR-116 §7): the map beside the tools, all four
 * capabilities on one shared proposal. A shell that composes this MFE mounts
 * the capabilities one at a time instead.
 */

import React, { useState } from 'react';
import { AppBar, Box, Chip, CssBaseline, Stack, Tab, Tabs, Toolbar, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ProposalMap } from '../ProposalMap/ProposalMap';
import { ShapeProposal } from '../ShapeProposal/ShapeProposal';
import { AgentPane } from '../AgentPane/AgentPane';
import { ApproveProposal } from '../ApproveProposal/ApproveProposal';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';
import type { WorkspaceClient } from './client';

const theme = createTheme({
  palette: { primary: { main: '#3b6ff5' }, background: { default: '#f4f6f9' } },
  shape: { borderRadius: 6 },
  typography: { fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif', button: { textTransform: 'none' } },
});

const APPROVAL = {
  none: { label: 'Not approved', color: 'default' },
  current: { label: 'Approved', color: 'success' },
  stale: { label: 'Approval out of date', color: 'warning' },
} as const;

function Header() {
  const { status } = useWorkspace();
  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Decomposition workspace</Typography>
        {status && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <Typography variant="body1" color="text.secondary">{status.app.name}</Typography>
            <Chip size="small" label={`${status.document.domains.length} domains`} />
            <Chip size="small" color={status.valid ? 'success' : 'error'} label={status.valid ? 'Valid' : 'Does not validate'} />
            <Chip size="small" color={APPROVAL[status.approval.status].color} label={APPROVAL[status.approval.status].label} />
            {status.suggestions.length > 0 && <Chip size="small" color="info" label={`${status.suggestions.length} suggestion${status.suggestions.length === 1 ? "" : "s"}`} />}
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}

function Body() {
  const [panel, setPanel] = useState(0);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 3fr) minmax(360px, 2fr)' }, gap: 2, p: 2 }}>
      <Box component="main" sx={{ minWidth: 0 }}>
        <ProposalMap />
      </Box>
      <Box component="aside" sx={{ minWidth: 0 }}>
        <Tabs value={panel} onChange={(_e, v: number) => setPanel(v)} aria-label="Tools" sx={{ mb: 2 }}>
          <Tab label="Shape" />
          <Tab label="Agent" />
          <Tab label="Approve" />
        </Tabs>
        {panel === 0 && <ShapeProposal />}
        {panel === 1 && <AgentPane />}
        {panel === 2 && <ApproveProposal />}
      </Box>
    </Box>
  );
}

export const WorkspaceLayout: React.FC<{ client?: WorkspaceClient }> = ({ client }) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <WorkspaceProvider client={client}>
      <Header />
      <Body />
    </WorkspaceProvider>
  </ThemeProvider>
);

export default WorkspaceLayout;

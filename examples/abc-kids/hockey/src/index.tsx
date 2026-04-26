import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { PlayGame } from './features/PlayGame/PlayGame';
import { ShowCover } from './features/ShowCover/ShowCover';
import { GetGameInfo } from './features/GetGameInfo/GetGameInfo';

const StandaloneApp: React.FC = () => {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a2e', color: '#fff', p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2, color: '#00CFFF' }}>
        🏒 Ice Hockey — ABC Kids
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Play" sx={{ color: '#00CFFF' }} />
        <Tab label="Cover" sx={{ color: '#00CFFF' }} />
        <Tab label="Info" sx={{ color: '#00CFFF' }} />
      </Tabs>
      {tab === 0 && <PlayGame />}
      {tab === 1 && <ShowCover />}
      {tab === 2 && <GetGameInfo />}
    </Box>
  );
};

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
createRoot(container).render(<React.StrictMode><StandaloneApp /></React.StrictMode>);

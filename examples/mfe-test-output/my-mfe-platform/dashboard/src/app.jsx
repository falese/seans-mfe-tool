import React from 'react';
import { Box, Typography, Container } from '@mui/material';
/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:imports */
import Dashboard from './components/Dashboard';
import DashboardWidget from './components/DashboardWidget';
/* MFE-GENERATOR:END */

const App = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          dashboard MFE
        </Typography>
        /* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:component-usage */
        <Dashboard />
        <DashboardWidget />
        /* MFE-GENERATOR:END */
      </Box>
    </Container>
  );
};

export default App;

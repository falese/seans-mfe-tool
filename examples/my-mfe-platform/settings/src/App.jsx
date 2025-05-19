import React from 'react';
import { Box, Typography, Container } from '@mui/material';
/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:imports */
import Settings from './components/Settings';
import SettingsForm from './components/SettingsForm';
/* MFE-GENERATOR:END */

const App = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          settings MFE
        </Typography>
        /* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:component-usage */
        <Settings />
        <SettingsForm />
        /* MFE-GENERATOR:END */
      </Box>
    </Container>
  );
};

export default App;

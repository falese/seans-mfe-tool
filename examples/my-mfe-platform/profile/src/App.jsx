import React from 'react';
import { Box, Typography, Container } from '@mui/material';
/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:imports */
import Profile from './components/Profile';
import ProfileIcon from './components/ProfileIcon';
/* MFE-GENERATOR:END */

const App = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          profile MFE
        </Typography>
        /* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:component-usage */
        <Profile />
        <ProfileIcon />
        /* MFE-GENERATOR:END */
      </Box>
    </Container>
  );
};

export default App;

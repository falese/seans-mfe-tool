import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:component-Dashboard */
const Dashboard = ({ title = "Dashboard" }) => {
  return (
    <Paper elevation={2} sx={{ p: 3, m: 2 }}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography>
          This is the Dashboard component from the dashboard MFE.
        </Typography>
      </Box>
    </Paper>
  );
};
/* MFE-GENERATOR:END */

export default Dashboard;

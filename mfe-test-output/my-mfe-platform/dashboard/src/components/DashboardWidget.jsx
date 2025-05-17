import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:component-DashboardWidget */
const DashboardWidget = ({ title = "DashboardWidget" }) => {
  return (
    <Paper elevation={2} sx={{ p: 3, m: 2 }}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography>
          This is the DashboardWidget component from the dashboard MFE.
        </Typography>
      </Box>
    </Paper>
  );
};
/* MFE-GENERATOR:END */

export default DashboardWidget;

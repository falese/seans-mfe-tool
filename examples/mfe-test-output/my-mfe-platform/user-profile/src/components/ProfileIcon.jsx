import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:component-ProfileIcon */
const ProfileIcon = ({ title = "ProfileIcon" }) => {
  return (
    <Paper elevation={2} sx={{ p: 3, m: 2 }}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography>
          This is the ProfileIcon component from the user-profile MFE.
        </Typography>
      </Box>
    </Paper>
  );
};
/* MFE-GENERATOR:END */

export default ProfileIcon;

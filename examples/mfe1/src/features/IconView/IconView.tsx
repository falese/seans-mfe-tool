/**
 * IconView Feature Component
 * View this MFE as an icon
 * Generated from mfe-manifest.yaml capability definition
 */
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export interface IconViewProps {
  // TODO: Define props based on capability inputs
}

export const IconView: React.FC<IconViewProps> = (props) => {
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        IconView
      </Typography>
      <Box>
        {/* TODO: Implement IconView */}
        <Typography variant="body2" color="text.secondary">
          View this MFE as an icon
        </Typography>
      </Box>
    </Paper>
  );
};

export default IconView;

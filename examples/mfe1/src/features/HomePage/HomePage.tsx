/**
 * HomePage Feature Component
 * provide the MFE as a homepage
 * Generated from mfe-manifest.yaml capability definition
 */
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export interface HomePageProps {
  // TODO: Define props based on capability inputs
}

export const HomePage: React.FC<HomePageProps> = (props) => {
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        HomePage
      </Typography>
      <Box>
        {/* TODO: Implement HomePage */}
        <Typography variant="body2" color="text.secondary">
          provide the MFE as a homepage
        </Typography>
      </Box>
    </Paper>
  );
};

export default HomePage;

/**
 * HomePage Feature Component
 * provide the MFE as a homepage
 * Generated from mfe-manifest.yaml capability definition
 */
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { LoadTelemetryDashboard } from '../../components/LoadTelemetryDashboard';

export interface HomePageProps {
  // TODO: Define props based on capability inputs
}

export const HomePage: React.FC<HomePageProps> = (props) => {
  const [loadResult, setLoadResult] = useState<any>(undefined);

  useEffect(() => {
    // In development, capture load result from global context
    if (process.env.NODE_ENV === 'development') {
      const result = (window as any).__MFE_LOAD_RESULT__;
      setLoadResult(result);
    }
  }, []);

  return (
    <Box>
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

      {/* Show telemetry dashboard in development mode */}
      {process.env.NODE_ENV === 'development' && (
        <LoadTelemetryDashboard loadResult={loadResult} />
      )}
    </Box>
  );
};

export default HomePage;

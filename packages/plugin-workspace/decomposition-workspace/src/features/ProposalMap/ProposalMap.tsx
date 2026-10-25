/**
 * ProposalMap Feature Component
 * The captured screens with each proposed domain outlined, and the evidence behind the selected domain
 * Generated from mfe-manifest.yaml capability definition
 */
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export interface ProposalMapProps {
  // TODO: Define props based on capability inputs
}

export const ProposalMap: React.FC<ProposalMapProps> = (props) => {
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        ProposalMap
      </Typography>
      <Box>
        {/* TODO: Implement ProposalMap */}
        <Typography variant="body2" color="text.secondary">
          The captured screens with each proposed domain outlined, and the evidence behind the selected domain
        </Typography>
      </Box>
    </Paper>
  );
};

export default ProposalMap;

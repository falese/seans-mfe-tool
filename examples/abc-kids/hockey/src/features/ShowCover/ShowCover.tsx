import React from 'react';
import { Card, CardContent, Box, Typography, Chip } from '@mui/material';

export const ShowCover: React.FC = () => (
  <Card sx={{ maxWidth: 340, borderRadius: 4, overflow: 'hidden', m: 'auto', bgcolor: '#2d0080' }}>
    <Box
      sx={{
        height: 200,
        background: 'linear-gradient(135deg, #B0E0E6 0%, #4169E1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '6rem',
      }}
    >
      🏒
    </Box>
    <CardContent>
      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#00CFFF' }}>
        Ice Hockey
      </Typography>
      <Typography variant="body2" sx={{ color: '#ccc', mt: 1 }}>
        Move your paddle and score goals against the AI! How many can you get?
      </Typography>
      <Chip
        label="Ages 5–12"
        size="small"
        sx={{ mt: 2, bgcolor: '#00CFFF', color: '#0a0a2e', fontWeight: 'bold' }}
      />
    </CardContent>
  </Card>
);

export default ShowCover;

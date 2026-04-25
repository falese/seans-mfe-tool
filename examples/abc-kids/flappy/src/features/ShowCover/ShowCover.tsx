import React from 'react';
import { Card, CardContent, Box, Typography, Chip } from '@mui/material';

export const ShowCover: React.FC = () => (
  <Card sx={{ maxWidth: 340, borderRadius: 4, overflow: 'hidden', m: 'auto', bgcolor: '#2d0080' }}>
    <Box
      sx={{
        height: 200,
        background: 'linear-gradient(135deg, #87CEEB 0%, #98FB98 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '6rem',
      }}
    >
      🐦
    </Box>
    <CardContent>
      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#FFD700' }}>
        Flappy Bird
      </Typography>
      <Typography variant="body2" sx={{ color: '#ccc', mt: 1 }}>
        Tap to flap and fly through pipes! Beat your high score.
      </Typography>
      <Chip label="Ages 4–10" size="small" sx={{ mt: 2, bgcolor: '#FFD700', color: '#1a0050', fontWeight: 'bold' }} />
    </CardContent>
  </Card>
);

export default ShowCover;

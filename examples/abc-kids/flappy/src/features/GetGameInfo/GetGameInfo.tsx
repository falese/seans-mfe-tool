import React from 'react';
import { Box, Typography, Chip, List, ListItem, ListItemText } from '@mui/material';

const INFO = {
  title: 'Flappy Bird',
  description:
    'A fun tap game where you guide a golden bird through pipes by tapping the screen. How far can you fly?',
  ageMin: 4,
  ageMax: 10,
  controls: ['Tap the screen', 'Press the Space bar'],
  noCheatCodes: true,
};

export const GetGameInfo: React.FC = () => (
  <Box sx={{ p: 3, maxWidth: 420, mx: 'auto', color: '#fff' }}>
    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#FFD700', mb: 1 }}>
      {INFO.title}
    </Typography>
    <Chip label={`Ages ${INFO.ageMin}–${INFO.ageMax}`} sx={{ bgcolor: '#FFD700', color: '#1a0050', fontWeight: 'bold', mb: 2 }} />
    <Typography variant="body1" sx={{ color: '#ddd', mb: 2 }}>
      {INFO.description}
    </Typography>
    <Typography variant="subtitle2" sx={{ color: '#aaa', mb: 1 }}>
      How to play:
    </Typography>
    <List dense disablePadding>
      {INFO.controls.map(c => (
        <ListItem key={c} sx={{ py: 0 }}>
          <ListItemText primary={`• ${c}`} sx={{ color: '#ccc' }} />
        </ListItem>
      ))}
    </List>
    {INFO.noCheatCodes && (
      <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 2 }}>
        No cheat codes — play fair and have fun! 🐦
      </Typography>
    )}
  </Box>
);

export default GetGameInfo;

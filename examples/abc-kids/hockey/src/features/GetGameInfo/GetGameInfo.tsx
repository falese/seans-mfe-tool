import React from 'react';
import { Box, Typography, Chip, List, ListItem, ListItemText } from '@mui/material';

const INFO = {
  title: 'Ice Hockey',
  description:
    'A fast-paced ice hockey game where you control the gold paddle and try to score goals against the AI opponent. The puck bounces off the walls and speeds up as you play!',
  ageMin: 5,
  ageMax: 12,
  controls: ['Arrow Up / W — move paddle up', 'Arrow Down / S — move paddle down'],
  noCheatCodes: true,
};

export const GetGameInfo: React.FC = () => (
  <Box sx={{ p: 3, maxWidth: 420, mx: 'auto', color: '#fff' }}>
    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#00CFFF', mb: 1 }}>
      {INFO.title}
    </Typography>
    <Chip
      label={`Ages ${INFO.ageMin}–${INFO.ageMax}`}
      sx={{ bgcolor: '#00CFFF', color: '#0a0a2e', fontWeight: 'bold', mb: 2 }}
    />
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
        No cheat codes — play fair and have fun! 🏒
      </Typography>
    )}
  </Box>
);

export default GetGameInfo;

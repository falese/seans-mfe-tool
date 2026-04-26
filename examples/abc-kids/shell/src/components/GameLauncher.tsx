import React, { Suspense } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { GameMeta } from '../App';

const FlappyApp = React.lazy(() => import('abcKidsFlappy/App'));
const HockeyApp = React.lazy(() => import('abcKidsHockey/App'));

interface GameLauncherProps {
  game: GameMeta;
  onClose: () => void;
}

function RemoteGame({ id }: { id: string }) {
  if (id === 'flappy') return <FlappyApp capability="PlayGame" />;
  if (id === 'hockey') return <HockeyApp capability="PlayGame" />;
  return null;
}

const GameLauncher: React.FC<GameLauncherProps> = ({ game, onClose }) => {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 500,
        bgcolor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          bgcolor: '#1a0050',
          borderRadius: 4,
          width: '95vw', maxWidth: 720,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 0 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2.5, py: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography variant="h6" sx={{ color: '#FFD700' }}>
            {game.emoji}&nbsp;&nbsp;{game.title}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '50%',
              '&:hover': { borderColor: '#FF6B6B', color: '#FF6B6B' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Game body */}
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}>
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
                <CircularProgress sx={{ color: '#FFD700' }} size={56} />
                <Typography sx={{ color: '#aaa' }}>Loading {game.title}…</Typography>
              </Box>
            }
          >
            <RemoteGame id={game.id} />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default GameLauncher;

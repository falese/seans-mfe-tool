import React, { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

interface SplashProps {
  onEnter: () => void;
}

const Splash: React.FC<SplashProps> = ({ onEnter }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #1a0050 0%, #2d0080 50%, #0a0030 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.92)',
        transition: 'opacity 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '3.5rem', sm: '5rem', md: '7rem' },
          background: 'linear-gradient(135deg, #FFD700, #FF6B6B, #00CFFF, #FFD700)',
          backgroundSize: '300% 300%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'gradientShift 3s ease infinite',
          lineHeight: 1,
          '@keyframes gradientShift': {
            '0%,100%': { backgroundPosition: '0% 50%' },
            '50%':     { backgroundPosition: '100% 50%' },
          },
        }}
      >
        ABC Kids
      </Typography>

      <Typography variant="h5" sx={{ color: '#aad4ff', letterSpacing: 1 }}>
        ✨ Mistakes are OK here! ✨
      </Typography>

      <Button
        variant="contained"
        size="large"
        onClick={onEnter}
        sx={{
          mt: 2,
          px: 6, py: 2,
          fontSize: '1.5rem',
          borderRadius: 50,
          background: 'linear-gradient(135deg, #FFD700, #FFA500)',
          color: '#1a0050',
          fontWeight: 700,
          boxShadow: '0 8px 32px rgba(255,215,0,0.4)',
          '&:hover': {
            background: 'linear-gradient(135deg, #FFE040, #FFB020)',
            boxShadow: '0 12px 40px rgba(255,215,0,0.55)',
            transform: 'scale(1.06) translateY(-2px)',
          },
        }}
      >
        Let's Play! 🎮
      </Button>
    </Box>
  );
};

export default Splash;

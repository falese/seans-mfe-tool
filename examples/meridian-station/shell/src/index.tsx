import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';

const kidsTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#FFD700' },
    secondary:  { main: '#FF6B6B' },
    background: { default: '#1a0050', paper: '#2d0080' },
  },
  typography: {
    fontFamily: '"Fredoka One", "Comic Sans MS", cursive',
  },
  shape: { borderRadius: 16 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontFamily: '"Fredoka One", cursive' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: '"Fredoka One", cursive' },
      },
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider theme={kidsTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

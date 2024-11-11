import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const mount = (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const root = createRoot(container);
  root.render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
};

// Mount immediately if we're running in isolation
if (!window.__POWERED_BY_FEDERATION__) {
  mount('root');
}

export { mount };

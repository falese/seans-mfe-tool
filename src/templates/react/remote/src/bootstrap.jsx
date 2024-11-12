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

const mount = async (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
  return root;
};

// Mount immediately if we're running in standalone mode (not loaded via Module Federation)
if (!window.__POWERED_BY_FEDERATION__) {
  mount('root');
}

export default App;
export { mount };
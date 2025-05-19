import * as React from 'react';

// Dynamic imports from remote MFEs
const dashboardApp = React.lazy(() => import('dashboard/App'));
const profileApp = React.lazy(() => import('profile/App'));
const settingsApp = React.lazy(() => import('settings/App'));
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              main-shell
            </Typography>
          </Toolbar>
        </AppBar>
        <Container component="main" sx={{ mt: 4, mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to main-shell
          </Typography>
          <Typography variant="body1">
            Your Module Federation shell is running on port 3000.
          </Typography>
          
          <Typography variant="h6" sx={{ mt: 2 }}>
            Remote: dashboard
          </Typography>
          <React.Suspense fallback={<div>Loading dashboard...</div>}>
            <dashboardApp />
          </React.Suspense>

          <Typography variant="h6" sx={{ mt: 2 }}>
            Remote: profile
          </Typography>
          <React.Suspense fallback={<div>Loading profile...</div>}>
            <profileApp />
          </React.Suspense>

          <Typography variant="h6" sx={{ mt: 2 }}>
            Remote: settings
          </Typography>
          <React.Suspense fallback={<div>Loading settings...</div>}>
            <settingsApp />
          </React.Suspense>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
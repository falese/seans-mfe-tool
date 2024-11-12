import * as React from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import RemoteCard1 from 'my-remote/App'
import RemoteCard2 from 'my-remote-2/App'
import RemoteCard3 from 'my-remote-3/App'
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              my-shell
            </Typography>
          </Toolbar>
        </AppBar>
        <Container component="main" sx={{ mt: 4, mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to my-shell
          </Typography>
          <Typography variant="body1">
            Your Module Federation shell is running on port 3000.
            
          </Typography>
        </Container>
       <RemoteCard1 />
       <RemoteCard2 />
       <RemoteCard3 />
      </Box>
    </ThemeProvider>
  );
}

export default App;
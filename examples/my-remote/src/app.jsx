import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  useTheme,
  Paper,
  Divider 
} from '@mui/material';
import ROIDashboard from './dashboard';

const App = () => {
  const theme = useTheme();
  const muiVersion = require('@mui/material/package.json').version;
  const pkgJson = require('../package.json');

  return (
    <Box sx={{ p: 2 }}>
      <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h4" gutterBottom color="primary">
          {pkgJson.name}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Remote MFE Component
        </Typography>
      </Paper>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Package Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="body1" color="text.secondary" gutterBottom>
            MUI Version: {muiVersion}
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Package Version: {pkgJson.version}
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Primary Color: {theme.palette.primary.main}
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" display="block">
              Running in {process.env.NODE_ENV} mode
            </Typography>
            <Typography variant="caption" display="block">
              Last Updated: {new Date().toLocaleString()}
            </Typography>
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Business Case Dashboard
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <ROIDashboard />
        </CardContent>
      </Card>
    </Box>
  );
};

export default App;
import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  useTheme 
} from '@mui/material';

const App = () => {
  const theme = useTheme();
  const muiVersion = require('@mui/material/package.json').version;
  const pkgJson = require('../package.json');

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            {pkgJson.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            MUI Version: {muiVersion}
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Package Version: {pkgJson.version}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Primary Color: {theme.palette.primary.main}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default App;

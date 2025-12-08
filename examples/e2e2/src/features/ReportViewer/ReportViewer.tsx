/**
 * ReportViewer Feature Component
 * View and export analysis reports
 * Generated from mfe-manifest.yaml capability definition
 */
import React, { useState } from 'react';
import { Box, Typography, Paper, Button, Stack, Divider, List, ListItem, ListItemText } from '@mui/material';

export interface ReportViewerProps {
  reportData?: any;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportData }) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = (format: string) => {
    setExporting(true);
    setTimeout(() => {
      console.log(`Exporting report as ${format}...`);
      setExporting(false);
    }, 1000);
  };

  const mockInsights = [
    { label: 'Average Revenue', value: '$125,430', trend: '+12%' },
    { label: 'Total Transactions', value: '1,847', trend: '+8%' },
    { label: 'Top Category', value: 'Electronics', trend: '32%' },
    { label: 'Data Quality Score', value: '94%', trend: '+3%' },
  ];

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h5" component="h2">
            📈 Analysis Report
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          View detailed insights and export results
        </Typography>

        <Divider />

        <List dense>
          {mockInsights.map((insight, idx) => (
            <ListItem key={idx} sx={{ px: 0 }}>
              <ListItemText
                primary={insight.label}
                secondary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" component="span">
                      {insight.value}
                    </Typography>
                    <Box display="flex" alignItems="center" color="success.main">
                      <Typography variant="caption">📈 {insight.trend}</Typography>
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>

        <Divider />

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={() => handleExport('PDF')}
            disabled={exporting}
            size="small"
          >
            📥 Export PDF
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleExport('CSV')}
            disabled={exporting}
            size="small"
          >
            📥 Export CSV
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default ReportViewer;

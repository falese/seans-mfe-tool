import React, { useState } from 'react';
import { Box, Container, Stack, Typography, Tabs, Tab } from '@mui/material';
import { DataAnalysis } from './features/DataAnalysis/DataAnalysis';
import { ReportViewer } from './features/ReportViewer/ReportViewer';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [reportData, setReportData] = useState<any>(null);

  const handleAnalysisComplete = (data: any) => {
    setReportData(data);
    setActiveTab(1); // Switch to report viewer
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom>
          CSV Analyzer MFE
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Powered by @seans-mfe-tool/runtime
        </Typography>
      </Box>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Data Analysis" />
        <Tab label="Report Viewer" />
      </Tabs>

      <Stack spacing={3}>
        {activeTab === 0 && <DataAnalysis onAnalysisComplete={handleAnalysisComplete} />}
        {activeTab === 1 && <ReportViewer reportData={reportData} />}
      </Stack>
    </Container>
  );
};

export default App;

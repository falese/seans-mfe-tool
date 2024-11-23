import React from 'react';
import { Box, Card, CardContent, Typography, Grid, Stack } from '@mui/material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

const ROIDashboard = () => {
  const quarterlyMetrics = [
    { phase: 'Current', teamSize: 17, benefits: 5887805, costs: 2833339, roi: 108 },
    { phase: 'Q1', teamSize: 20, benefits: 1471951, costs: 3401049, roi: -56 },
    { phase: 'Q2', teamSize: 24, benefits: 2943902, costs: 4067717, roi: -26 },
    { phase: 'Q3', teamSize: 27, benefits: 4415853, costs: 4567718, roi: -2 },
    { phase: 'Q4', teamSize: 30, benefits: 5297024, costs: 5067719, roi: 5 }
  ];

  const cumulativeROI = [
    { year: 'Current', costs: 2833339, benefits: 5887805, roi: 108 },
    { year: 'Year 1', costs: 17104203, benefits: 14128730, roi: -17.4 },
    { year: 'Year 2', costs: 37104243, benefits: 37780090, roi: 1.8 },
    { year: 'Year 3', costs: 57104283, benefits: 61431450, roi: 7.6 },
    { year: 'Year 4', costs: 77104323, benefits: 85082810, roi: 10.3 },
    { year: 'Year 5', costs: 97104363, benefits: 108734170, roi: 12.0 }
  ];

  const benefitBreakdown = [
    { name: 'Dev Time Savings', value: 1209343 },
    { name: 'Support Efficiency', value: 38462 },
    { name: 'Time-to-Market', value: 4640000 }
  ];

  const COLORS = ['#1976d2', '#42a5f5', '#90caf9'];

  const KPICard = ({ title, value, subtitle }) => (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="5-Year Net Benefit"
            value="$11.6M"
            subtitle="Cumulative by year 5"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Break-Even"
            value="Year 2"
            subtitle="Positive cumulative ROI"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Team Growth"
            value="17 → 30"
            subtitle="Over 4 quarters"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Annual Benefits"
            value="$5.89M"
            subtitle="At steady state"
          />
        </Grid>

        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quarterly Metrics
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={quarterlyMetrics}>
                    <XAxis dataKey="phase" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${(value/1000000).toFixed(2)}M`} />
                    <Legend />
                    <Bar dataKey="costs" name="Costs" fill="#bdbdbd" />
                    <Bar dataKey="benefits" name="Benefits" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cumulative ROI
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer>
                  <LineChart data={cumulativeROI}>
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="roi" name="ROI %" stroke="#1976d2" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Benefit Breakdown
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={benefitBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={150}
                      label={entry => `${entry.name}: $${(entry.value/1000000).toFixed(1)}M`}
                    >
                      {benefitBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${(value/1000000).toFixed(2)}M`} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Team Growth & Performance Gates
              </Typography>
              <Stack spacing={2}>
                {['Core Platform', 'Dev Automation', 'Support Auto', 'Scale & Opt'].map((phase, index) => (
                  <Box key={phase}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body1">{phase}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[20, 24, 27, 30][index]} engineers
                      </Typography>
                      <Box sx={{ width: 100, bgcolor: 'grey.200', height: 8, borderRadius: 1 }}>
                        <Box
                          sx={{
                            width: `${[25, 50, 75, 90][index]}%`,
                            height: '100%',
                            bgcolor: 'primary.main',
                            borderRadius: 1
                          }}
                        />
                      </Box>
                      <Typography variant="body2">
                        {[25, 50, 75, 90][index]}%
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ROIDashboard;
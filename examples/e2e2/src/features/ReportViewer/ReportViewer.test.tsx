/**
 * ReportViewer Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ReportViewer } from './ReportViewer';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ReportViewer', () => {
  it('renders without crashing', () => {
    renderWithTheme(<ReportViewer />);
    expect(screen.getByText('ReportViewer')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});

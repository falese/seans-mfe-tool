/**
 * ShareReports Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ShareReports } from './ShareReports';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ShareReports', () => {
  it('renders without crashing', () => {
    renderWithTheme(<ShareReports />);
    expect(screen.getByText('ShareReports')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});

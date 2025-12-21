/**
 * DataAnalysis Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { DataAnalysis } from './DataAnalysis';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('DataAnalysis', () => {
  it('renders without crashing', () => {
    renderWithTheme(<DataAnalysis />);
    expect(screen.getByText('DataAnalysis')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
